import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedCount?: number;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  start,
  end,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedCount = 0,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: DataTablePaginationProps) {
  const rowsLabelId = "rows-per-page-label";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border bg-muted/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        {selectedCount > 0 && (
          <span className="mr-1.5 font-semibold text-foreground">
            {selectedCount} selected
            <span aria-hidden> · </span>
          </span>
        )}
        Showing{" "}
        <span className="font-medium text-foreground/80">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="font-medium text-foreground/80">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label
            id={rowsLabelId}
            className="text-xs text-muted-foreground"
          >
            Rows per page:
          </label>
          <select
            aria-labelledby={rowsLabelId}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-full border border-border bg-background pl-3 pr-7 text-xs font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium text-foreground/80">
              {currentPage}
            </span>{" "}
            of {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || totalPages === 0}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || totalPages === 0}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
