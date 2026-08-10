import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { CircleAlert } from "lucide-react"

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  children,
  className,
  ...props
}: FormFieldProps) {
  // Generate a fallback id from label if not provided
  const generatedId = React.useId()
  const fieldId = id || (label ? `field-${label.toLowerCase().replace(/\s+/g, "-")}-${generatedId}` : undefined)

  // Clone child input/control to inject id, aria-invalid, and error border styling automatically
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const childProps: Record<string, any> = {}
      if (fieldId && !child.props.id) {
        childProps.id = fieldId
      }
      if (error) {
        childProps["aria-invalid"] = true
      }
      childProps.className = cn(
        child.props.className,
        error && "border-destructive focus-visible:ring-destructive/40 text-destructive placeholder:text-destructive/50"
      )
      return React.cloneElement(child, childProps)
    }
    return child
  })

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {label && (
        <Label htmlFor={fieldId} className="text-xs font-semibold tracking-wide text-foreground/90">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      {enhancedChildren}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] font-medium text-destructive animate-in fade-in-50 duration-150">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

interface FieldMessageProps {
  error?: string
  hint?: string
  className?: string
}

export function FieldMessage({ error, hint, className }: FieldMessageProps) {
  if (!error && !hint) return null
  return (
    <div className={cn("mt-1", className)}>
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] font-medium text-destructive animate-in fade-in-50 duration-150">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function InlineError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null
  return (
    <p role="alert" className={cn("flex items-start gap-1.5 text-[11px] font-medium text-destructive animate-in fade-in-50 duration-150", className)}>
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

