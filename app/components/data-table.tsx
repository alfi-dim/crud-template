import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  createColumnHelper,
  type ColumnDef,
  type ColumnHelper,
  type PaginationState,
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

import { Filters } from "~/components/reui/filters/filters";
import {
  createFilterQuery,
  flattenFilterConditions,
} from "~/components/reui/filters/filters-query";
import { buildFilterIndex, getFilterField } from "~/components/reui/filters/filters-lib";
import {
  getFilterArity,
  getFilterOperator,
  resolveFilterOperators,
} from "~/components/reui/filters/filters-operators";
import type { FilterField, FilterQuery } from "~/components/reui/filters/filters-types";
import { isEmptyValue, stringifyValue, toFiniteNumber } from "~/lib/utils";
import {
  calendarDateKeyToDate,
  compareCalendarDateKeys,
  createCalendarDateNormalizer,
  isCalendarDateKey,
  parseExplicitTimestamp,
  type CalendarDateNormalizer,
} from "~/lib/calendar-date";
import {
  createDataTableRowActionsColumn,
  type DataTableRow,
  type DataTableRowActions,
  type RowActionHandler,
} from "~/components/data-table-row-actions";

export type { DataTableRow } from "~/components/data-table-row-actions";

export type DataTableColumn<TData extends RowData> = ColumnDef<DataGridFeatures, TData, any>;

type FlatFilterCondition = ReturnType<typeof flattenFilterConditions>[number];

