import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

export type MetricCardVariant = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "orange" | "default";

type MetricCardProps = {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
  contentClassName?: string;
  variant?: MetricCardVariant;
  onClick?: () => void;
  countValue?: number;
  countDuration?: number;
  countFormat?: (value: number) => string;
};

const variantStyles: Record<MetricCardVariant, {
  card: string;
  iconWrap: string;
  icon: string;
  title: string;
  value: string;
  caption: string;
  accentBar: string;
}> = {
  blue: {
    card: "bg-gradient-to-br from-blue-50 to-blue-100/60 border-blue-200/70 dark:from-blue-950/40 dark:to-blue-900/20 dark:border-blue-800/40",
    iconWrap: "bg-blue-500/15 ring-blue-400/30",
    icon: "text-blue-600 dark:text-blue-400",
    title: "text-blue-700/80 dark:text-blue-300/70",
    value: "text-blue-900 dark:text-blue-50",
    caption: "text-blue-600/70 dark:text-blue-400/60",
    accentBar: "bg-blue-500",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-violet-100/60 border-violet-200/70 dark:from-violet-950/40 dark:to-violet-900/20 dark:border-violet-800/40",
    iconWrap: "bg-violet-500/15 ring-violet-400/30",
    icon: "text-violet-600 dark:text-violet-400",
    title: "text-violet-700/80 dark:text-violet-300/70",
    value: "text-violet-900 dark:text-violet-50",
    caption: "text-violet-600/70 dark:text-violet-400/60",
    accentBar: "bg-violet-500",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/70 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:border-emerald-800/40",
    iconWrap: "bg-emerald-500/15 ring-emerald-400/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    title: "text-emerald-700/80 dark:text-emerald-300/70",
    value: "text-emerald-900 dark:text-emerald-50",
    caption: "text-emerald-600/70 dark:text-emerald-400/60",
    accentBar: "bg-emerald-500",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200/70 dark:from-amber-950/40 dark:to-amber-900/20 dark:border-amber-800/40",
    iconWrap: "bg-amber-500/15 ring-amber-400/30",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-700/80 dark:text-amber-300/70",
    value: "text-amber-900 dark:text-amber-50",
    caption: "text-amber-600/70 dark:text-amber-400/60",
    accentBar: "bg-amber-500",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 to-rose-100/60 border-rose-200/70 dark:from-rose-950/40 dark:to-rose-900/20 dark:border-rose-800/40",
    iconWrap: "bg-rose-500/15 ring-rose-400/30",
    icon: "text-rose-600 dark:text-rose-400",
    title: "text-rose-700/80 dark:text-rose-300/70",
    value: "text-rose-900 dark:text-rose-50",
    caption: "text-rose-600/70 dark:text-rose-400/60",
    accentBar: "bg-rose-500",
  },
  cyan: {
    card: "bg-gradient-to-br from-cyan-50 to-cyan-100/60 border-cyan-200/70 dark:from-cyan-950/40 dark:to-cyan-900/20 dark:border-cyan-800/40",
    iconWrap: "bg-cyan-500/15 ring-cyan-400/30",
    icon: "text-cyan-600 dark:text-cyan-400",
    title: "text-cyan-700/80 dark:text-cyan-300/70",
    value: "text-cyan-900 dark:text-cyan-50",
    caption: "text-cyan-600/70 dark:text-cyan-400/60",
    accentBar: "bg-cyan-500",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-50 to-orange-100/60 border-orange-200/70 dark:from-orange-950/40 dark:to-orange-900/20 dark:border-orange-800/40",
    iconWrap: "bg-orange-500/15 ring-orange-400/30",
    icon: "text-orange-600 dark:text-orange-400",
    title: "text-orange-700/80 dark:text-orange-300/70",
    value: "text-orange-900 dark:text-orange-50",
    caption: "text-orange-600/70 dark:text-orange-400/60",
    accentBar: "bg-orange-500",
  },
  default: {
    card: "bg-card border-border/60",
    iconWrap: "bg-primary/5 ring-primary/10",
    icon: "text-primary",
    title: "text-muted-foreground",
    value: "text-foreground",
    caption: "text-muted-foreground/80",
    accentBar: "bg-primary",
  },
};

export function MetricCard({
  icon: Icon,
  title,
  value,
  caption,
  iconClassName,
  valueClassName,
  className,
  contentClassName,
  variant = "default",
  onClick,
  countValue,
  countDuration,
  countFormat,
}: MetricCardProps) {
  const styles = variantStyles[variant];
  const isClickable = Boolean(onClick);

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-sm transition-all",
        styles.card,
        isClickable && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm",
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
    >
      {/* Accent bar on the left edge */}
      <div className={cn("absolute inset-y-0 left-0 w-1 rounded-l-2xl", styles.accentBar)} />

      <CardContent className={cn("p-5 pl-6", contentClassName)}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className={cn("text-xs font-semibold uppercase tracking-wider", styles.title)}>{title}</p>
            <div className={cn("text-3xl font-bold tracking-tight", styles.value, valueClassName)}>
              {typeof countValue === "number" ? (
                <CountUp
                  value={countValue}
                  duration={countDuration ?? 1200}
                  format={countFormat ?? ((n) => Math.round(n).toLocaleString())}
                />
              ) : (
                value
              )}
            </div>
            {caption && (
              <p className={cn("text-xs leading-snug", styles.caption)}>{caption}</p>
            )}
          </div>
          <div className={cn("shrink-0 rounded-xl p-2.5 ring-1 ring-inset", styles.iconWrap)}>
            <Icon className={cn("h-5 w-5", styles.icon, iconClassName)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
