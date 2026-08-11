import * as React from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  dense?: boolean;
  stickyHeader?: boolean;
  stickyFirstCol?: boolean;
  striped?: boolean;
  gridLines?: boolean;
};

// ── Table (wrapper + <table>) ──────────────────────────────────────────────
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      dense,
      stickyHeader = true,
      stickyFirstCol,
      striped,
      gridLines = true,
      ...props
    },
    ref,
  ) => (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-xl border border-border bg-card shadow-sm transition-all duration-200",
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 [&::-webkit-scrollbar-track]:bg-transparent",
        stickyHeader &&
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
        stickyFirstCol &&
          "[&_*:is(th,td):first-child]:sticky [&_*:is(th,td):first-child]:left-0 [&_*:is(th,td):first-child]:z-[1] [&_thead_th:first-child]:bg-muted [&_tbody_td:first-child]:bg-card [&_tbody_tr:hover_td:first-child]:bg-primary/[0.05] dark:[&_tbody_tr:hover_td:first-child]:bg-primary/[0.12]",
      )}
    >
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0 [font-variant-numeric:tabular-nums]",
          dense ? "text-xs" : "text-sm",
          striped && "[&_tbody_tr:nth-child(even)]:bg-muted/30",
          gridLines && "[&_th]:border-r [&_td]:border-r [&_th]:border-border/80 [&_td]:border-border/80 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

// ── TableHeader ────────────────────────────────────────────────────────────
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-muted/90 border-b-2 border-border backdrop-blur-sm select-none",
      "[&_tr]:border-0 [&_tr]:hover:bg-transparent",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

// ── TableBody ──────────────────────────────────────────────────────────────
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "divide-y divide-border/80",
      "[&_tr:last-child]:border-b-0",
      className,
    )}
    {...props}
  />
));
TableBody.displayName = "TableBody";

// ── TableRow ───────────────────────────────────────────────────────────────
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "group transition-colors duration-150 ease-in-out",
      "bg-card text-card-foreground",
      "hover:bg-primary/[0.05] dark:hover:bg-primary/[0.12]",
      "data-[state=selected]:bg-primary/[0.12] dark:data-[state=selected]:bg-primary/[0.22]",
      "border-b border-border/70 last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

// ── TableHead ──────────────────────────────────────────────────────────────
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-3.5 text-left align-middle",
      "text-[11px] font-bold text-muted-foreground",
      "whitespace-nowrap tracking-wider uppercase",
      "border-b-2 border-r border-border/80 bg-muted/90 last:border-r-0",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3.5",
      "first:pl-4 last:pr-4",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

// ── TableCell ──────────────────────────────────────────────────────────────
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3.5 py-2.5 align-middle text-[13px] text-foreground/90 font-normal",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3.5",
      "first:pl-4 last:pr-4",
      "border-r border-b border-border/70 bg-transparent last:border-r-0",
      "transition-colors group-hover:text-foreground",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

// ── TableFooter ────────────────────────────────────────────────────────────
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t-2 border-border bg-muted/60 font-semibold text-foreground",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

// ── TableCaption ───────────────────────────────────────────────────────────
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