export interface DataTableProps<TData extends RowData> {
  data: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  rowActions?: DataTableRowActions<TData>;
  onRowAction?: RowActionHandler<TData>;
  filterFields?: readonly FilterField[];
  searchKeys?: (keyof TData)[];
  searchPlaceholder?: string;
  initialPageSize?: number;
  /** Timezone used to turn timestamp row values into calendar dates. */
  dateTimeZone?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableColumnVisibility?: boolean;
  /** Opt in to the grid primitive's pointer-based column resizing. */
  enableColumnResizing?: boolean;
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

function defaultFilterCondition<TData extends RowData>(
  row: TData,
  condition: FlatFilterCondition,
  normalizeCalendarDate: CalendarDateNormalizer,
) {
  const rawValue = getValueAtPath(row, condition.path);
  // stringifyValue is used only for text operators (contains, starts_with, etc.).
  // Date operators receive rawValue directly because normalizeCalendarDate handles
  // Date objects, numbers, and strings natively.
  const value = stringifyValue(rawValue);
  const normalizedValue = value.toLowerCase();
  const values = condition.values.map(String);
  const normalizedValues = values.map((entry) => entry.toLowerCase());
  let matches: boolean;

  switch (String(condition.operator)) {
    case "is":
    case "eq":
    case "is_any_of":
      matches = values.includes(value);
      break;
    case "is_not":
    case "neq":
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
      // null, undefined, "" are empty. Invalid date strings (e.g. "not-a-date")
      // are non-empty but will fail date operator normalization.
      matches = isEmptyValue(rawValue);
      break;
    case "not_empty":
      matches = !isEmptyValue(rawValue);
      break;
    case "date_is":
    case "date_is_not":
    case "date_before":
    case "date_after":
    case "date_on_or_before":
    case "date_on_or_after": {
      const current = normalizeCalendarDate(rawValue);
      const expected = normalizeCalendarDate(condition.values[0]);
      if (current === null || expected === null) return false;
      const comparison = compareCalendarDateKeys(current, expected);
      matches =
        condition.operator === "date_is"
          ? comparison === 0
          : condition.operator === "date_is_not"
            ? comparison !== 0
            : condition.operator === "date_before"
              ? comparison < 0
              : condition.operator === "date_after"
                ? comparison > 0
                : condition.operator === "date_on_or_before"
                  ? comparison <= 0
                  : comparison >= 0;
      break;
    }
    case "date_between":
    case "date_not_between": {
      const current = normalizeCalendarDate(rawValue);
      const from = normalizeCalendarDate(condition.values[0]);
      const to = normalizeCalendarDate(condition.values[1]);
      if (current === null || from === null || to === null) return false;
      const [min, max] = from <= to ? [from, to] : [to, from];
      const within = current >= min && current <= max;
      matches = condition.operator === "date_not_between" ? !within : within;
      break;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const current = toFiniteNumber(rawValue);
      const bound = toFiniteNumber(condition.values[0]);
      if (current === null || bound === null) return false;
      matches =
        condition.operator === "gt"
          ? current > bound
          : condition.operator === "gte"
            ? current >= bound
            : condition.operator === "lt"
              ? current < bound
              : current <= bound;
      break;
    }
    case "has_any_of":
    case "has_all_of":
    case "has_none_of": {
      if (!Array.isArray(rawValue)) return false;
      const entries = new Set(rawValue.map(stringifyValue));
      matches =
        condition.operator === "has_all_of"
          ? values.every((entry) => entries.has(entry))
          : condition.operator === "has_none_of"
            ? values.every((entry) => !entries.has(entry))
            : values.some((entry) => entries.has(entry));
      break;
    }
    case "between":
    case "not_between": {
      const current = toFiniteNumber(rawValue);
      const min = toFiniteNumber(condition.values[0]);
      const max = toFiniteNumber(condition.values[1]);

      if (current === null || min === null || max === null) return false;
      const within = current >= min && current <= max;
      matches = condition.operator === "not_between" ? !within : within;

      break;
    }
    default:
      return false;
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

const TABLE_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const MAX_TABLE_DATE_FORMATTERS = 32;

function getTableDateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = TABLE_DATE_FORMATTERS.get(key);
  if (cached) {
    TABLE_DATE_FORMATTERS.delete(key);
    TABLE_DATE_FORMATTERS.set(key, cached);
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, options);

  if (TABLE_DATE_FORMATTERS.size >= MAX_TABLE_DATE_FORMATTERS) {
    const oldest = TABLE_DATE_FORMATTERS.keys().next().value;
    if (oldest !== undefined) TABLE_DATE_FORMATTERS.delete(oldest);
  }

  TABLE_DATE_FORMATTERS.set(key, formatter);
  return formatter;
}

export function TableDate({
  value,
  variant = "date",
  locale = "en-GB",
  timeZone = "UTC",
  fallback = "-",
}: Readonly<TableDateProps>) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const calendarDate = typeof value === "string" && isCalendarDateKey(value);
  const date = calendarDate ? calendarDateKeyToDate(value) : parseExplicitTimestamp(value);
  if (!date) {
    return fallback;
  }

  const effectiveTimeZone = calendarDate ? "UTC" : timeZone;

  const options: Intl.DateTimeFormatOptions =
    variant === "datetime"
      ? {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: effectiveTimeZone,
        }
      : variant === "time"
        ? {
            timeStyle: "short",
            timeZone: effectiveTimeZone,
          }
        : {
            dateStyle: "medium",
            timeZone: effectiveTimeZone,
          };
  const formatted = getTableDateFormatter(locale, options).format(date);

  return (
    <time dateTime={calendarDate ? String(value) : date.toISOString()} title={formatted}>
      {formatted}
    </time>
  );
}

const EMPTY_FILTER_FIELDS: readonly FilterField[] = Object.freeze([]);

export function DataTable<TData extends RowData>({
  data,
  columns,
  rowActions = false,
  onRowAction,
  filterFields = EMPTY_FILTER_FIELDS,
  searchKeys,
  searchPlaceholder = "Search...",
  initialPageSize = 10,
  dateTimeZone = "UTC",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  enableSearch = true,
  enableFilters = true,
  enableColumnVisibility = true,
  enableColumnResizing = false,
  isLoading = false,
  loadingMessage = "Loading data...",
  emptyMessage = "No data available.",
  noResultsMessage = "No matching results.",
  filterCondition,
  getSearchValues,
  getRowId,
}: Readonly<DataTableProps<TData>>) {
  if (!Number.isInteger(initialPageSize) || initialPageSize <= 0) {
    throw new RangeError("initialPageSize must be a positive integer");
  }

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  const [search, setSearch] = useState("");

  const [filterQuery, setFilterQuery] = useState<FilterQuery>(() => createFilterQuery());
  const normalizeCalendarDate = useMemo(
    () => createCalendarDateNormalizer(dateTimeZone),
    [dateTimeZone],
  );
  const resolvedFilterCondition = useMemo(
    () =>
      filterCondition ??
      ((row: TData, condition: FlatFilterCondition) =>
        defaultFilterCondition(row, condition, normalizeCalendarDate)),
    [filterCondition, normalizeCalendarDate],
  );

  const filterIndex = useMemo(() => buildFilterIndex(filterFields), [filterFields]);
  const activeConditions = useMemo(
    () =>
      flattenFilterConditions(filterQuery, (rule) => {
        const field = getFilterField(filterIndex, rule.path);
        if (!field) return null;
        const operator = getFilterOperator(resolveFilterOperators(field), rule.operator);
        return operator ? getFilterArity(operator) : "unsupported";
      }),
    [filterQuery, filterIndex],
  );

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
        return activeConditions.every((condition) => resolvedFilterCondition(row, condition));
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
    resolvedFilterCondition,
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

  return (
    <DataGrid
      table={table}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
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
        columnsResizable: enableColumnResizing,
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
                  showClear
                />
              </div>
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
