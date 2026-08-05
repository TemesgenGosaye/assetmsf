import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssetForm } from "@/components/assets/AssetForm";
import { Maximize2, Minimize2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAsset: any | null;
  initialData?: Record<string, any>;
  onSubmit: (data: any) => Promise<boolean>;
  onCancel: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onBulkImport: () => void;
};

export default function AssetFormDialog({
  open,
  onOpenChange,
  selectedAsset,
  initialData,
  onSubmit,
  onCancel,
  isExpanded,
  onToggleExpanded,
  onBulkImport,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-y-auto transition-all duration-200",
          isExpanded
            ? "w-full h-full max-w-none max-h-none rounded-none p-4 sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg sm:p-6"
            : "max-w-4xl max-h-[90vh]",
        )}
      >
        <DialogHeader className="flex flex-row items-start justify-between space-y-0 text-left">
          <div className="space-y-1.5">
            <DialogTitle>
              {selectedAsset ? "Edit Asset" : "Add New Asset"}
            </DialogTitle>
            <DialogDescription>
              {selectedAsset
                ? "Update the details of this asset."
                : "Fill in the details to create a new asset."}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {!selectedAsset && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkImport}
                className="hidden sm:flex"
              >
                Bulk Import
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hidden sm:flex"
              onClick={onToggleExpanded}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>
        <AssetForm
          mode="modal"
          onSubmit={onSubmit}
          initialData={initialData}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
