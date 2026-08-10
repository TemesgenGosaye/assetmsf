import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Copy,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Undo2,
  X,
  XCircle,
} from "lucide-react"

/* ============================================================================
   TYPES
============================================================================ */

export type NotificationVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"

export type ToastVariant = NotificationVariant

export type ConfirmVariant =
  | "default"
  | "danger"
  | "warning"

export type ToastPosition =
  | "top-right"
  | "top-center"
  | "bottom-right"
  | "bottom-center"
  | "top-left"
  | "bottom-left"

export interface ToastMessageOptions {
  id?: string
  title: React.ReactNode
  description?: React.ReactNode

  variant?: NotificationVariant

  duration?: number

  actionLabel?: string
  onAction?: () => void | Promise<void>

  secondaryActionLabel?: string
  onSecondaryAction?: () => void | Promise<void>

  dismissible?: boolean

  dedupe?: boolean

  icon?: React.ReactNode

  position?: ToastPosition

  badge?: string

  confetti?: boolean

  metadata?: {
    entity?: string
    entityId?: string
    operation?: string
  }
}

export type NotificationOptions = ToastMessageOptions

interface NotificationEntry extends ToastMessageOptions {
  id: string
  variant: NotificationVariant
  createdAt: number
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const MAX_VISIBLE_NOTIFICATIONS = 4

const DEFAULT_DURATION: Record<
  NotificationVariant,
  number
> = {
  success: 4500,
  error: 7000,
  warning: 5500,
  info: 4500,
  loading: Infinity,
}

/* ============================================================================
   UTILITY
============================================================================ */

function createId(prefix = "notification") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`
}

/* ============================================================================
   VARIANT CONFIG
============================================================================ */

const notificationConfig: Record<
  NotificationVariant,
  {
    label: string
    Icon: React.ComponentType<{
      className?: string
    }>
    iconClass: string
    accentClass: string
    progressClass: string
  }
> = {
  success: {
    label: "Success",
    Icon: CheckCircle2,
    iconClass:
      "text-emerald-600 dark:text-emerald-400",
    accentClass: "bg-emerald-500",
    progressClass: "bg-emerald-500",
  },

  error: {
    label: "Error",
    Icon: XCircle,
    iconClass:
      "text-red-600 dark:text-red-400",
    accentClass: "bg-red-500",
    progressClass: "bg-red-500",
  },

  warning: {
    label: "Warning",
    Icon: AlertTriangle,
    iconClass:
      "text-amber-600 dark:text-amber-400",
    accentClass: "bg-amber-500",
    progressClass: "bg-amber-500",
  },

  info: {
    label: "Information",
    Icon: Info,
    iconClass:
      "text-blue-600 dark:text-blue-400",
    accentClass: "bg-blue-500",
    progressClass: "bg-blue-500",
  },

  loading: {
    label: "Processing",
    Icon: Loader2,
    iconClass:
      "text-indigo-600 dark:text-indigo-400",
    accentClass: "bg-indigo-500",
    progressClass: "bg-indigo-500",
  },
}

/* ============================================================================
   MODULE-LEVEL STORE
   Everything below is a plain module store (no React context) so it can be
   reached from any call site — including module-scope adapters such as the
   sonner patch in `@/lib/toast-global`.
============================================================================ */

let toastList: NotificationEntry[] = []

const toastListeners = new Set<() => void>()

function emitToastChange() {
  toastListeners.forEach((listener) => listener())
}

function getToastSnapshot(): NotificationEntry[] {
  return toastList
}

function subscribeToasts(listener: () => void) {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

export function showToast(
  options: ToastMessageOptions
): string {
  const id = options.id || createId("toast")
  const variant = options.variant || "success"

  if (options.dedupe) {
    const existing = toastList.find(
      (item) =>
        item.id === id ||
        (
          item.title === options.title &&
          item.variant === variant
        )
    )

    if (existing) {
      toastList = toastList.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              ...options,
              id: existing.id,
              variant,
            }
          : item
      )
      emitToastChange()
      return existing.id
    }
  }

  const entry: NotificationEntry = {
    ...options,
    id,
    variant,
    createdAt: Date.now(),
  }

  toastList = [
    entry,
    ...toastList,
  ].slice(
    0,
    MAX_VISIBLE_NOTIFICATIONS
  )

  emitToastChange()

  return id
}

export function updateToast(
  id: string,
  patch: Partial<ToastMessageOptions>
) {
  let changed = false

  toastList = toastList.map((item) => {
    if (item.id !== id) return item

    changed = true

    return {
      ...item,
      ...patch,
      id: item.id,
      variant: patch.variant || item.variant,
    }
  })

  if (changed) emitToastChange()
}

export function dismissToast(id: string) {
  const next = toastList.filter(
    (item) => item.id !== id
  )

  if (next.length !== toastList.length) {
    toastList = next
    emitToastChange()
  }
}

export function dismissAll() {
  if (toastList.length > 0) {
    toastList = []
    emitToastChange()
  }
}

/* ============================================================================
   CRUD HELPERS
============================================================================ */

export const crudToast = {
  success(
    title: React.ReactNode,
    description?: React.ReactNode,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "success",
    })
  },

  error(
    title: React.ReactNode,
    description?: React.ReactNode,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "error",
    })
  },

  warning(
    title: React.ReactNode,
    description?: React.ReactNode,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "warning",
    })
  },

  info(
    title: React.ReactNode,
    description?: React.ReactNode,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "info",
    })
  },

  loading(
    title: React.ReactNode,
    description?: React.ReactNode,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "loading",
      duration: Infinity,
    })
  },

  created(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} created`,
      description:
        description ||
        `The ${entity.toLowerCase()} was successfully created.`,
      variant: "success",
      metadata: {
        entity,
        operation: "create",
      },
    })
  },

  updated(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} updated`,
      description:
        description ||
        `Changes to the ${entity.toLowerCase()} were successfully saved.`,
      variant: "success",
      metadata: {
        entity,
        operation: "update",
      },
    })
  },

  deleted(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} deleted`,
      description:
        description ||
        `The ${entity.toLowerCase()} was permanently removed.`,
      variant: "success",
      metadata: {
        entity,
        operation: "delete",
      },
    })
  },

  restored(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} restored`,
      description:
        description ||
        `The ${entity.toLowerCase()} has been restored successfully.`,
      variant: "success",
      metadata: {
        entity,
        operation: "restore",
      },
    })
  },

  approved(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} approved`,
      description:
        description ||
        `The ${entity.toLowerCase()} has been approved.`,
      variant: "success",
      metadata: {
        entity,
        operation: "approve",
      },
    })
  },

  rejected(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} rejected`,
      description:
        description ||
        `The ${entity.toLowerCase()} has been rejected.`,
      variant: "warning",
      metadata: {
        entity,
        operation: "reject",
      },
    })
  },

  assigned(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} assigned`,
      description:
        description ||
        `The ${entity.toLowerCase()} has been assigned successfully.`,
      variant: "success",
      metadata: {
        entity,
        operation: "assign",
      },
    })
  },

  imported(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} imported`,
      description:
        description ||
        `The ${entity.toLowerCase()} data was imported successfully.`,
      variant: "success",
      metadata: {
        entity,
        operation: "import",
      },
    })
  },

  exported(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} exported`,
      description:
        description ||
        `The ${entity.toLowerCase()} report was generated successfully.`,
      variant: "success",
      metadata: {
        entity,
        operation: "export",
      },
    })
  },

  copied(
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: "Copied to clipboard",
      description:
        description ||
        "The selected content is now available on your clipboard.",
      variant: "success",
    })
  },

  validated(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} validated`,
      description:
        description ||
        "All required validation checks passed successfully.",
      variant: "success",
    })
  },

  synced(
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: "Synchronization complete",
      description:
        description ||
        "All changes have been synchronized successfully.",
      variant: "success",
    })
  },

  settingsSaved(
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: "Settings saved",
      description:
        description ||
        "Your preferences have been updated successfully.",
      variant: "success",
    })
  },

  published(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} published`,
      description:
        description ||
        `The ${entity.toLowerCase()} is now publicly available.`,
      variant: "success",
    })
  },

  archived(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} archived`,
      description:
        description ||
        `The ${entity.toLowerCase()} has been moved to the archive.`,
      variant: "info",
    })
  },

  invited(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} invited`,
      description:
        description ||
        `An invitation was sent to ${entity.toLowerCase()}.`,
      variant: "success",
    })
  },

  generated(
    entity: string,
    description?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `${entity} generated`,
      description:
        description ||
        `The ${entity.toLowerCase()} was generated successfully.`,
      variant: "success",
    })
  },

  failed(
    action: string,
    reason?: string,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title: `Unable to ${action}`,
      description:
        reason ||
        "The operation could not be completed. Please try again.",
      variant: "error",
    })
  },

  undo(
    title: string,
    description: string,
    onUndo: () => void | Promise<void>,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "success",
      duration: 7000,
      actionLabel: "Undo",
      onAction: onUndo,
      icon: <Undo2 />,
    })
  },

  retry(
    title: string,
    description: string,
    onRetry: () => void | Promise<void>,
    options?: Partial<ToastMessageOptions>
  ): string {
    return showToast({
      ...options,
      title,
      description,
      variant: "error",
      duration: 8000,
      actionLabel: "Retry",
      onAction: onRetry,
      icon: <RefreshCw />,
    })
  },

  async promise<T>(
    promise: Promise<T>,
    options: {
      loading:
        | string
        | ToastMessageOptions
      success:
        | string
        | ((data: T) => string)
      error:
        | string
        | ((error: unknown) => string)
    }
  ): Promise<T> {
    const loadingOptions =
      typeof options.loading === "string"
        ? {
            title: options.loading,
            variant: "loading" as const,
            duration: Infinity,
          }
        : {
            ...options.loading,
            variant:
              "loading" as const,
            duration: Infinity,
          }

    const id = showToast(loadingOptions)

    try {
      const result = await promise

      updateToast(id, {
        title:
          typeof options.success ===
          "function"
            ? options.success(result)
            : options.success,
        description:
          "Operation completed successfully.",
        variant: "success",
        duration: 4500,
      })

      return result
    } catch (error) {
      updateToast(id, {
        title:
          typeof options.error ===
          "function"
            ? options.error(error)
            : options.error,
        variant: "error",
        duration: 7000,
      })

      throw error
    }
  },
}

