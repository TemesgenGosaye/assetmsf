import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "success" | "danger" | "warning" | "info" | "default";
  /** When set, the user must type this exact string to enable the confirm button. */
  requireText?: string;
  /** Optional icon override. */
  icon?: ReactNode;
  /** Optional async handler executed when confirming. While it runs, the dialog shows a spinner. */
  onConfirm?: () => void | Promise<void>;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setError(null);
    setTyped("");
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
    setLoading(false);
    setError(null);
    setTyped("");
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    if (options.requireText && typed !== options.requireText) return;
    setError(null);
    try {
      if (options.onConfirm) {
        setLoading(true);
        await options.onConfirm();
      }
      close(true);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [options, typed, close]);

  const variant = options?.variant || "default";

  const config = useMemo(() => {
    switch (variant) {
      case "success":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
          colorClass: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-950/30",
          buttonVariant: "default" as const,
          btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white"
        };
      case "danger":
        return {
          icon: <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
          colorClass: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:bg-rose-950/30",
          buttonVariant: "destructive" as const,
          btnClass: ""
        };
      case "warning":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          colorClass: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:bg-amber-950/30",
          buttonVariant: "default" as const,
          btnClass: "bg-amber-600 hover:bg-amber-700 text-white"
        };
      case "info":
        return {
          icon: <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
          colorClass: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:bg-sky-950/30",
          buttonVariant: "default" as const,
          btnClass: "bg-sky-600 hover:bg-sky-700 text-white"
        };
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5 text-primary" />,
          colorClass: "bg-primary/10 text-primary ring-primary/20",
          buttonVariant: "default" as const,
          btnClass: ""
        };
    }
  }, [variant]);

  const requireMatch =
    options?.requireText != null && typed === options.requireText;
  const confirmDisabled =
    loading || (options?.requireText != null && !requireMatch);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(options)}
        onOpenChange={(open) => {
          if (!open && !loading) close(false);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border/60 bg-card/95 shadow-xl">
          <DialogHeader className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset",
                config.colorClass
              )}
            >
              {options?.icon ?? config.icon}
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {options?.title}
              </DialogTitle>
              {options?.description && (
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {options.description}
                </DialogDescription>
              )}
            </div>
          </DialogHeader>

          {options?.requireText != null && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type{" "}
                <span className="font-semibold text-foreground">
                  {options.requireText}
                </span>{" "}
                to confirm.
              </p>
              <Input
                value={typed}
                autoFocus
                onChange={(e) => setTyped(e.target.value)}
                className="h-10 rounded-xl border-border/60 bg-muted/20"
                placeholder={options.requireText}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={config.buttonVariant}
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className={cn("w-full sm:w-auto", config.btnClass)}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {options?.confirmLabel ?? (variant === "danger" ? "Delete" : "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx.confirm;
}
