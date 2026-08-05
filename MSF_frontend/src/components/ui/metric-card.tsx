import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
  iconBg: string;
  icon: string;
  title: string;
  value: string;
  caption: string;
}> = {
  blue: {
    card: "bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,48%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  violet: {
    card: "bg-[hsl(262,83%,58%)] hover:bg-[hsl(262,83%,53%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  emerald: {
    card: "bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,40%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  amber: {
    card: "bg-[hsl(47,95%,57%)] hover:bg-[hsl(47,95%,52%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  rose: {
    card: "bg-[hsl(339,90%,51%)] hover:bg-[hsl(339,90%,46%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  cyan: {
    card: "bg-[hsl(191,91%,46%)] hover:bg-[hsl(191,91%,41%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  orange: {
    card: "bg-[hsl(31,97%,55%)] hover:bg-[hsl(31,97%,50%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
  },
  default: {
    card: "bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,48%)]",
    iconBg: "bg-white/20",
    icon: "text-white",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/70",
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
        "group flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-sm transition-all duration-200",
        styles.card,
        isClickable &&
          "cursor-pointer hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.iconBg)}>
        <Icon className={cn("h-4 w-4", styles.icon, iconClassName)} />
      </div>

      <div className={cn("min-w-0 flex-1", contentClassName)}>
        <p className={cn("truncate text-[10px] font-medium uppercase tracking-wider", styles.title)}>{title}</p>
        <div className={cn("text-xl font-bold tracking-tight tabular-nums", styles.value, valueClassName)}>
          {typeof countValue === "number" ? (
            <CountUp
              value={countValue}
              duration={countDuration ?? 1000}
              format={countFormat ?? ((n) => Math.round(n).toLocaleString())}
            />
          ) : (
            value
          )}
        </div>
        {caption && (
          <p className={cn("mt-0.5 truncate text-[10px] leading-tight", styles.caption)}>{caption}</p>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
