import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, QrCode, ArrowRightLeft, Trash2, MoreVertical, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetActionsDropdownProps {
  onEdit: () => void;
  onQRCode: () => void;
  onTransfer: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
  onRequestEdit?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  showRequestEdit?: boolean;
  className?: string;
}

export function AssetActionsDropdown({
  onEdit,
  onQRCode,
  onTransfer,
  onPrint,
  onDelete,
  onRequestEdit,
  canEdit = true,
  canDelete = true,
  showRequestEdit = false,
  className,
}: AssetActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 rounded-md p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            className
          )}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {canEdit && !showRequestEdit && (
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit</span>
          </DropdownMenuItem>
        )}
        {showRequestEdit && onRequestEdit && (
          <DropdownMenuItem onClick={onRequestEdit} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" />
            <span>Request Edit</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onQRCode} className="cursor-pointer">
          <QrCode className="mr-2 h-4 w-4" />
          <span>QR Code</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTransfer} className="cursor-pointer">
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          <span>Transfer</span>
        </DropdownMenuItem>
        {onPrint && (
          <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
            <Printer className="mr-2 h-4 w-4" />
            <span>Print</span>
          </DropdownMenuItem>
        )}
        {canDelete && onDelete && (
          <>
            <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
