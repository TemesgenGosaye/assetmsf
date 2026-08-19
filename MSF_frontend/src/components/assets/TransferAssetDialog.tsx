import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Building2,
  MapPin,
  User,
  FileText,
  Loader2,
  Package,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { createTransfer, type AssetTransfer } from "@/services/transfers";
import { listDepartments, type Department } from "@/services/departments";
import { listUsers, type AppUser } from "@/services/users";
import { listProperties, type Property } from "@/services/properties";

type TransferAssetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    id: string;
    asset_code: string;
    name: string;
    department?: string | null;
    property?: string | null;
    property_id?: string | null;
    owner_name?: string | null;
    owner_email?: string | null;
    location?: string | null;
    quantity?: number;
    status?: string;
    type?: string;
  } | null;
  onTransferCreated?: (transfer: AssetTransfer) => void;
};

export default function TransferAssetDialog({
  open,
  onOpenChange,
  asset,
  onTransferCreated,
}: TransferAssetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // Form state
  const [toDepartment, setToDepartment] = useState("");
  const [toOwner, setToOwner] = useState<string>("");
  const [toProperty, setToProperty] = useState<string>("");
  const [toLocation, setToLocation] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState<number>(1);

  // Load reference data
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      listDepartments().catch(() => [] as Department[]),
      listUsers().catch(() => [] as AppUser[]),
      listProperties().catch(() => [] as Property[]),
    ]).then(([depts, u, props]) => {
      setDepartments(depts);
      setUsers(u);
      setProperties(props);
      setLoading(false);
    });
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && asset) {
      setToDepartment("");
      setToOwner("");
      setToProperty("");
      setToLocation("");
      setReason("");
      setNotes("");
      setQuantity(1);
    }
  }, [open, asset]);

  const handleSubmit = async () => {
    if (!asset) return;
    if (!toDepartment && !toProperty && !toOwner) {
      toast.error("Please select at least one target (department, property, or owner).");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for the transfer.");
      return;
    }

    setSubmitting(true);
    try {
      const transfer = await createTransfer({
        asset: asset.asset_code || asset.id,
        to_department: toDepartment || undefined,
        to_owner: toOwner || undefined,
        to_property: toProperty || undefined,
        to_location: toLocation,
        reason: reason.trim(),
        notes: notes.trim(),
        quantity,
      });
      toast.success(`Transfer ${transfer.transfer_code} created successfully`);
      onTransferCreated?.(transfer);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  };

  if (!asset) return null;

  const currentDept = asset.department || "Unassigned";
  const currentProp =
    properties.find((p) => String(p.id) === String(asset.property_id))?.name ||
    asset.property ||
    "—";
  const currentOwner = asset.owner_name || "Unassigned";
  const currentLoc = asset.location || "—";
  const maxQty = asset.quantity || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Asset
          </DialogTitle>
          <DialogDescription>
            Transfer this asset to a different department, property, or owner.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading options...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Asset Summary Card */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{asset.asset_code}</span>
                    {asset.status && (
                      <Badge variant="secondary" className="text-xs">
                        {asset.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{asset.name}</p>
                </div>
              </div>

              {/* Current Location — visual flow */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current Location
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{currentDept}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{currentProp}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{currentOwner}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Details
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="truncate">{currentLoc}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Qty:</span>
                      <span>{maxQty}</span>
                    </div>
                    {asset.type && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="truncate">{asset.type}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Transfer Target Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-primary" />
                Transfer To
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Department */}
                <div className="space-y-1.5">
                  <Label htmlFor="to-dept" className="text-xs font-medium">
                    Target Department
                  </Label>
                  <Select value={toDepartment} onValueChange={setToDepartment}>
                    <SelectTrigger id="to-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}{d.code ? ` (${d.code})` : ''}
                        </SelectItem>
                      ))}
                      {!departments.length && (
                        <SelectItem value="none" disabled>
                          No departments found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Property */}
                <div className="space-y-1.5">
                  <Label htmlFor="to-prop" className="text-xs font-medium">
                    Target Property
                  </Label>
                  <Select value={toProperty} onValueChange={setToProperty}>
                    <SelectTrigger id="to-prop">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                      {!properties.length && (
                        <SelectItem value="none" disabled>
                          No properties found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Owner */}
                <div className="space-y-1.5">
                  <Label htmlFor="to-owner" className="text-xs font-medium">
                    Target Owner
                  </Label>
                  <Select value={toOwner} onValueChange={setToOwner}>
                    <SelectTrigger id="to-owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Location */}
                <div className="space-y-1.5">
                  <Label htmlFor="to-loc" className="text-xs font-medium">
                    Target Location
                  </Label>
                  <Input
                    id="to-loc"
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    placeholder="e.g., Floor 3, Room 301"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Transfer Details */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Transfer Details
              </h4>
              <div className="space-y-4">
                {/* Quantity */}
                {maxQty > 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-xs font-medium">
                      Quantity to Transfer
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={maxQty}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value) || 1)))
                      }
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum available: {maxQty}
                    </p>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label htmlFor="reason" className="text-xs font-medium">
                    Reason for Transfer <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this asset needs to be transferred..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-medium">
                    Additional Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions or conditions..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Info banner */}
            {!toDepartment && !toProperty && !toOwner && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Please select at least one transfer target (department, property, or owner) to proceed.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || (!toDepartment && !toProperty && !toOwner) || !reason.trim()}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Transfer...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4" />
                Create Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
