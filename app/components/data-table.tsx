import { useEffect, useMemo, useState } from "react";
import { FunnelX, Settings2 } from "lucide-react";
import {
  createColumnHelper,
  type ColumnDef,
  type ColumnHelper,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  useTable,
} from "@tanstack/react-table";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "~/components/reui/data-grid/data-grid";
import { DataGridColumnVisibility } from "~/components/reui/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "~/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "~/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "~/components/reui/data-grid/data-grid-table";

import { type FilterNode, Filters } from "~/components/reui/filters/filters";
import {
  createFilterQuery,
  type FilterCondition,
  flattenFilterConditions,
  isFilterRule,
  toFilterCondition,
} from "~/components/reui/filters/filters-query";
import type { FilterField, FilterQuery } from "~/components/reui/filters/filters-types";
import { stringifyValue } from "~/lib/utils";
import {
  createDataTableRowActionsColumn,
  type DataTableRowActions,
  type RowActionHandler,
} from "~/components/data-table-row-actions";

export type DataTableRow<TData extends RowData> = Row<DataGridFeatures, TData>;

export type DataTableColumn<TData extends RowData> = ColumnDef<DataGridFeatures, TData, any>;

type FlatFilterCondition = ReturnType<typeof flattenFilterConditions>[number];

export interface DataTableProps<TData extends RowData> {
  data: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  rowActions?: DataTableRowActions<TData>;
  onRowAction?: RowActionHandler<TData>;
  filterFields?: FilterField[];
  searchKeys?: (keyof TData)[];
  searchPlaceholder?: string;
  initialPageSize?: number;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableColumnVisibility?: boolean;
  isLoading?: boolean;
  loadingMessage?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  noResultsMessage?: React.ReactNode;
  filterCondition?: (row: TData, condition: FlatFilterCondition) => boolean;
  getSearchValues?: (row: TData) => unknown[];
  getRowId?: (row: TData, index: number, parent?: DataTableRow<TData>) => string;
}

export function createDataTableColumnHelper<TData extends RowData>(): ColumnHelper<
  DataGridFeatures,
  TData
> {
  return createColumnHelper<DataGridFeatures, TData>();
}

function getValueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function defaultFilterCondition<TData extends RowData>(row: TData, condition: FlatFilterCondition) {
  const rawValue = getValueAtPath(row, condition.path);
  const value = stringifyValue(rawValue);
  const normalizedValue = value.toLowerCase();
  const values = condition.values.map(String);
  const normalizedValues = values.map((entry) => entry.toLowerCase());
  let matches: boolean;

  switch (String(condition.operator)) {
    case "is":
    case "equals":
    case "is_any_of":
      matches = values.includes(value);
      break;
    case "is_not":
    case "not_equals":
    case "is_none_of":
      matches = !values.includes(value);
      break;
    case "contains":
      matches = normalizedValues.some((entry) => normalizedValue.includes(entry));
      break;
    case "not_contains":
      matches = normalizedValues.every((entry) => !normalizedValue.includes(entry));
      break;
    case "starts_with":
      matches = normalizedValues.some((entry) => normalizedValue.startsWith(entry));
      break;
    case "ends_with":
      matches = normalizedValues.some((entry) => normalizedValue.endsWith(entry));
      break;
    case "empty":
      matches = rawValue === null || rawValue === undefined || value.trim() === "";
      break;
    case "not_empty":
      matches = rawValue !== null && rawValue !== undefined && value.trim() !== "";
      break;
    case "greater_than":
      matches = Number(rawValue) > Number(values[0]);
      break;
    case "greater_than_or_equal":
      matches = Number(rawValue) >= Number(values[0]);
      break;
    case "less_than":
      matches = Number(rawValue) < Number(values[0]);
      break;
    case "less_than_or_equal":
      matches = Number(rawValue) <= Number(values[0]);
      break;
    case "between": {
      const current = Number(rawValue);
      const min = Number(values[0]);
      const max = Number(values[1]);

      matches = current >= min && current <= max;

      break;
    }
    default:
      matches = true;
  }
  return condition.negated ? !matches : matches;
}

type TableDateProps = {
  value: Date | string | number | null | undefined;
  variant?: "date" | "datetime" | "time";
  locale?: string;
  timeZone?: string;
  fallback?: React.ReactNode;
};

export function TableDate({
  value,
  variant = "date",
  locale = "en-GB",
  timeZone,
  fallback = "-",
}: Readonly<TableDateProps>) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const options: Intl.DateTimeFormatOptions =
    variant === "datetime"
      ? {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        }
      : variant === "time"
        ? {
            timeStyle: "short",
            timeZone,
          }
        : {
            dateStyle: "medium",
            timeZone,
          };
  const formatted = new Intl.DateTimeFormat(locale, options).format(date);

  return (
    <time dateTime={date.toISOString()} title={formatted}>
      {formatted}
    </time>
  );
}

