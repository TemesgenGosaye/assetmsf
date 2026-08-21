import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

export type MetricCardVariant =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "orange"
  | "default";

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

const variantStyles: Record<
  MetricCardVariant,
  {
    icon: string;
    accent: string;
  }
> = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },

  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    accent: "text-violet-600 dark:text-violet-400",
  },

  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    accent: "text-emerald-600 dark:text-emerald-400",
  },

  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },

  rose: {
    icon: "text-rose-600 dark:text-rose-400",
    accent: "text-rose-600 dark:text-rose-400",
  },

  cyan: {
    icon: "text-cyan-600 dark:text-cyan-400",
    accent: "text-cyan-600 dark:text-cyan-400",
  },

  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    accent: "text-orange-600 dark:text-orange-400",
  },

  default: {
    icon: "text-slate-700 dark:text-slate-200",
    accent: "text-slate-700 dark:text-white",
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
    <div
      className={cn(
        "group relative flex items-center gap-3",
        "py-1",
        "transition-all duration-200",
        isClickable &&
          "cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className,
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Large standalone icon */}
      <Icon
        className={cn(
          "h-7 w-7 shrink-0",
          "stroke-[2.5]",
          "transition-transform duration-200",
          "group-hover:scale-110",
          styles.icon,
          iconClassName,
        )}
      />

      {/* Metric information */}
      <div className={cn("min-w-0", contentClassName)}>
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "truncate",
              "text-[9px]",
              "font-bold",
              "uppercase",
              "tracking-[0.14em]",
              "text-slate-500 dark:text-slate-400",
            )}
          >
            {title}
          </p>

          {isClickable && (
            <ArrowUpRight
              className={cn(
                "h-3 w-3 shrink-0",
                "opacity-0",
                "transition-all duration-200",
                "group-hover:translate-x-0.5",
                "group-hover:opacity-60",
                styles.accent,
              )}
              strokeWidth={2.5}
            />
          )}
        </div>

        <div
          className={cn(
            "mt-0.5",
            "text-[22px]",
            "font-extrabold",
            "leading-none",
            "tracking-[-0.035em]",
            "tabular-nums",
            "text-slate-950 dark:text-white",
            valueClassName,
          )}
        >
          {typeof countValue === "number" ? (
            <CountUp
              value={countValue}
              duration={countDuration ?? 1000}
              format={
                countFormat ??
                ((n) => Math.round(n).toLocaleString())
              }
            />
          ) : (
            value
          )}
        </div>

        {caption && (
          <p
            className={cn(
              "mt-1 truncate",
              "text-[9px]",
              "font-medium",
              "leading-none",
              "text-slate-400 dark:text-slate-500",
            )}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

export default MetricCard;