import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  selectedCount: number;
  role: string;
  bulkPropertyOptions: string[];
  propsById: Record<string, { name?: string }>;
  bulkProperty: string;
  onBulkPropertyChange: (v: string) => void;
  bulkCondition: string;
  onBulkConditionChange: (v: string) => void;
  onApplyProperty: () => void;
  onApplyCondition: () => void;
  onExportSelected: () => void;
  onExportQrSheet: () => void;
  onDeleteSelected: () => void;
  onClear: () => void;
};

export default function BulkActionsBar({
  selectedCount,
  role,
  bulkPropertyOptions,
  propsById,
  bulkProperty,
  onBulkPropertyChange,
  bulkCondition,
  onBulkConditionChange,
  onApplyProperty,
  onApplyCondition,
  onExportSelected,
  onExportQrSheet,
  onDeleteSelected,
  onClear,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="text-sm font-medium text-primary">
        {selectedCount} selected
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {/* Bulk assign property */}
        {(role === "admin" || role === "manager") && (
          <div className="flex items-center gap-2">
            <Select value={bulkProperty} onValueChange={onBulkPropertyChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Assign property" />
              </SelectTrigger>
              <SelectContent>
                {bulkPropertyOptions.filter(Boolean).map((pid) => (
                  <SelectItem key={pid} value={pid}>
                    {propsById[pid]?.name || pid}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!bulkProperty}
              onClick={onApplyProperty}
            >
              Apply
            </Button>
          </div>
        )}
        {/* Bulk change condition */}
        {role !== "user" && (
          <div className="flex items-center gap-2">
            <Select value={bulkCondition} onValueChange={onBulkConditionChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Change condition" />
              </SelectTrigger>
              <SelectContent>
                {["excellent", "good", "fair", "poor", "damaged"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!bulkCondition}
              onClick={onApplyCondition}
            >
              Apply
            </Button>
          </div>
        )}
        {/* Export selected */}
        <Button variant="outline" size="sm" onClick={onExportSelected}>
          Export Selection
        </Button>
        <Button variant="outline" size="sm" onClick={onExportQrSheet}>
          Generate & Download QR Sheet
        </Button>
        {role === "admin" && selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
            Delete Selected
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
