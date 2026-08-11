import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number
  max?: number
  getValueLabel?: (value: number, max: number) => string
  showLabel?: boolean
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "gradient" | "striped"
  status?: "default" | "success" | "warning" | "error" | "info"
  showStatusIcon?: boolean
  animated?: boolean
  title?: string
  subtitle?: string
  loadingText?: string
  width?: "sm" | "md" | "lg" | "xl" | "full"
  /** Unit code stamped on the plate, e.g. "PSI", "RPM", "LOAD" — set "" to hide */
  unitCode?: string
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({
  className,
  value = 0,
  max = 100,
  getValueLabel,
  showLabel = true,
  size = "md",
  variant = "default",
  status = "default",
  showStatusIcon = true,
  animated = true,
  title,
  subtitle,
  loadingText = "RUNNING",
  width = "full",
  unitCode = "LOAD",
  ...props
}, ref) => {
  const clamped = Math.min(Math.max(value, 0), max)
  const percentage = max > 0 ? (clamped / max) * 100 : 0
  const isLoading = clamped < max
  const isComplete = clamped >= max

  const sizeClasses = {
    sm: "h-2.5",
    md: "h-4",
    lg: "h-6",
    xl: "h-8",
  }

  const tickSizeClasses = {
    sm: "-top-1.5 h-1",
    md: "-top-2 h-1.5",
    lg: "-top-2.5 h-2",
    xl: "-top-3 h-2.5",
  }

  const widthClasses = {
    sm: "w-1/4",
    md: "w-1/2",
    lg: "w-3/4",
    xl: "w-full",
    full: "w-full max-w-4xl",
  }

  // Hardcoded hex values — no custom theme tokens or Tailwind config changes required.
  const statusStyles = {
    default: { fillFrom: "#8A6D1F", fillTo: "#E0BC4E", glow: "#C9A22799", led: "#C9A227", icon: "◆", readout: "#E0BC4E" },
    success: { fillFrom: "#2C8552", fillTo: "#6BC98F", glow: "#3FAE6B99", led: "#3FAE6B", icon: "✓", readout: "#5FCB8A" },
    warning: { fillFrom: "#A97B18", fillTo: "#F0BE55", glow: "#E0A52699", led: "#E0A526", icon: "!", readout: "#F0BE55" },
    error:   { fillFrom: "#A02F28", fillTo: "#E37870", glow: "#D6483F99", led: "#D6483F", icon: "✕", readout: "#E37870" },
    info:    { fillFrom: "#31677A", fillTo: "#72B0C2", glow: "#4A90A499", led: "#4A90A4", icon: "i", readout: "#72B0C2" },
  }

  const c = statusStyles[status]

  const fillBackground =
    variant === "striped"
      ? `repeating-linear-gradient(45deg, ${c.fillTo} 0, ${c.fillTo} 10px, ${c.fillFrom} 10px, ${c.fillFrom} 20px)`
      : `linear-gradient(90deg, ${c.fillFrom}, ${c.fillTo})`

  // Ticks every 10% along the track — reads like graduations on a pressure gauge
  const ticks = Array.from({ length: 9 }, (_, i) => (i + 1) * 10)

  return (
    <div className="w-full space-y-2" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {(title || subtitle) && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] truncate" style={{ color: "#E8E6E1" }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className="text-xs truncate tracking-wide"
                style={{ color: "#8A8F96", fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {unitCode && (
            <span
              className="shrink-0 text-[10px] font-semibold tracking-[0.2em] rounded-sm px-1.5 py-0.5 border"
              style={{ color: "#6B7076", borderColor: "#3A3F45", fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}
            >
              {unitCode}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showStatusIcon && (
            <span className="relative flex h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.led }} aria-hidden="true">
              {isLoading && animated && (
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                  style={{ backgroundColor: c.led }}
                />
              )}
            </span>
          )}
          {showLabel && (
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: c.readout, fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
            >
              {getValueLabel
                ? getValueLabel(clamped, max)
                : `${Math.round(percentage).toString().padStart(3, "0")}%`}
            </span>
          )}
        </div>
        {isLoading && loadingText && (
          <span
            className="text-[11px] uppercase tracking-[0.2em] animate-pulse"
            style={{ color: "#6B7076", fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}
          >
            {loadingText}
          </span>
        )}
        {isComplete && !isLoading && (
          <span
            className="text-[11px] uppercase tracking-[0.2em]"
            style={{ color: c.readout, fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}
          >
            {c.icon} complete
          </span>
        )}
      </div>

      {/* Gauge plate: bezel + rivets + tick graduations + recessed track */}
      <div
        className={cn("relative rounded-md border p-1.5", widthClasses[width], width === "full" && "mx-auto")}
        style={{ backgroundColor: "#22262B", borderColor: "#3A3F45", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}
      >
        {/* corner rivets */}
        {[
          { top: 4, left: 4 },
          { top: 4, right: 4 },
          { bottom: 4, left: 4 },
          { bottom: 4, right: 4 },
        ].map((pos, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full"
            style={{ ...pos, backgroundColor: "#4A4F55", boxShadow: "inset 0 1px 1px rgba(0,0,0,0.6)" }}
          />
        ))}

        {/* tick graduations */}
        <div className="relative mx-2.5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0">
            {ticks.map((t) => (
              <span
                key={t}
                className={cn("absolute w-px", tickSizeClasses[size])}
                style={{ left: `${t}%`, backgroundColor: t % 50 === 0 ? "#6B7076" : "#3A3F45" }}
              />
            ))}
          </div>

          <ProgressPrimitive.Root
            ref={ref}
            className={cn("relative w-full overflow-hidden rounded-sm", sizeClasses[size], className)}
            style={{ backgroundColor: "#0F1113", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)" }}
            {...props}
          >
            <ProgressPrimitive.Indicator
              className="h-full relative transition-[width] duration-500 ease-out"
              style={{ width: `${percentage}%`, backgroundImage: fillBackground, boxShadow: `0 0 10px ${c.glow}` }}
            >
              {animated && isLoading && (
                <span
                  className="absolute inset-y-0 right-0 w-6"
                  style={{ background: "linear-gradient(to left, rgba(255,255,255,0.45), transparent)" }}
                />
              )}
            </ProgressPrimitive.Indicator>
          </ProgressPrimitive.Root>
        </div>
      </div>
    </div>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