function evaluateFilterNode<TData extends RowData>(
  row: TData,
  node: FilterNode,
  predicate: (row: TData, condition: FilterCondition) => boolean,
): boolean | null {
  if (isFilterRule(node)) {
    const condition = toFilterCondition(node);
    return condition ? predicate(row, condition) : null;
  }
  const results = node.rules
    .map((child) => evaluateFilterNode(row, child, predicate))
    .filter((result): result is boolean => result !== null);
  if (results.length === 0) return null;
  return node.combinator === "and" ? results.every(Boolean) : results.some(Boolean);
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  rowActions = false,
  onRowAction,
  filterFields = [],
  searchKeys,
  searchPlaceholder = "Search...",
  initialPageSize = 10,
  enableSearch = true,
  enableFilters = true,
  enableColumnVisibility = true,
  isLoading = false,
  loadingMessage = "Loading data...",
  emptyMessage = "No data available.",
  noResultsMessage = "No matching results.",
  filterCondition = defaultFilterCondition,
  getSearchValues,
  getRowId,
}: Readonly<DataTableProps<TData>>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  const [search, setSearch] = useState("");

  const [filterQuery, setFilterQuery] = useState<FilterQuery>(() => createFilterQuery());

  const activeConditions = useMemo(() => flattenFilterConditions(filterQuery), [filterQuery]);

  const filteredData = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return data.filter((row) => {
      if (enableSearch && normalizedSearch) {
        let searchableValues: unknown[];

        if (getSearchValues) {
          searchableValues = getSearchValues(row);
        } else if (searchKeys?.length) {
          searchableValues = searchKeys.map((key) => row[key]);
        } else {
          searchableValues = Object.values(row as Record<string, unknown>);
        }

        const matchesSearch = searchableValues.some((value) =>
          stringifyValue(value).toLowerCase().includes(normalizedSearch),
        );

        if (!matchesSearch) {
          return false;
        }
      }

      if (enableFilters && activeConditions.length) {
        return evaluateFilterNode(row, filterQuery, filterCondition) ?? true;
      }

      return true;
    });
  }, [
    data,
    search,
    searchKeys,
    activeConditions,
    enableSearch,
    enableFilters,
    filterCondition,
    getSearchValues,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));

  useEffect(() => {
    setPagination((current) => {
      const lastPageIndex = pageCount - 1;
      if (current.pageIndex <= lastPageIndex) return current;
      return { ...current, pageIndex: lastPageIndex };
    });
  }, [pageCount]);

  const resolvedColumns = useMemo<readonly DataTableColumn<TData>[]>(() => {
    if (!rowActions) {
      return columns;
    }

    return [
      ...columns,
      createDataTableRowActionsColumn({
        rowActions,
        onRowAction,
      }),
    ];
  }, [columns, rowActions, onRowAction]);

  const table = useTable<DataGridFeatures, TData>({
    features: dataGridFeatures,
    data: filteredData,
    columns: resolvedColumns,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    enableSorting: true,
    enableSortingRemoval: false,
    getRowId,
  });

  function resetPage() {
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }));
  }

  function handleFilterChange(query: FilterQuery) {
    setFilterQuery(query);
    resetPage();
  }

  function clearFilters() {
    setFilterQuery(createFilterQuery());
    resetPage();
  }

  return (
    <DataGrid
      table={table}
      recordCount={filteredData.length}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      emptyMessage={
        data.length === 0 || (!search.trim() && activeConditions.length === 0)
          ? emptyMessage
          : noResultsMessage
      }
      tableLayout={{
        rowBorder: true,
        headerBorder: true,
        width: "fixed",
        columnsResizable: true,
        columnsVisibility: enableColumnVisibility,
      }}
    >
      <div className="w-full space-y-2.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          {(enableSearch || enableColumnVisibility) && (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {enableSearch && (
                <Input
                  className="h-8 w-full sm:w-64"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);

                    resetPage();
                  }}
                  placeholder={searchPlaceholder}
                  type="search"
                  aria-label={searchPlaceholder}
                />
              )}

              {enableColumnVisibility && (
                <DataGridColumnVisibility
                  table={table}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Settings2 />
                      View
                    </Button>
                  }
                />
              )}
            </div>
          )}
          {enableFilters && filterFields.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <Filters
                  fields={filterFields}
                  query={filterQuery}
                  onQueryChange={handleFilterChange}
                />
              </div>

              {activeConditions.length > 0 && (
                <Button variant="outline" onClick={clearFilters}>
                  <FunnelX />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
        <DataGridContainer>
          <DataGridScrollArea orientation="horizontal">
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <DataGridPagination />
      </div>
    </DataGrid>
  );
}
