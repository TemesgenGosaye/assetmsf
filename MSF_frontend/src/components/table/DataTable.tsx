/**
 * DataTable — Advanced reusable table component
 * Features: sorting, column visibility, density toggle, row selection,
 * sticky header, skeleton loading, rich empty states, declarative column
 * filters, global search highlight, status badges, centralized row actions,
 * totals footer, export to CSV.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { RecordDetailSheet } from "./RecordDetailSheet";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { RowActionsMenu } from "./RowActionsMenu";
import { StatusChip } from "@/components/ui/status-chip";
import type {
  CellCtx,
  ColDef,
  DataTableProps,
  EmptyState,
  SortDir,
} from "./types";

// ── Re-exports for backward compatibility ──────────────────────────────────
export type { ColDef, DataTableProps, SortDir, CellCtx };
export type { RowAction, FilterDef } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────
function highlight(text: string, term: string) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-200/80 px-0.5 dark:bg-yellow-700/60">
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

type Prefs = { hidden: string[]; dense: boolean };

function loadPrefs(key: string): Prefs {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { hidden: [], dense: false };
}

function savePrefs(key: string, prefs: Prefs) {
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(prefs));
  } catch {}
}

function getFilterValue<T>(row: T, columns: ColDef<T>[], key: string): string {
  const col = columns.find((c) => c.key === key);
  const val = col?.value ? col.value(row) : (row as Record<string, any>)[key];
  return val == null ? "" : String(val);
}

function BadgeCell<T>({ col, row }: { col: ColDef<T>; row: T }) {
  let status: string | null | undefined;
  if (typeof col.badge === "function") {
    status = col.badge(row);
  } else if (typeof col.badge === "string") {
    status = col.badge;
  } else if (col.badge === true) {
    status = col.value
      ? col.value(row)
      : (row as Record<string, any>)[col.key];
  }
  if (status == null || status === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return <StatusChip status={String(status)} size="sm" />;
}

// ── Component ──────────────────────────────────────────────────────────────
export function DataTable<T>({
  tableKey,
  columns,
  data,
  rowKey,
  loading = false,
  title,
  emptyMessage = "No records found",
  emptyIcon,
  emptyState,
  loadingVariant = "skeleton",
  selectable = false,
  onSelectionChange,
  searchable = true,
  searchPlaceholder = "Search…",
  filters = [],
  rowActions,
  rowActionsHeader = "Actions",
  toolbarLeft,
  toolbarRight,
  exportFileName,
  pageSize = 50,
  hideToolbar = false,
  className,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onSort,
  onRowClick,
  onRowDoubleClick,
  recordDetail,
  expandable,
}: DataTableProps<T>) {
  // ── Prefs (dense, hidden cols) ─────────────────────────────────────────
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs(tableKey));
  const updatePrefs = useCallback(
    (patch: Partial<Prefs>) => {
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
        setIntSortDir((prev) =>
          activeSortKey !== key
            ? "asc"
            : prev === "asc"
              ? "desc"
              : prev === "desc"
                ? null
                : "asc",
        );
        setIntSortKey(key);
      }
    },
    [activeSortKey, activeSortDir, onSort],
  );

  // ── Search ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // ── Declarative column filters ────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    {},
  );
  const filterOptions = useMemo(() => {
    const options: Record<string, { label: string; value: string }[]> = {};
    for (const filter of filters) {
      if (filter.options) {
        options[filter.key] = filter.options;
        continue;
      }
      const seen = new Set<string>();
      const values: { label: string; value: string }[] = [];
      for (const row of data) {
        const value = getFilterValue(row, columns, filter.key);
        if (value && !seen.has(value)) {
          seen.add(value);
          values.push({ label: value, value });
        }
      }
      values.sort((a, b) => a.label.localeCompare(b.label));
      options[filter.key] = values;
    }
    return options;
  }, [filters, data, columns]);

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

  const resetColumns = useCallback(() => {
    updatePrefs({ hidden: [] });
  }, [updatePrefs]);

  const toggleColumn = useCallback(
    (key: string) => {
      updatePrefs({
        hidden: hidden.includes(key)
          ? hidden.filter((h) => h !== key)
          : [...hidden, key],
      });
    },
    [hidden, updatePrefs],
  );

  // ── Filtered + sorted data ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = data;
    const active = Object.entries(activeFilters).filter(
      ([, value]) => value !== "",
    );
    if (active.length > 0) {
      rows = rows.filter((row) =>
        active.every(
          ([key, value]) => getFilterValue(row, columns, key) === value,
        ),
      );
    }
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
  }, [data, search, activeFilters, activeSortKey, activeSortDir, columns]);

  const toggleAll = useCallback(() => {
    const ids = filtered.map((r) => rowKey(r));
    setSelected((prev) =>
      prev.size === ids.length && ids.length > 0
        ? new Set()
        : new Set(ids),
    );
  }, [filtered, rowKey]);

  // ── Pagination ────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);
  const effectivePageSize = pageSizeState > 0 ? pageSizeState : pageSize;
  const totalPages =
    effectivePageSize > 0
      ? Math.max(1, Math.ceil(filtered.length / effectivePageSize))
      : 1;
  const paged =
    effectivePageSize > 0
      ? filtered.slice((page - 1) * effectivePageSize, page * effectivePageSize)
      : filtered;

  // reset page when filter/search/page-size changes
  useEffect(() => {
    setPage(1);
  }, [search, activeFilters, effectivePageSize, data]);

  const safePage = Math.min(page, Math.max(totalPages, 1));
  const start = filtered.length === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const end = Math.min(safePage * effectivePageSize, filtered.length);

  const cellCtx: CellCtx = { dense };
  const rowHeight = dense ? "h-8" : "h-9";
  const textSize = dense ? "text-xs" : "text-[13px]";
  const px = dense ? "px-2.5" : "px-3";

  const hasRowActions = !!rowActions;
  const hasExpandable = !!expandable;
  const cellCount =
    visibleColumns.length + (selectable ? 1 : 0) + (hasRowActions ? 1 : 0) + (hasExpandable ? 1 : 0);

  const resolvedEmptyState: EmptyState = emptyState ?? {
    icon: emptyIcon ?? <Search className="h-10 w-10 opacity-20" />,
    title: emptyMessage,
    description: search
      ? "Try a different search term or clear the filters."
      : undefined,
  };

  const interactiveRow = !!(onRowClick || recordDetail || onRowDoubleClick);
  
  // ── Expandable rows state ─────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(expandable?.defaultExpanded ?? []));
  
  const toggleRowExpansion = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRowClick = (row: T, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, label, [role='checkbox']")) {
      return;
    }
    onRowClick(row);
  };

  const hasTotals = columns.some((c) => c.footer);

  return (
    <div
      className={cn(
        "group/table flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      {!hideToolbar && (
        <DataTableToolbar
          title={title}
          searchable={searchable}
          search={search}
          onSearch={setSearch}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          activeFilters={activeFilters}
          onFilterChange={(key, value) =>
            setActiveFilters((prev) => ({ ...prev, [key]: value }))
          }
          filterOptions={filterOptions}
          toolbarLeft={toolbarLeft}
          toolbarRight={toolbarRight}
          dense={dense}
          onToggleDense={() => updatePrefs({ dense: !dense })}
          columns={columns}
          hidden={hidden}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
          exportFileName={exportFileName}
          onExport={() => downloadCsv(toCsv(columns, filtered), exportFileName!)}
        />
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full caption-bottom border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className={cn(
                    "w-10 border-b-2 border-r border-border bg-muted pl-4 pr-2",
                    rowHeight,
                  )}
                >
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      selected.size > 0 &&
                      filtered.every((r) => selected.has(rowKey(r)))
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                    className="translate-y-px"
                  />
                </th>
              )}
               {hasExpandable && (
                 <th
                   scope="col"
                   className={cn(
                     "w-10 border-b-2 border-r border-border bg-muted",
                     rowHeight,
                   )}
                 />
               )}
               {visibleColumns.map((col, i) => (
                 <th
                   key={col.key}
                   scope="col"
                   aria-sort={
                     activeSortKey === col.key
                       ? activeSortDir === "asc"
                         ? "ascending"
                         : activeSortDir === "desc"
                           ? "descending"
                           : "none"
                       : undefined
                   }
                   className={cn(
                     "select-none whitespace-nowrap border-b-2 border-r border-border bg-muted align-middle text-[11px] font-bold uppercase tracking-wider text-muted-foreground last:border-r-0",
                     rowHeight,
                     px,
                     col.align === "right"
                       ? "text-right"
                       : col.align === "center"
                         ? "text-center"
                         : "text-left",
                     col.sortable &&
                       "cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-foreground",
                     col.width,
                     i === 0 && !selectable && !hasExpandable && "pl-4",
                     i === visibleColumns.length - 1 && "pr-4",
                   )}
                   onClick={() => col.sortable && handleSort(col.key)}
                 >
                   {col.sortable ? (
                     <button
                       type="button"
                       className="inline-flex items-center gap-1.5 uppercase tracking-wider outline-none"
                     >
                       {col.header}
                       {activeSortKey === col.key ? (
                         activeSortDir === "asc" ? (
                           <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
                         ) : activeSortDir === "desc" ? (
                           <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                         ) : (
                           <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
                         )
                       ) : (
                         <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
                       )}
                     </button>
                   ) : (
                     <span className="inline-flex items-center gap-1.5 uppercase tracking-wider">
                       {col.header}
                     </span>
                   )}
                 </th>
               ))}
               {hasRowActions && (
                 <th
                   scope="col"
                   className={cn(
                     "border-b-2 border-l border-border bg-muted pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
                     rowHeight,
                   )}
                 >
                   {rowActionsHeader}
                 </th>
               )}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {loading && loadingVariant === "spinner" ? (
              <tr>
                <td
                  colSpan={cellCount}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
                    <p className="text-sm">Loading…</p>
                  </div>
                </td>
              </tr>
            ) : loading ? (
              Array.from({ length: 6 }).map((_, ri) => (
                <tr key={`skeleton-${ri}`} className="bg-background">
                  {selectable && (
                    <td className={cn("w-10 border-r border-border pl-4 pr-2", rowHeight)}>
                      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                    </td>
                  )}
                  {visibleColumns.map((col, ci) => (
                    <td key={col.key} className={cn(textSize, rowHeight, px, col.align === "right" ? "text-right" : "text-left", col.width, "border-r border-border last:border-r-0")}>
                      <div
                        className={cn(
                          "h-3.5 animate-pulse rounded-full bg-muted",
                          ci % 3 === 0 ? "w-3/4" : ci % 3 === 1 ? "w-1/2" : "w-2/3",
                        )}
                      />
                    </td>
                  ))}
                  {hasRowActions && (
                    <td className={cn("border-l border-border pr-3 text-right", rowHeight)}>
                      <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-muted" />
                    </td>
                  )}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={cellCount} className="px-4 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/70">
                      {resolvedEmptyState.icon}
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {resolvedEmptyState.title}
                    </p>
                    {resolvedEmptyState.description && (
                      <p className="text-xs text-muted-foreground/80">
                        {resolvedEmptyState.description}
                      </p>
                    )}
                    {resolvedEmptyState.action}
                  </div>
                </td>
              </tr>
             ) : (
               paged.map((row) => {
                 const id = rowKey(row);
                 const isSelected = selected.has(id);
                 const actions = rowActions?.(row);
                 const isExpanded = expandedRows.has(id);
                 
                 return (
                   <>
                     <tr
                       key={id}
                       onClick={(e) => handleRowClick(row, e)}
                       onDoubleClick={() => {
                         if (recordDetail) {
                           setDetailRecord(row);
                           setDetailOpen(true);
                         }
                         onRowDoubleClick?.(row);
                       }}
                       tabIndex={interactiveRow ? 0 : undefined}
                       onKeyDown={
                         interactiveRow
                           ? (e) => {
                               if (e.key === "Enter") {
                                 if (recordDetail) {
                                   setDetailRecord(row);
                                   setDetailOpen(true);
                                 }
                                 onRowClick?.(row);
                               }
                             }
                           : undefined
                       }
                       data-state={isSelected ? "selected" : undefined}
                       className={cn(
                         "group transition-colors duration-100",
                         "bg-background",
                         isSelected
                           ? "bg-blue-100/70 dark:bg-blue-500/20 hover:bg-blue-100/80 dark:hover:bg-blue-500/25"
                           : "hover:bg-blue-50 dark:hover:bg-blue-500/15",
                         interactiveRow && "cursor-pointer",
                       )}
                     >
                       {hasExpandable && (
                         <td className={cn("w-10 border-r border-border", rowHeight)}>
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleRowExpansion(id);
                             }}
                             className="flex h-full w-full items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                             aria-label={isExpanded ? "Collapse row" : "Expand row"}
                           >
                             {isExpanded ? (
                               <ChevronUp className="h-4 w-4 shrink-0" />
                             ) : (
                               <ChevronDown className="h-4 w-4 shrink-0" />
                             )}
                           </button>
                         </td>
                       )}
                       {selectable && (
                         <td className={cn("w-10 border-r border-border pl-4 pr-2", rowHeight)}>
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
                             "border-r border-border align-middle text-foreground/90 last:border-r-0",
                             col.align === "right"
                               ? "text-right"
                               : col.align === "center"
                                 ? "text-center"
                                 : "text-left",
                             col.width,
                             ci === 0 && !selectable && !hasExpandable && "pl-4",
                             ci === visibleColumns.length - 1 && "pr-4",
                           )}
                         >
                           {col.cell ? (
                             col.cell(row, cellCtx)
                           ) : col.badge !== undefined ? (
                             <BadgeCell col={col} row={row} />
                           ) : col.value ? (
                             (() => {
                               const val = col.value(row);
                               return val == null ? (
                                 <span className="text-muted-foreground/50">—</span>
                               ) : search ? (
                                 <span className="font-medium leading-5 text-foreground">
                                   {highlight(String(val), search)}
                                 </span>
                               ) : (
                                 <span className="font-medium leading-5 text-foreground">
                                   {String(val)}
                                 </span>
                               );
                             })()
                           ) : null}
                         </td>
                       ))}
                       {hasRowActions && (
                         <td className={cn("border-l border-border pr-3 text-right", rowHeight)}>
                           {actions && actions.length > 0 && (
                             <RowActionsMenu row={row} actions={actions} />
                           )}
                         </td>
                       )}
                     </tr>
                     {hasExpandable && isExpanded && (
                       <tr key={`${id}-expanded`} className="bg-muted/50">
                         <td colSpan={cellCount} className="p-4">
                           {expandable.expandableContent(row)}
                         </td>
                       </tr>
                     )}
                   </>
                 );
               })
             )}
          </tbody>

          {hasTotals && !loading && filtered.length > 0 && (
            <tfoot className="bg-muted/40">
              <tr>
                {selectable && (
                  <td className={cn("w-10 border-r border-border pl-4 pr-2", rowHeight)} />
                )}
                {visibleColumns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "border-t-2 border-r border-border font-semibold text-foreground last:border-r-0",
                      textSize,
                      rowHeight,
                      px,
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left",
                      i === 0 && !selectable && "pl-4",
                    )}
                  >
                    {col.footer ? col.footer(filtered) : ""}
                  </td>
                ))}
                {hasRowActions && (
                  <td className={cn("border-l border-border pr-3", rowHeight)} />
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Footer: count + pagination ─────────────────────────────── */}
      {!loading && filtered.length > 0 && effectivePageSize > 0 && (
        <DataTablePagination
          currentPage={safePage}
          totalPages={totalPages}
          start={start}
          end={end}
          total={filtered.length}
          pageSize={effectivePageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSizeState(size);
            setPage(1);
          }}
          selectedCount={selected.size}
        />
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
