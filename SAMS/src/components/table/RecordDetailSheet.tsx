import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Copy, Check } from "lucide-react";
import type { ColDef } from "./DataTable";

export interface RecordDetailSheetProps<T> {
  open: boolean;
  onClose: () => void;
  record: T | null;
  columns: ColDef<T>[];
  title?: string | ((record: T) => string);
  subtitle?: string | ((record: T) => string);
  icon?: React.ElementType;
  badge?: React.ReactNode | ((record: T) => React.ReactNode);
  footer?: React.ReactNode | ((record: T) => React.ReactNode);
}

function CopyableValue({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore, copy icon is a convenience, not a promise
    }
  }, [text]);

  return (
    <span className="group/value inline-flex items-center gap-1.5 max-w-full">
      <span className="break-words">{text}</span>
      <button
        onClick={handleCopy}
        aria-label={`Copy ${text}`}
        className="shrink-0 opacity-0 group-hover/value:opacity-100 focus-visible:opacity-100 transition-opacity rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

export function RecordDetailSheet<T extends Record<string, any>>({
  open,
  onClose,
  record,
  columns,
  title,
  subtitle,
  icon: Icon,
  badge,
  footer,
}: RecordDetailSheetProps<T>) {
  if (!record) return null;

  const displayColumns = columns.filter((c) => c.key !== "_" && !c.key.startsWith("__"));

  const resolvedTitle = typeof title === "function" ? title(record) : title;
  const autoTitle =
    resolvedTitle ??
    (() => {
      const pinnedCol = displayColumns.find((c) => c.pinned);
      if (pinnedCol) {
        const v = pinnedCol.value ? pinnedCol.value(record) : record[pinnedCol.key as string];
        return v != null ? String(v) : null;
      }
      return null;
    })() ??
    "Record details";

  const resolvedSubtitle = typeof subtitle === "function" ? subtitle(record) : subtitle;
  const autoSubtitle =
    resolvedSubtitle ??
    ((displayColumns.find((c) => c.value && c.key !== "actions")?.value?.(record) as string) ?? "");

  const resolvedBadge = typeof badge === "function" ? badge(record) : badge;
  const resolvedFooter = typeof footer === "function" ? footer(record) : footer;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden gap-0"
      >
        {/* Header */}
        <div className="relative shrink-0 px-6 pt-8 pb-6 border-b border-border/60 bg-[radial-gradient(120%_100%_at_0%_0%,theme(colors.primary/12%),transparent_60%)]">
          <div className="flex items-start gap-4">
            {Icon && (
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
                <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <SheetTitle className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                {autoTitle}
              </SheetTitle>
              {autoSubtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground truncate">{autoSubtitle}</p>
              )}
              {resolvedBadge && <div className="mt-2.5 flex flex-wrap gap-1.5">{resolvedBadge}</div>}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="divide-y divide-border/50">
            {displayColumns.map((col) => {
              const isActions = col.key === "actions";
              let value: React.ReactNode;
              let rawValue: string | null = null;

              if (col.cell) {
                value = isActions ? (
                  <div className="[&>*]:!opacity-100">{col.cell(record, { dense: false })}</div>
                ) : (
                  col.cell(record, { dense: false })
                );
              } else if (col.value) {
                const v = col.value(record);
                rawValue = v == null ? null : String(v);
                value =
                  rawValue == null || rawValue === "" ? (
                    <span className="text-muted-foreground/50">Not set</span>
                  ) : (
                    <CopyableValue text={rawValue} />
                  );
              } else {
                const v = record[col.key as string];
                rawValue = v == null || v === "" ? null : String(v);
                value =
                  rawValue == null ? (
                    <span className="text-muted-foreground/50">Not set</span>
                  ) : (
                    <CopyableValue text={rawValue} />
                  );
              }

              return (
                <div
                  key={col.key}
                  className="px-6 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  {col.header && (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
                      {isActions ? "Actions" : col.header}
                    </p>
                  )}
                  <div className={isActions ? "" : "text-sm font-medium text-foreground"}>
                    {value}
                  </div>
                </div>
              );
            })}

            {displayColumns.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No fields to display for this record.
              </div>
            )}
          </div>
        </div>

        {/* Optional sticky footer for record-level actions */}
        {resolvedFooter && (
          <div className="shrink-0 border-t border-border/60 bg-background px-6 py-4">
            {resolvedFooter}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default RecordDetailSheet;