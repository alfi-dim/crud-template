import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { DataGridFeatures } from "~/components/reui/data-grid/data-grid";

export type DataTableRow<TData extends RowData> = Row<DataGridFeatures, TData>;

export type RowActionContext<TData extends RowData> = Readonly<{
  actionId: string;
  row: DataTableRow<TData>;
  original: TData;
}>;

export type RowActionHandler<TData extends RowData> = (
  context: RowActionContext<TData>,
) => void | Promise<void>;

type Resolvable<TData extends RowData, TValue> = TValue | ((row: TData) => TValue);

export type DataTableRowAction<TData extends RowData> = Readonly<{
  id: string;
  label: Resolvable<TData, React.ReactNode>;
  icon?: Resolvable<TData, React.ReactNode>;
  variant?: "default" | "destructive";
  separatorBefore?: boolean;
  hidden?: Resolvable<TData, boolean>;
  disabled?: Resolvable<TData, boolean>;
  className?: string;
  onSelect?: RowActionHandler<TData>;
}>;

type RowActionOverride<TData extends RowData> = Readonly<
  Partial<Omit<DataTableRowAction<TData>, "id">>
>;

export type DataTableRowActionsConfig<TData extends RowData> = Readonly<{
  /** Include the shared Detail action. Defaults to true. */
  defaults?: boolean;

  /** Patch or remove an existing action by ID. Use false to remove it. */
  overrides?: Readonly<Record<string, RowActionOverride<TData> | false | undefined>>;

  /** Actions appended after the defaults. */
  additional?: readonly DataTableRowAction<TData>[];

  /** Accessible label for the trigger. Defaults to TanStack's row ID. */
  getRowLabel?: (row: TData) => string;

  align?: "start" | "center" | "end";
  columnSize?: number;
}>;

export type DataTableRowActions<TData extends RowData> = boolean | DataTableRowActionsConfig<TData>;

type DataTableRowActionsMenuProps<TData extends RowData> = Readonly<{
  row: DataTableRow<TData>;
  config: DataTableRowActions<TData>;
  onRowAction?: RowActionHandler<TData>;
}>;

const DEFAULT_COLUMN_SIZE = 60;

function getDefaultActions<TData extends RowData>(): readonly DataTableRowAction<TData>[] {
  return [
    {
      id: "detail",
      label: "Detail",
    },
  ];
}

function normalizeConfig<TData extends RowData>(
  config: DataTableRowActions<TData>,
): DataTableRowActionsConfig<TData> {
  return config === true ? {} : config === false ? { defaults: false } : config;
}

function resolveValue<TData extends RowData, TValue>(
  value: Resolvable<TData, TValue> | undefined,
  row: TData,
): TValue | undefined {
  return typeof value === "function" ? (value as (item: TData) => TValue)(row) : value;
}

function resolveActions<TData extends RowData>(
  config: DataTableRowActionsConfig<TData>,
): readonly DataTableRowAction<TData>[] {
  const defaults = config.defaults === false ? [] : getDefaultActions<TData>();

  const resolvedDefaults = defaults.flatMap((action) => {
    const override = config.overrides?.[action.id];

    if (override === false) return [];

    return [
      {
        ...action,
        ...override,
        id: action.id,
      },
    ];
  });

  return [...resolvedDefaults, ...(config.additional ?? [])];
}

export function DataTableRowActionsMenu<TData extends RowData>({
  row,
  config: configProp,
  onRowAction,
}: DataTableRowActionsMenuProps<TData>) {
  const config = normalizeConfig(configProp);
  const actions = resolveActions(config).filter(
    (action) =>
      !resolveValue(action.hidden, row.original) && Boolean(action.onSelect ?? onRowAction),
  );

  if (actions.length === 0) return null;

  const rowLabel = config.getRowLabel?.(row.original) ?? row.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="shadow-none"
            aria-label={`Actions for ${rowLabel}`}
          />
        }
      >
        <EllipsisIcon size={16} aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={config.align ?? "end"}>
        <DropdownMenuGroup>
          {actions.map((action, index) => {
            const label = resolveValue(action.label, row.original);
            const icon = resolveValue(action.icon, row.original);
            const hasHandler = Boolean(action.onSelect ?? onRowAction);
            const disabled = Boolean(resolveValue(action.disabled, row.original)) || !hasHandler;

            const handleSelect = () => {
              const handler = action.onSelect ?? onRowAction;
              if (!handler) return;

              void handler({
                actionId: action.id,
                row,
                original: row.original,
              });
            };

            return (
              <React.Fragment key={action.id}>
                {action.separatorBefore && index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  disabled={disabled}
                  variant={action.variant}
                  className={action.className}
                  onClick={handleSelect}
                >
                  {icon}
                  {label}
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function createDataTableRowActionsColumn<TData extends RowData>({
  rowActions,
  onRowAction,
}: Readonly<{
  rowActions: DataTableRowActions<TData>;
  onRowAction?: RowActionHandler<TData>;
}>): ColumnDef<DataGridFeatures, TData, unknown> {
  const config = normalizeConfig(rowActions);

  return {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <DataTableRowActionsMenu row={row} config={config} onRowAction={onRowAction} />
    ),
    size: config.columnSize ?? DEFAULT_COLUMN_SIZE,
    enableHiding: false,
    enableSorting: false,
    enableResizing: false,
  };
}