/* ============================================================================
   TOAST VIEWPORT
============================================================================ */

function EnterpriseNotificationViewport({
  notifications,
  onDismiss,
}: {
  notifications: NotificationEntry[]
  onDismiss: (id: string) => void
}) {
  if (!notifications.length) {
    return null
  }

  const groups = new Map<
    ToastPosition,
    NotificationEntry[]
  >()

  notifications.forEach((notification) => {
    const position =
      notification.position ||
      "top-right"

    const group =
      groups.get(position) || []

    group.push(notification)

    groups.set(position, group)
  })

  const positionClass: Record<
    ToastPosition,
    string
  > = {
    "top-right":
      "right-0 top-0 sm:right-4 sm:top-4",
    "top-center":
      "left-1/2 top-0 -translate-x-1/2 sm:top-4",
    "top-left":
      "left-0 top-0 sm:left-4 sm:top-4",
    "bottom-right":
      "bottom-0 right-0 sm:bottom-4 sm:right-4",
    "bottom-center":
      "bottom-0 left-1/2 -translate-x-1/2 sm:bottom-4",
    "bottom-left":
      "bottom-0 left-0 sm:bottom-4 sm:left-4",
  }

  return createPortal(
    <>
      {Array.from(groups.entries()).map(
        ([position, items]) => (
          <div
            key={position}
            className={cn(
              "pointer-events-none fixed z-[99999] flex w-full flex-col gap-3 p-4 sm:w-auto sm:max-w-md",
              positionClass[position]
            )}
          >
            {items.map((notification) => (
              <EnterpriseToast
                key={notification.id}
                notification={notification}
                onDismiss={() =>
                  onDismiss(notification.id)
                }
              />
            ))}
          </div>
        )
      )}
    </>,
    document.body
  )
}

