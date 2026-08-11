import type * as React from "react";
import type { LucideIcon } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

export type CellCtx = {
  dense: boolean;
};

/** A single row action rendered in the auto-generated actions column */
export type RowAction<T = any> = {
  label: string;
  icon?: LucideIcon;
  onClick?: (row: T) => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  /** Render a separator above this action */
  separator?: boolean;
  /** Hide this action (useful for conditional actions) */
  hidden?: boolean;
};

/** A declarative column filter rendered as a select in the toolbar */
export type FilterDef<T = any> = {
  /** Column key this filter applies to */
  key: string;
  /** Label shown in the select placeholder */
  label: string;
  /** Explicit options. When omitted, options are derived from the column's value across all data. */
  options?: { label: string; value: string }[];
};

export type ColDef<T = any> = {
  key: string;
  header: string;
  /** Width hint e.g. "w-32", "min-w-[180px]" */
  width?: string;
  /** Can this column be sorted? Default false */
  sortable?: boolean;
  /** Can this column be hidden? Default true */
  hideable?: boolean;
  /** Hidden by default? */
  defaultHidden?: boolean;
  /** Always show (cannot be hidden) */
  pinned?: boolean;
  /** Right-align cell content */
  align?: "left" | "center" | "right";
  /** Render function; receives row data */
  cell?: (row: T, ctx: CellCtx) => React.ReactNode;
  /** Value accessor for CSV export / search */
  value?: (row: T) => string | number | null | undefined;
  /**
   * Render a consistent status badge in this cell.
   * - `true`    → derive from `value` (or the raw field)
   * - `string`  → static status for every row
   * - function  → return the status string for the given row
   */
  badge?: boolean | string | ((row: T) => string | null | undefined);
  /** Aggregate footer for this column (renders a totals row) */
  footer?: (rows: T[]) => React.ReactNode;
};

export type EmptyState = {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export type DataTableProps<T = any> = {
  /** Unique key for persisting preferences */
  tableKey: string;
  columns: ColDef<T>[];
  data: T[];
  /** Row unique key accessor */
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Optional title shown in the toolbar */
  title?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** Richer empty state (takes priority over emptyMessage/emptyIcon) */
  emptyState?: EmptyState;
  /** "skeleton" shows shimmer rows while loading, "spinner" a centered loader */
  loadingVariant?: "skeleton" | "spinner";
  /** Show checkbox column for row selection */
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  /** Show global search bar inside the table toolbar */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Declarative column filters rendered in the toolbar */
  filters?: FilterDef<T>[];
  /** Centralized row actions rendered as a trailing actions column */
  rowActions?: (row: T) => RowAction<T>[];
  /** Label for the auto-generated row-actions column header */
  rowActionsHeader?: string;
  /** Extra toolbar content (buttons etc.) placed left of column/density controls */
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  /** CSV export file name (no extension) */
  exportFileName?: string;
  /** Client-side page size (0 = no pagination) */
  pageSize?: number;
  /** Hide the toolbar entirely */
  hideToolbar?: boolean;
  /** Class applied to the outer wrapper */
  className?: string;
  /** Controlled sort */
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string, dir: SortDir) => void;
  /** Called when a data row is clicked (ignored for interactive cells) */
  onRowClick?: (row: T) => void;
  /** Called when a data row is double-clicked */
  onRowDoubleClick?: (row: T) => void;
   /**
    * Auto-wire double-click to open a RecordDetailSheet.
    * When provided, the detail sheet is managed internally.
    * `onRowDoubleClick` still fires alongside if also set.
    */
   recordDetail?: {
     title?: string | ((row: T) => string);
     subtitle?: string | ((row: T) => string);
     icon?: React.ElementType;
     badge?: ((row: T) => React.ReactNode) | React.ReactNode;
   };
   /**
    * Enable expandable rows. When provided, a chevron column is added,
    * and the `expandableContent` function renders the expanded row content.
    */
   expandable?: {
     /** Render the content for the expanded row */
     expandableContent: (row: T) => React.ReactNode;
     /** Initial expanded row IDs (optional) */
     defaultExpanded?: string[];
   };
  /** Enable subtle zebra striping on alternating rows */
  striped?: boolean;
  /** Force solid grid lines between cells (defaults to true for enterprise layout) */
  gridLines?: boolean;
};

