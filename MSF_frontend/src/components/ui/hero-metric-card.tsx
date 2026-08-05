import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

export type HeroMetricVariant =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "pink";

type HeroMetricCardProps = {
  icon: LucideIcon;
  title: string;
  value: number;
  caption?: string;
  iconClassName?: string;
  variant?: HeroMetricVariant;
  onClick?: () => void;
};

const variantStyles: Record<HeroMetricVariant, { card: string; iconBg: string; icon: string; title: string; value: string; caption: string; border: string }> = {
  blue: {
    card: "bg-blue-600 dark:bg-blue-700",
    iconBg: "bg-blue-500/50 dark:bg-blue-600/50",
    icon: "text-white",
    title: "text-blue-100 dark:text-blue-200",
    value: "text-white",
    caption: "text-blue-100/80 dark:text-blue-200/70",
    border: "border-blue-500 dark:border-blue-600",
  },
  green: {
    card: "bg-emerald-600 dark:bg-emerald-700",
    iconBg: "bg-emerald-500/50 dark:bg-emerald-600/50",
    icon: "text-white",
    title: "text-emerald-100 dark:text-emerald-200",
    value: "text-white",
    caption: "text-emerald-100/80 dark:text-emerald-200/70",
    border: "border-emerald-500 dark:border-emerald-600",
  },
  purple: {
    card: "bg-violet-600 dark:bg-violet-700",
    iconBg: "bg-violet-500/50 dark:bg-violet-600/50",
    icon: "text-white",
    title: "text-violet-100 dark:text-violet-200",
    value: "text-white",
    caption: "text-violet-100/80 dark:text-violet-200/70",
    border: "border-violet-500 dark:border-violet-600",
  },
  orange: {
    card: "bg-orange-500 dark:bg-orange-600",
    iconBg: "bg-orange-400/50 dark:bg-orange-500/50",
    icon: "text-white",
    title: "text-orange-100 dark:text-orange-200",
    value: "text-white",
    caption: "text-orange-100/80 dark:text-orange-200/70",
    border: "border-orange-400 dark:border-orange-500",
  },
  pink: {
    card: "bg-rose-500 dark:bg-rose-600",
    iconBg: "bg-rose-400/50 dark:bg-rose-500/50",
    icon: "text-white",
    title: "text-rose-100 dark:text-rose-200",
    value: "text-white",
    caption: "text-rose-100/80 dark:text-rose-200/70",
    border: "border-rose-400 dark:border-rose-500",
  },
};

export function HeroMetricCard({
  icon: Icon,
  title,
  value,
  caption,
  iconClassName,
  variant = "blue",
  onClick,
}: HeroMetricCardProps) {
  const styles = variantStyles[variant];
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
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
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all duration-200",
        styles.card,
        styles.border,
        isClickable &&
          "cursor-pointer hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          styles.iconBg,
        )}
      >
        <Icon className={cn("h-4 w-4", styles.icon, iconClassName)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[10px] font-medium uppercase tracking-wider", styles.title)}>
          {title}
        </p>
        <div className={cn("text-xl font-bold tracking-tight tabular-nums", styles.value)}>
          <CountUp value={value} duration={1000} />
        </div>
        {caption && (
          <p className={cn("mt-0.5 truncate text-[10px] leading-tight", styles.caption)}>
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

export default HeroMetricCard;
