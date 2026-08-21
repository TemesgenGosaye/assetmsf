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

const variantStyles: Record<
  HeroMetricVariant,
  {
    card: string;
    iconBg: string;
    icon: string;
    title: string;
    value: string;
    caption: string;
    border: string;
    glow: string;
    deco: string;
  }
> = {
  blue: {
    card: "bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700",
    iconBg: "bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-blue-900/30",
    icon: "text-white drop-shadow-sm",
    title: "text-blue-100/80",
    value: "text-white",
    caption: "text-blue-100/60",
    border: "border-blue-500/30",
    glow: "group-hover:shadow-[0_8px_32px_-4px_rgba(59,130,246,0.5)]",
    deco: "from-white/[0.07] to-transparent",
  },
  green: {
    card: "bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700",
    iconBg: "bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-emerald-900/30",
    icon: "text-white drop-shadow-sm",
    title: "text-emerald-100/80",
    value: "text-white",
    caption: "text-emerald-100/60",
    border: "border-emerald-500/30",
    glow: "group-hover:shadow-[0_8px_32px_-4px_rgba(16,185,129,0.5)]",
    deco: "from-white/[0.07] to-transparent",
  },
  purple: {
    card: "bg-gradient-to-br from-violet-600 via-violet-600 to-violet-700",
    iconBg: "bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-violet-900/30",
    icon: "text-white drop-shadow-sm",
    title: "text-violet-100/80",
    value: "text-white",
    caption: "text-violet-100/60",
    border: "border-violet-500/30",
    glow: "group-hover:shadow-[0_8px_32px_-4px_rgba(139,92,246,0.5)]",
    deco: "from-white/[0.07] to-transparent",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600",
    iconBg: "bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-orange-900/30",
    icon: "text-white drop-shadow-sm",
    title: "text-orange-100/80",
    value: "text-white",
    caption: "text-orange-100/60",
    border: "border-orange-400/30",
    glow: "group-hover:shadow-[0_8px_32px_-4px_rgba(249,115,22,0.5)]",
    deco: "from-white/[0.07] to-transparent",
  },
  pink: {
    card: "bg-gradient-to-br from-rose-500 via-rose-500 to-rose-600",
    iconBg: "bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg shadow-rose-900/30",
    icon: "text-white drop-shadow-sm",
    title: "text-rose-100/80",
    value: "text-white",
    caption: "text-rose-100/60",
    border: "border-rose-400/30",
    glow: "group-hover:shadow-[0_8px_32px_-4px_rgba(244,63,94,0.5)]",
    deco: "from-white/[0.07] to-transparent",
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
        "group relative overflow-hidden rounded-2xl border px-5 py-4 text-white",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5",
        styles.card,
        styles.border,
        styles.glow,
        isClickable &&
          "cursor-pointer active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {/* Decorative background accent */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          styles.deco,
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-gradient-to-tr opacity-[0.06] blur-xl",
          styles.deco,
        )}
      />

      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            "transition-transform duration-300 group-hover:scale-110",
            styles.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon, iconClassName)} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[11px] font-semibold uppercase tracking-widest",
              styles.title,
            )}
          >
            {title}
          </p>
          <div
            className={cn(
              "mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums leading-none",
              styles.value,
            )}
          >
            <CountUp value={value} duration={1000} />
          </div>
          {caption && (
            <p
              className={cn(
                "mt-1 truncate text-[10px] leading-tight font-medium",
                styles.caption,
              )}
            >
              {caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HeroMetricCard;
