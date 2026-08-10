import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

// The real `sonner` toast object is globally patched in `@/lib/toast-global`,
// so every `toast.success/error/warning/info/...` call in the app is routed
// through the unified centered SAMS toast system. This renderer is kept as a
// silent fallback for any unpatched custom renderings (e.g. `toast.custom`).

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
