import { type ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: ReactNode;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
  variant?: "default" | "muted";
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconClassName,
  variant = "default",
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        "hover:border-border/70 hover:shadow-md hover:-translate-y-0.5",
        variant === "muted" && "bg-muted/30",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums leading-none text-foreground">
              {value}
            </p>
            {(description || trend) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {trend && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      trend.isPositive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
                    )}
                  >
                    {trend.isPositive ? "+" : ""}
                    {trend.value}%
                  </span>
                )}
                {description && <span className="truncate">{description}</span>}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "bg-muted/60 ring-1 ring-border/40",
              "transition-all duration-300 group-hover:scale-110 group-hover:bg-muted",
              iconClassName,
            )}
          >
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatCard;
