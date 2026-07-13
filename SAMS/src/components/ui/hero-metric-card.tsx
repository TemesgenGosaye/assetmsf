import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

export type HeroMetricVariant =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "cyan";

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
    orb: string;
    ring: string;
    iconWrap: string;
    icon: string;
    title: string;
    value: string;
    caption: string;
  }
> = {
  blue: {
    card: "from-sky-500/10 via-blue-500/[0.06] to-indigo-500/[0.04]",
    orb: "bg-blue-500/30",
    ring: "ring-blue-400/20",
    iconWrap: "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30",
    icon: "text-white",
    title: "text-blue-700/80 dark:text-blue-300/80",
    value: "text-blue-950 dark:text-blue-50",
    caption: "text-blue-700/60 dark:text-blue-300/60",
  },
  violet: {
    card: "from-violet-500/10 via-purple-500/[0.06] to-fuchsia-500/[0.04]",
    orb: "bg-violet-500/30",
    ring: "ring-violet-400/20",
    iconWrap: "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30",
    icon: "text-white",
    title: "text-violet-700/80 dark:text-violet-300/80",
    value: "text-violet-950 dark:text-violet-50",
    caption: "text-violet-700/60 dark:text-violet-300/60",
  },
  emerald: {
    card: "from-emerald-500/10 via-green-500/[0.06] to-teal-500/[0.04]",
    orb: "bg-emerald-500/30",
    ring: "ring-emerald-400/20",
    iconWrap: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30",
    icon: "text-white",
    title: "text-emerald-700/80 dark:text-emerald-300/80",
    value: "text-emerald-950 dark:text-emerald-50",
    caption: "text-emerald-700/60 dark:text-emerald-300/60",
  },
  amber: {
    card: "from-amber-500/10 via-orange-500/[0.06] to-yellow-500/[0.04]",
    orb: "bg-amber-500/30",
    ring: "ring-amber-400/20",
    iconWrap: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30",
    icon: "text-white",
    title: "text-amber-700/80 dark:text-amber-300/80",
    value: "text-amber-950 dark:text-amber-50",
    caption: "text-amber-700/60 dark:text-amber-300/60",
  },
  cyan: {
    card: "from-cyan-500/10 via-sky-500/[0.06] to-blue-500/[0.04]",
    orb: "bg-cyan-500/30",
    ring: "ring-cyan-400/20",
    iconWrap: "bg-gradient-to-br from-cyan-500 to-sky-600 shadow-cyan-500/30",
    icon: "text-white",
    title: "text-cyan-700/80 dark:text-cyan-300/80",
    value: "text-cyan-950 dark:text-cyan-50",
    caption: "text-cyan-700/60 dark:text-cyan-300/60",
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
        "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br p-5 shadow-sm ring-1 ring-inset transition-all duration-300",
        styles.card,
        styles.ring,
        isClickable &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {/* Decorative soft orb shape */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125",
          styles.orb,
        )}
      />
      {/* Subtle diagonal accent */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60" />

      <div className="relative flex items-start justify-between">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            styles.title,
          )}
        >
          {title}
        </p>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg",
            styles.iconWrap,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon, iconClassName)} />
        </span>
      </div>

      <div className="relative mt-6">
        <div
          className={cn(
            "text-4xl font-black tracking-tight tabular-nums",
            styles.value,
          )}
        >
          <CountUp value={value} duration={1200} />
        </div>
        {caption && (
          <p className={cn("mt-1.5 text-xs font-medium leading-snug", styles.caption)}>
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

export default HeroMetricCard;
