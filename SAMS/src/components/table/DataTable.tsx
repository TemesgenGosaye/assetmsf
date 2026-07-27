/**
 * DataTable — Advanced reusable table component
 * Features: sorting, column visibility, density toggle, row selection,
 * sticky header, zebra rows, loading/empty states, pagination controls,
 * global search highlight, export to CSV.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Settings2,
  Download,
  Rows3,
  AlignJustify,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RecordDetailSheet } from "./RecordDetailSheet";

// ── Types ──────────────────────────────────────────────────────────────────
export type SortDir = "asc" | "desc" | null;

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
};

type CellCtx = {
  dense: boolean;
};

export type DataTableProps<T = any> = {
  /** Unique key for persisting preferences */
  tableKey: string;
  columns: ColDef<T>[];
  data: T[];
  /** Row unique key accessor */
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** Show checkbox column for row selection */
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  /** Show global search bar inside the table toolbar */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Extra toolbar content (buttons etc.) placed left of column/density controls */
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  /** CSV export file name (no extension) */
  exportFileName?: string;
  /** Client-side page size (0 = no pagination) */
  pageSize?: number;
  /** Class applied to the outer wrapper */
  className?: string;
  /** Controlled sort */
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string, dir: SortDir) => void;
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
};

// ── Helpers ────────────────────────────────────────────────────────────────
function highlight(text: string, term: string) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 rounded-sm px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function toCsv(columns: ColDef[], rows: any[]): string {
  const visibleCols = columns.filter((c) => !c.defaultHidden);
  const headers = visibleCols
    .map((c) => `"${c.header.replace(/"/g, '""')}"`)
    .join(",");
  const body = rows
    .map((row) =>
      visibleCols
        .map((c) => {
          const raw = c.value ? c.value(row) : "";
          const str = raw == null ? "" : String(raw);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${headers}\n${body}`;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

const LS_PREFIX = "dt:";

function loadPrefs(key: string): { hidden: string[]; dense: boolean } {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { hidden: [], dense: false };
}

function savePrefs(key: string, prefs: { hidden: string[]; dense: boolean }) {
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(prefs));
  } catch {}
}

// ── Component ──────────────────────────────────────────────────────────────
export function DataTable<T>({
  tableKey,
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found",
  emptyIcon,
  selectable = false,
  onSelectionChange,
  searchable = true,
  searchPlaceholder = "Search…",
  toolbarLeft,
  toolbarRight,
  exportFileName,
  pageSize = 50,
  className,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onSort,
  onRowDoubleClick,
  recordDetail,
}: DataTableProps<T>) {
  // ── Prefs (dense, hidden cols) ─────────────────────────────────────────
  const [prefs, setPrefsState] = useState(() => loadPrefs(tableKey));
  const updatePrefs = useCallback(
    (patch: Partial<{ hidden: string[]; dense: boolean }>) => {
      setPrefsState((prev) => {
        const next = { ...prev, ...patch };
        savePrefs(tableKey, next);
        return next;
      });
    },
    [tableKey],
  );
  const { dense, hidden } = prefs;

  // ── Record detail sheet state ─────────────────────────────────────────
  const [detailRecord, setDetailRecord] = useState<T | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Internal sort state (uncontrolled) ────────────────────────────────
  const [intSortKey, setIntSortKey] = useState<string | null>(null);
  const [intSortDir, setIntSortDir] = useState<SortDir>(null);
  const activeSortKey = controlledSortKey ?? intSortKey;
  const activeSortDir = controlledSortDir ?? intSortDir;

  const handleSort = useCallback(
    (key: string) => {
      if (onSort) {
        const next: SortDir =
          activeSortKey === key
            ? activeSortDir === "asc"
              ? "desc"
              : activeSortDir === "desc"
                ? null
                : "asc"
            : "asc";
        onSort(key, next);
      } else {
        setIntSortKey((prev) => {
          if (prev !== key) {
            setIntSortDir("asc");
            return key;
          }
          return key;
        });
        setIntSortDir((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
        );
      }
    },
    [activeSortKey, activeSortDir, onSort],
  );

  // ── Search ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Selection ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleRow = useCallback((id: string, row: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    const ids = data.map((r) => rowKey(r));
    setSelected((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }, [data, rowKey]);

  // Notify parent — must be useEffect, never useMemo, to avoid setState-during-render
  const prevSelectedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (onSelectionChange && selected !== prevSelectedRef.current) {
      prevSelectedRef.current = selected;
      onSelectionChange(data.filter((r) => selected.has(rowKey(r))));
    }
  }, [selected, data, rowKey, onSelectionChange]);

  // ── Visible columns ───────────────────────────────────────────────────
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.pinned || !hidden.includes(c.key)),
    [columns, hidden],
  );

  const hideableCols = useMemo(
    () => columns.filter((c) => !c.pinned),
    [columns],
  );

  // ── Filtered + sorted data ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = data;
    if (term) {
      rows = rows.filter((row) =>
        columns.some((c) => {
          const val = c.value ? c.value(row) : null;
          return val != null && String(val).toLowerCase().includes(term);
        }),
      );
    }
    if (activeSortKey && activeSortDir) {
      const col = columns.find((c) => c.key === activeSortKey);
      rows = [...rows].sort((a, b) => {
        const av = col?.value ? (col.value(a) ?? "") : "";
        const bv = col?.value ? (col.value(b) ?? "") : "";
        const cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
        });
        return activeSortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, activeSortKey, activeSortDir, columns]);

  // ── Pagination ────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const totalPages =
    pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const paged =
    pageSize > 0
      ? filtered.slice((page - 1) * pageSize, page * pageSize)
      : filtered;

  // reset page when filter changes
  useEffect(() => setPage(1), [filtered.length, search]);

  const cellCtx: CellCtx = { dense };
  const rowHeight = dense ? "h-8" : "h-10";
  const textSize = dense ? "text-xs" : "text-sm";
  const px = dense ? "px-3" : "px-4";

  return (
    <div
      className={cn(
        "group/table flex flex-col overflow-hidden border border-border bg-card dark:border-border dark:bg-card shadow-sm",
        className,
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-b border-border dark:border-border bg-muted dark:bg-muted px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {searchable && (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                 className="h-8 rounded-sm border-border dark:border-border bg-card dark:bg-card pl-8 pr-7 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {toolbarLeft}
        </div>
        <div className="flex items-center gap-1.5">
          {toolbarRight}
          {/* Density toggle */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-sm p-0 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            title={dense ? "Comfortable view" : "Compact view"}
            onClick={() => updatePrefs({ dense: !dense })}
          >
            {dense ? (
              <AlignJustify className="h-4 w-4" />
            ) : (
              <Rows3 className="h-4 w-4" />
            )}
          </Button>
          {/* Column chooser */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-sm p-0 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Toggle columns"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-sm border-slate-300 dark:border-border"
            >
              <DropdownMenuLabel className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableCols.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={!hidden.includes(c.key)}
                  onCheckedChange={(v) => {
                    const next = v
                      ? hidden.filter((h) => h !== c.key)
                      : [...hidden, c.key];
                    updatePrefs({ hidden: next });
                  }}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Export CSV */}
          {exportFileName && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 rounded-sm p-0 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Export CSV"
              onClick={() =>
                downloadCsv(toCsv(columns, filtered), exportFileName)
              }
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full caption-bottom border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted dark:border-border dark:bg-muted">
            <tr>
              {selectable && (
                <th className={cn("w-10 pl-4", rowHeight)}>
                  <Checkbox
                    checked={selected.size > 0 && selected.size === data.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    className="translate-y-px"
                  />
                </th>
              )}
              {visibleColumns.map((col, i) => (
                <th
                  key={col.key}
                  className={cn(
                     "select-none whitespace-nowrap border-b border-r border-border bg-muted text-[11px] font-medium text-slate-700 dark:border-border dark:bg-muted dark:text-slate-200 last:border-r-0",
                    "align-middle",
                    rowHeight,
                    px,
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left",
                    col.sortable &&
                      "cursor-pointer hover:text-foreground transition-colors",
                    col.width,
                    i === 0 && !selectable && "pl-5",
                    i === visibleColumns.length - 1 && "pr-5",
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (activeSortKey === col.key ? (
                        activeSortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
                        ) : activeSortDir === "desc" ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <p className={textSize}>Loading…</p>
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    {emptyIcon ?? <Search className="h-10 w-10 opacity-20" />}
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {search && (
                      <p className="text-xs">
                        Try a different search term or clear the filter.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, ri) => {
                const id = rowKey(row);
                const isSelected = selected.has(id);
                return (
                  <tr
                    key={id}
                    onDoubleClick={() => {
                      if (recordDetail) {
                        setDetailRecord(row);
                        setDetailOpen(true);
                      }
                      onRowDoubleClick?.(row);
                    }}
                    className={cn(
                      "group transition-colors duration-100",
                      "bg-card dark:bg-card",
                      isSelected && "bg-muted dark:bg-muted",
                      "hover:bg-muted dark:hover:bg-muted",
                      onRowDoubleClick && "cursor-pointer select-none",
                    )}
                  >
                    {selectable && (
                      <td className={cn("w-10 pl-4", rowHeight)}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(id, row)}
                          aria-label="Select row"
                          className="translate-y-px"
                        />
                      </td>
                    )}
                    {visibleColumns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={cn(
                          textSize,
                          rowHeight,
                          px,
                          "border-b border-r border-slate-200 dark:border-border last:border-r-0",
                          "text-slate-700 dark:text-slate-200",
                          "align-middle",
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left",
                          col.width,
                          ci === 0 && !selectable && "pl-5",
                          ci === visibleColumns.length - 1 && "pr-5",
                        )}
                      >
                        {col.cell
                          ? col.cell(row, cellCtx)
                          : col.value
                            ? (() => {
                                const val = col.value(row);
                                return val == null ? (
                                  <span className="text-muted-foreground/50">
                                    —
                                  </span>
                                ) : search ? (
                                  <span className="font-medium text-slate-800 dark:text-slate-100 leading-5">
                                    {highlight(String(val), search)}
                                  </span>
                                ) : (
                                  <span className="font-medium text-slate-800 dark:text-slate-100 leading-5">
                                    {String(val)}
                                  </span>
                                );
                              })()
                            : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: count + pagination ─────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-border dark:border-border bg-muted dark:bg-muted px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
          <span>
            {selected.size > 0 && (
              <span className="font-semibold text-foreground mr-2">
                {selected.size} selected ·
              </span>
            )}
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {search && ` (filtered from ${data.length})`}
          </span>
          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1 rounded-sm border border-border dark:border-border bg-card dark:bg-card p-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-sm"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 text-slate-700 dark:text-slate-200 tabular-nums text-xs">
                Page {page} / {totalPages}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-sm"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Record Detail Sheet ──────────────────────────────────────── */}
      {recordDetail && (
        <RecordDetailSheet<T>
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailRecord(null);
          }}
          record={detailRecord}
          columns={columns}
          title={recordDetail.title}
          subtitle={recordDetail.subtitle}
          icon={recordDetail.icon}
          badge={recordDetail.badge}
        />
      )}
    </div>
  );
}

export default DataTable;

