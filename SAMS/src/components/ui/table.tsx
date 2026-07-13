import * as React from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  dense?: boolean;
  stickyHeader?: boolean;
  stickyFirstCol?: boolean;
};

// ── Table (wrapper + <table>) ──────────────────────────────────────────────
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, dense, stickyHeader, stickyFirstCol, ...props }, ref) => (
    <div
      className={cn(
        "relative w-full overflow-auto border border-slate-300/90 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-sm",
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 [&::-webkit-scrollbar-track]:bg-transparent",
        stickyHeader &&
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
        stickyFirstCol &&
          "[&_*:is(th,td):first-child]:sticky [&_*:is(th,td):first-child]:left-0 [&_*:is(th,td):first-child]:z-[1] [&_thead_th:first-child]:bg-slate-100/95 dark:[&_thead_th:first-child]:bg-slate-900 [&_tbody_td:first-child]:bg-white dark:[&_tbody_td:first-child]:bg-slate-950",
      )}
    >
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0",
          dense ? "text-xs" : "text-sm",
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
      "bg-slate-100/95 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700",
      "[&_tr]:border-0",
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
      "divide-y divide-slate-200 dark:divide-slate-800",
      "[&_tr:last-child]:border-0",
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
      "group transition-colors duration-100",
      "border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950",
      "hover:bg-sky-50 dark:hover:bg-slate-900/90",
      "data-[state=selected]:bg-sky-100/80 dark:data-[state=selected]:bg-slate-800",
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
      "h-8 px-3 text-left align-middle",
      "text-[11px] font-medium text-slate-700 dark:text-slate-200",
      "whitespace-nowrap tracking-normal",
      "border-b border-r border-slate-300 dark:border-slate-700 bg-slate-100/95 dark:bg-slate-900 last:border-r-0",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3",
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
      "px-3 py-1.5 align-middle text-[13px] text-slate-700 dark:text-slate-200",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3",
      "first:pl-4 last:pr-4",
      "border-r border-slate-200 dark:border-slate-800 bg-transparent last:border-r-0",
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
      "border-t border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium",
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
    className={cn("mt-4 text-sm text-muted-foreground", className)}
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
