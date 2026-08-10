/**
 * Global toast adapter.
 *
 * Every module that calls `import { toast } from "sonner"` receives the SAME
 * function object. We patch that object's methods once at startup so that the
 * entire application — every page, every service — routes its notifications
 * through the unified centered "SAMS" toast system without touching call sites.
 *
 * Just `import "@/lib/toast-global"` once (first import in main.tsx).
 */
import { toast as sonnerToast } from "sonner"
import type { ReactNode } from "react"
import {
  showToast,
  updateToast,
  dismissToast,
  dismissAll,
} from "@/components/ui/centered-crud-toast"
import type { ToastVariant, ToastPosition } from "@/components/ui/centered-crud-toast"

interface SonnerData {
  description?: ReactNode
  duration?: number
  position?: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
}

const POSITION_MAP: Record<string, ToastPosition> = {
  "top-center": "top-center",
  "bottom-center": "bottom-center",
  "top-left": "top-left",
  "top-right": "top-right",
  "bottom-left": "bottom-left",
  "bottom-right": "bottom-right",
  top: "top-center",
  bottom: "bottom-center",
}

function resolvePosition(position?: string): ToastPosition | undefined {
  return position ? POSITION_MAP[position] : undefined
}

function toOptions(message: unknown, data?: SonnerData, variant: ToastVariant) {
  return {
    title: String(message ?? ""),
    description: data?.description,
    variant,
    duration:
      typeof data?.duration === "number" && data.duration > 0
        ? data.duration
        : undefined,
    position: resolvePosition(data?.position),
    actionLabel: data?.action?.label,
    onAction: data?.action?.onClick,
    icon: data?.icon,
  }
}

let counter = 0
function genId() {
  return `sonner-${Date.now().toString(36)}-${++counter}`
}

export function patchSonnerToast() {
  const source = sonnerToast as unknown as Record<string, unknown>

  const route = (variant: ToastVariant) => (message: unknown, data?: SonnerData) => {
    const id = genId()
    showToast({ id, ...toOptions(message, data, variant) })
    return id
  }

  source.success = route("success")
  source.error = route("error")
  source.warning = route("warning")
  source.info = route("info")

  source.message = (message: unknown, data?: SonnerData) => {
    const text = String(message ?? "")
    // "Creating ticket…" style messages are treated as in-progress operations.
    if (/…$|\.\.\.$/.test(text)) {
      const id = genId()
      showToast({ id, ...toOptions(message, data, "loading"), duration: Infinity })
      return id
    }
    return route("info")(message, data)
  }

  source.loading = (message: unknown, data?: SonnerData) => {
    const id = genId()
    showToast({ id, ...toOptions(message, data, "loading"), duration: Infinity })
    return id
  }

  source.promise = (promise: Promise<unknown>, data?: any) => {
    const id = genId()
    showToast({ id, title: data?.loading ?? "Processing…", variant: "loading", duration: Infinity })
    promise.then(
      (result) => {
        const message =
          typeof data?.success === "function"
            ? data.success(result)
            : (data?.success ?? "Completed successfully")
        updateToast(id, {
          title: message,
          variant: "success",
          badge: "COMPLETED",
          confetti: true,
          duration: 4200,
        })
      },
      (err) => {
        const message =
          typeof data?.error === "function"
            ? data.error(err)
            : (data?.error ?? (err as Error)?.message ?? "Something went wrong")
        updateToast(id, { title: message, variant: "error", badge: "FAILED", duration: 7000 })
      },
    )
    return id
  }

  source.dismiss = (id?: unknown) => {
    if (id != null) dismissToast(String(id))
    else dismissAll()
  }
}

patchSonnerToast()
