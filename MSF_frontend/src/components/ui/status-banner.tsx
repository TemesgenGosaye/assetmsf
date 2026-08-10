import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, TriangleAlert, Info, X } from "lucide-react"

export type StatusVariant = "success" | "error" | "warning" | "info"

interface StatusBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: StatusVariant
  title?: string
  description?: string
  children?: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  action?: React.ReactNode
  className?: string
}

const variantStyles: Record<StatusVariant, {
  container: string
  iconWrapper: string
  icon: React.ComponentType<{ className?: string }>
  titleColor: string
}> = {
  success: {
    container: "border-success/30 bg-success/10 text-success-foreground dark:bg-success/15",
    iconWrapper: "bg-success/20 text-success",
    icon: CheckCircle2,
    titleColor: "text-success",
  },
  error: {
    container: "border-destructive/30 bg-destructive/10 text-destructive-foreground dark:bg-destructive/15",
    iconWrapper: "bg-destructive/20 text-destructive",
    icon: XCircle,
    titleColor: "text-destructive",
  },
  warning: {
    container: "border-warning/40 bg-warning/10 text-warning-foreground dark:bg-warning/15",
    iconWrapper: "bg-warning/20 text-warning",
    icon: TriangleAlert,
    titleColor: "text-warning",
  },
  info: {
    container: "border-info/30 bg-info/10 text-info-foreground dark:bg-info/15",
    iconWrapper: "bg-info/20 text-info",
    icon: Info,
    titleColor: "text-info",
  },
}

export function StatusBanner({
  variant,
  title,
  description,
  children,
  dismissible,
  onDismiss,
  action,
  className,
  ...props
}: StatusBannerProps) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) return null

  const style = variantStyles[variant]
  const IconComponent = style.icon

  return (
    <div
      role="region"
      aria-label={title || variant}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border p-4 text-sm transition-all duration-200 animate-in fade-in-50 slide-in-from-top-1",
        style.container,
        className
      )}
      {...props}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", style.iconWrapper)}>
        <IconComponent className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-1">
        {title && <h5 className={cn("font-semibold leading-tight", style.titleColor)}>{title}</h5>}
        {description && <p className="text-xs leading-relaxed opacity-90">{description}</p>}
        {children}
      </div>

      {action && <div className="shrink-0 self-center">{action}</div>}

      {dismissible && (
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            onDismiss?.()
          }}
          className="shrink-0 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