/* ============================================================================
   TOAST
============================================================================ */

function EnterpriseToast({
  notification,
  onDismiss,
}: {
  notification: NotificationEntry
  onDismiss: () => void
}) {
  const [paused, setPaused] =
    React.useState(false)

  const [leaving, setLeaving] =
    React.useState(false)

  const config =
    notificationConfig[
      notification.variant
    ]

  const duration =
    notification.duration ??
    DEFAULT_DURATION[
      notification.variant
    ]

  const remainingRef =
    React.useRef(duration)

  const lastTimeRef =
    React.useRef<number | null>(null)

  const isPersistent =
    duration === Infinity

  const close = React.useCallback(() => {
    if (leaving) return

    setLeaving(true)

    window.setTimeout(
      onDismiss,
      180
    )
  }, [leaving, onDismiss])

  React.useEffect(() => {
    if (
      isPersistent ||
      paused ||
      leaving
    ) {
      lastTimeRef.current = null
      return
    }

    let frame = 0

    const tick = (time: number) => {
      if (
        lastTimeRef.current === null
      ) {
        lastTimeRef.current = time
      }

      const delta =
        time - lastTimeRef.current

      lastTimeRef.current = time

      remainingRef.current =
        Math.max(
          0,
          remainingRef.current - delta
        )

      if (
        remainingRef.current <= 0
      ) {
        close()
        return
      }

      frame =
        requestAnimationFrame(tick)
    }

    frame =
      requestAnimationFrame(tick)

    return () =>
      cancelAnimationFrame(frame)
  }, [
    duration,
    paused,
    leaving,
    isPersistent,
    close,
  ])

  const Icon =
    config.Icon

  return (
    <article
      role={
        notification.variant ===
        "error"
          ? "alert"
          : "status"
      }
      aria-live={
        notification.variant ===
        "error"
          ? "assertive"
          : "polite"
      }
      onMouseEnter={() =>
        setPaused(true)
      }
      onMouseLeave={() =>
        setPaused(false)
      }
      className={cn(
        "pointer-events-auto relative w-full overflow-hidden rounded-2xl",
        "border border-slate-200/80 bg-white/95",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.28)]",
        "backdrop-blur-xl",
        "dark:border-slate-800 dark:bg-slate-950/95",
        leaving &&
          "animate-[enterprise-toast-out_.18s_ease-in_forwards]",
        !leaving &&
          "animate-[enterprise-toast-in_.22s_cubic-bezier(.16,1,.3,1)]"
      )}
    >
      {/* Accent */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          config.accentClass
        )}
      />

      <div className="flex gap-3.5 p-4 pl-5">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            "bg-slate-100 dark:bg-slate-900"
          )}
        >
          {notification.icon || (
            <Icon
              className={cn(
                "h-[18px] w-[18px]",
                config.iconClass,
                notification.variant ===
                  "loading" &&
                  "animate-spin"
              )}
            />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.12em]",
                config.iconClass
              )}
            >
              {config.label}
            </span>

            {notification.metadata
              ?.entity && (
              <span className="truncate text-[10px] font-medium text-slate-400">
                {notification.metadata.entity}
              </span>
            )}

            {notification.badge && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {notification.badge}
              </span>
            )}
          </div>

          <h4 className="mt-1 text-[14px] font-semibold leading-5 text-slate-900 dark:text-white">
            {notification.title}
          </h4>

          {notification.description && (
            <p className="mt-1 text-[12.5px] leading-5 text-slate-500 dark:text-slate-400">
              {notification.description}
            </p>
          )}

          {(notification.actionLabel ||
            notification.secondaryActionLabel) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {notification.actionLabel &&
                notification.onAction && (
                  <button
                    type="button"
                    onClick={async () => {
                      await notification.onAction?.()
                      close()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    {notification.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

              {notification.secondaryActionLabel &&
                notification.onSecondaryAction && (
                  <button
                    type="button"
                    onClick={async () => {
                      await notification.onSecondaryAction?.()
                      close()
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    {
                      notification.secondaryActionLabel
                    }
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Close */}
        {notification.dismissible !==
          false && (
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={close}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress */}
      {!isPersistent && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-slate-100 dark:bg-slate-900">
          <div
            className={cn(
              "h-full origin-left",
              config.progressClass,
              paused
                ? "opacity-60"
                : "animate-[enterprise-toast-progress_var(--toast-duration)_linear_forwards]"
            )}
            style={{
              "--toast-duration": `${duration}ms`,
              width: paused
                ? `${Math.max(
                    0,
                    Math.min(
                      100,
                      (remainingRef.current /
                        duration) *
                        100
                    )
                  )}%`
                : undefined,
            } as React.CSSProperties}
          />
        </div>
      )}
    </article>
  )
}

/* ============================================================================
   CONTAINER (mount this once at app root)
============================================================================ */

function ToastStyleKeyframes() {
  return (
    <style>{`
      @keyframes enterprise-toast-in {
        from {
          opacity: 0;
          transform: translateY(-8px) scale(.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes enterprise-toast-out {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-6px) scale(.98);
        }
      }

      @keyframes enterprise-toast-progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
        }
      }
    `}</style>
  )
}

export function CenteredCrudModalToastContainer() {
  const notifications = React.useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot
  )

  React.useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        dismissAll()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )
  }, [])

  return (
    <>
      <ToastStyleKeyframes />
      <EnterpriseNotificationViewport
        notifications={notifications}
        onDismiss={dismissToast}
      />
    </>
  )
}

export const EnterpriseToastContainer =
  CenteredCrudModalToastContainer

export default CenteredCrudModalToastContainer
