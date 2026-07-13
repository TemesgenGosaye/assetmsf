import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickActionItem = {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
  adminOnly?: boolean;
};

type QuickActionsProps = {
  items: QuickActionItem[];
  isAdmin?: boolean;
};

export function QuickActions({ items, isAdmin = true }: QuickActionsProps) {
  const visible = items.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={cn(
            "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all duration-300",
            "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-transform duration-300 group-hover:scale-110">
            <item.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">
              {item.label}
            </p>
            {item.description && (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
