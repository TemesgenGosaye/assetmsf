import { Fragment } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RowAction } from "./types";

export interface RowActionsMenuProps<T> {
  row: T;
  actions: RowAction<T>[];
  label?: string;
  align?: "start" | "end";
  className?: string;
}

export function RowActionsMenu<T>({
  row,
  actions,
  label = "Row actions",
  align = "end",
  className,
}: RowActionsMenuProps<T>) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40",
            className,
          )}
          aria-label={label}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48 min-w-0">
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <Fragment key={action.label}>
              {action.separator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={action.disabled}
                className={cn(
                  action.variant === "destructive" &&
                    "text-destructive focus:text-destructive focus:bg-destructive/10",
                )}
                onClick={() => action.onClick?.(row)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
