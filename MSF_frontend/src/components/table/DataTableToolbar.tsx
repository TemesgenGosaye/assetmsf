import type * as React from "react";
import {
  AlignJustify,
  Check,
  ChevronDown,
  Download,
  Lock,
  Rows3,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ColDef, FilterDef } from "./types";

export interface DataTableToolbarProps {
  title?: string;
  searchable?: boolean;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterDef[];
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  filterOptions: Record<string, { label: string; value: string }[]>;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  dense: boolean;
  onToggleDense: () => void;
  columns: ColDef[];
  hidden: string[];
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  exportFileName?: string;
  onExport: () => void;
  className?: string;
}

export function DataTableToolbar({
  title,
  searchable,
  search,
  onSearch,
  searchPlaceholder = "Search…",
  filters,
  activeFilters,
  onFilterChange,
  filterOptions,
  toolbarLeft,
  toolbarRight,
  dense,
  onToggleDense,
  columns,
  hidden,
  onToggleColumn,
  onResetColumns,
  exportFileName,
  onExport,
  className,
}: DataTableToolbarProps) {
  const hasColumnControls = columns.length > 1;
  const hideableColumns = columns.filter(
    (col) => col.hideable && !col.pinned,
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 border-b-2 border-border bg-muted/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {title && (
          <h3 className="mr-1.5 text-sm font-bold tracking-tight text-foreground">
            {title}
          </h3>
        )}

        {searchable && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8.5 w-full max-w-xs rounded-lg border-border bg-background pl-9 pr-8 text-xs font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Search table"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {filters.map((filter) => {
          const options =
            filter.options ?? filterOptions[filter.key] ?? [];
          return (
            <select
              key={filter.key}
              value={activeFilters[filter.key] ?? ""}
              onChange={(e) => onFilterChange(filter.key, e.target.value)}
              className="h-9 rounded-full border border-border bg-background pl-3.5 pr-8 text-xs font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label={`Filter by ${filter.label}`}
            >
              <option value="">All {filter.label}s</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        })}

        {toolbarLeft}
      </div>

      <div className="flex items-center gap-1.5">
        {toolbarRight}

        {/* ── Density option ─────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border bg-background px-2.5 text-xs font-medium text-foreground/90 shadow-sm hover:bg-muted hover:text-foreground"
              aria-label="Row density"
            >
              {dense ? (
                <AlignJustify className="h-3.5 w-3.5" />
              ) : (
                <Rows3 className="h-3.5 w-3.5" />
              )}
              <span className="hidden lg:inline">Density</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Row density
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => dense && onToggleDense()}
              className="text-sm"
            >
              <Rows3 className="mr-2 h-4 w-4 text-muted-foreground" />
              Compact
              {dense && <Check className="ml-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => !dense && onToggleDense()}
              className="text-sm"
            >
              <AlignJustify className="mr-2 h-4 w-4 text-muted-foreground" />
              Comfortable
              {!dense && <Check className="ml-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasColumnControls && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-border bg-background px-2.5 text-xs font-medium text-foreground/90 shadow-sm hover:bg-muted hover:text-foreground"
                aria-label="Column options"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Columns</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground">
                Columns
                <button
                  onClick={onResetColumns}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Reset
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => {
                const checked = !hidden.includes(column.key);
                if (column.pinned) {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={true}
                      disabled
                      className="opacity-90"
                    >
                      <Lock className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  );
                }
                if (!column.hideable) {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={true}
                      disabled
                    >
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  );
                }
                return (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={checked}
                    onCheckedChange={() => onToggleColumn(column.key)}
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {hideableColumns.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No hideable columns
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {exportFileName && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-border bg-background px-2.5 text-xs font-medium text-foreground/90 shadow-sm hover:bg-muted hover:text-foreground"
            onClick={onExport}
            aria-label={`Export table as CSV (${exportFileName}.csv)`}
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Export</span>
          </Button>
        )}
      </div>
    </div>
  );
}
