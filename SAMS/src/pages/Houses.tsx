import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveData } from "@/hooks/useLiveData";
import { toast } from "sonner";
import {
  Home,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  LayoutGrid,
  Filter,
  X,
  Building,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import MetricCard from "@/components/ui/metric-card";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import {
  listHouses,
  createHouse,
  updateHouse,
  deleteHouse,
  HOUSE_TYPES,
  HOUSE_STATUSES,
  DAMAGE_OPTIONS,
  type House,
  type HouseFormData,
  type HouseType,
  type HouseStatus,
} from "@/services/houses";

// ── Constants ──────────────────────────────────────────────────────────────

const EMPTY_FORM: HouseFormData = {
  location: "",
  house_type: "Staff",
  status: "Active",
  damaged_door: false,
  damaged_windows: false,
  damaged_walls: false,
  damaged_switch: false,
  damaged_bulb: false,
  damaged_water: false,
  description: "",
  capacity: 1,
};

const TYPE_COLORS: Record<HouseType, string> = {
  Staff:
    "bg-slate-500/10   text-slate-700   border-slate-400/30   dark:text-slate-300  border",
  A: "bg-blue-500/10    text-blue-700    border-blue-400/30    dark:text-blue-400   border",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400 border",
  C: "bg-violet-500/10  text-violet-700  border-violet-400/30  dark:text-violet-400 border",
  D: "bg-amber-500/10   text-amber-700   border-amber-400/30   dark:text-amber-400  border",
  E: "bg-rose-500/10    text-rose-700    border-rose-400/30    dark:text-rose-400   border",
};

const TYPE_LABELS: Record<HouseType, string> = {
  Staff: "Staff",
  A: "Type A",
  B: "Type B",
  C: "Type C",
  D: "Type D",
  E: "Barrack",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HouseStatus }) {
  return status === "Active" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
      <XCircle className="h-3 w-3" /> Inactive
    </span>
  );
}

function TypeBadge({ type }: { type: HouseType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// ── Form Dialog ───────────────────────────────────────────────────────────

function HouseFormDialog({
  open,
  onClose,
  onSave,
  editingHouse,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: HouseFormData) => Promise<void>;
  editingHouse: House | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<HouseFormData>(EMPTY_FORM);
  const [expanded, setExpanded] = useState(false);
  const set = (k: keyof HouseFormData, v: any) =>
    setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm(
        editingHouse
          ? {
              location: editingHouse.location,
              house_type: editingHouse.house_type,
              status: editingHouse.status,
              damaged_door: editingHouse.damaged_door,
              damaged_windows: editingHouse.damaged_windows,
              damaged_walls: editingHouse.damaged_walls,
              damaged_switch: editingHouse.damaged_switch,
              damaged_bulb: editingHouse.damaged_bulb,
              damaged_water: editingHouse.damaged_water,
              description: editingHouse.description,
              capacity: editingHouse.capacity,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, editingHouse]);

  const handleSave = async () => {
    if (!form.location.trim()) {
      toast.error("Location is required", {
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 3000,
      });
      return;
    }
    if (form.capacity < 1) {
      toast.error("Capacity must be at least 1", {
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 3000,
      });
      return;
    }
    await onSave(form);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-200",
          expanded
            ? "w-full h-full max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg"
            : "sm:max-w-xl max-h-[90vh]",
        )}
      >
        <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-14 text-left border-b border-border/60 bg-muted/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Home className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <DialogTitle>
                {editingHouse ? "Edit House" : "Add New House"}
              </DialogTitle>
              <DialogDescription>
                {editingHouse
                  ? "Update the house details below."
                  : "Fill in the details to register a new house."}
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Location & Classification
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Compound A – Block 1, Unit 101"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.house_type}
                    onValueChange={(v) => set("house_type", v as HouseType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUSE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0 text-[10px] font-bold ${TYPE_COLORS[t]}`}
                            >
                              {TYPE_LABELS[t]}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set("status", v as HouseStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUSE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Capacity <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.capacity}
                  onChange={(e) =>
                    set("capacity", Math.max(1, Number(e.target.value)))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of residents this unit can accommodate.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-primary" />
              Damage Assessment
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Select all damaged items in this unit.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/30 transition-colors has-[:checked]:border-destructive/40 has-[:checked]:bg-destructive/5"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive/30"
                      checked={form[opt.key]}
                      onChange={(e) => set(opt.key, e.target.checked)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building className="h-4 w-4 text-primary" />
              Additional Notes
            </div>
            <Textarea
              rows={3}
              placeholder="Optional notes about this house…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 min-w-[120px] rounded-xl"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingHouse ? "Save Changes" : "Add House"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Houses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Live data — serves from cache instantly, revalidates silently
  const {
    data: houseData,
    loading,
    refresh: refreshHouses,
  } = useLiveData<House[]>("houses:list", () => listHouses(), []);
  const houses = houseData ?? [];

  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [role] = useState<string>(() => {
    try {
      const r = localStorage.getItem("auth_user");
      return r ? (JSON.parse(r).role ?? "").toLowerCase() : "";
    } catch {
      return "";
    }
  });
  const isAdmin = role === "admin" || role === "manager";

  const filtered = useMemo(
    () =>
      houses.filter((h) => {
        if (typeFilter !== "all" && h.house_type !== typeFilter) return false;
        if (statusFilter !== "all" && h.status !== statusFilter) return false;
        return true;
      }),
    [houses, typeFilter, statusFilter],
  );

  const metrics = useMemo(
    () => ({
      total: houses.length,
      active: houses.filter((h) => h.status === "Active").length,
      inactive: houses.filter((h) => h.status === "Inactive").length,
      capacity: houses.reduce((s, h) => s + h.capacity, 0),
      typeA: houses.filter((h) => h.house_type === "A").length,
      typeD: houses.filter((h) => h.house_type === "D").length,
    }),
    [houses],
  );

  const openAdd = () => {
    setEditingHouse(null);
    setDialogOpen(true);
  };
  const openEdit = (h: House) => {
    setEditingHouse(h);
    setDialogOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !houses.length) return;

    const target = houses.find((h) => String(h.id) === String(editId));
    if (!target) return;

    setEditingHouse(target);
    setDialogOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, houses, setSearchParams]);

  const handleSave = async (data: HouseFormData) => {
    setSaving(true);
    try {
      if (editingHouse) {
        const updated = await updateHouse(editingHouse.id, data);
        refreshHouses();
        toast.success(`${updated.house_id} updated`, {
          icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
          description: `${updated.location} — ${TYPE_LABELS[updated.house_type]}`,
          duration: 4000,
        });
        await logActivity("house_updated", `House ${updated.house_id} updated`);
        await trackActivity("house", "update", {
          entityName: updated.house_id,
          entityId: updated.id,
        });
      } else {
        const created = await createHouse(data);
        refreshHouses();
        toast.success(`${created.house_id} created`, {
          icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
          description: `${created.location} · ${TYPE_LABELS[created.house_type]}`,
          duration: 4000,
        });
        await logActivity("house_created", `House ${created.house_id} created`);
        await trackActivity("house", "create", {
          entityName: created.house_id,
          entityId: created.id,
        });
      }
      setDialogOpen(false);
      setEditingHouse(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("edit");
          return next;
        },
        { replace: true },
      );
    } catch (e: any) {
      toast.error("Failed to save house", {
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        description: e.message || "An unexpected error occurred",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHouse(deleteTarget.id);
      refreshHouses();
      toast.success(`${deleteTarget.house_id} deleted`, {
        icon: <Trash2 className="h-4 w-4 text-rose-500" />,
        description: `${deleteTarget.location}`,
        duration: 4000,
      });
      await logActivity(
        "house_deleted",
        `House ${deleteTarget.house_id} deleted`,
      );
      await trackActivity("house", "delete", {
        entityName: deleteTarget.house_id,
        entityId: deleteTarget.id,
      });
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error("Failed to delete", {
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        description: e.message || "An unexpected error occurred",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(
    (): ColDef<House>[] => [
      {
        key: "house_id",
        header: "HID",
        sortable: true,
        width: "w-28",
        pinned: true,
        value: (h) => h.house_id,
        cell: (h) => (
          <span className="font-mono text-xs font-semibold tracking-wide text-primary">
            {h.house_id}
          </span>
        ),
      },
      {
        key: "house_type",
        header: "Type",
        sortable: true,
        width: "w-28",
        value: (h) => h.house_type,
        cell: (h) => <TypeBadge type={h.house_type} />,
      },
      {
        key: "location",
        header: "Location",
        sortable: true,
        width: "min-w-[200px]",
        value: (h) => h.location,
        cell: (h) => (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate text-sm">{h.location}</span>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        width: "w-28",
        value: (h) => h.status,
        cell: (h) => <StatusBadge status={h.status} />,
      },
      ...[
        { key: "damaged_door" as const, label: "Doors" },
        { key: "damaged_windows" as const, label: "Windows" },
        { key: "damaged_walls" as const, label: "Walls" },
        { key: "damaged_switch" as const, label: "Switch" },
        { key: "damaged_water" as const, label: "Water" },
        { key: "damaged_bulb" as const, label: "Bulb" },
      ].map((d) => ({
        key: d.key,
        header: d.label,
        width: "w-[72px]" as const,
        align: "center" as const,
        value: (h: House) => (h[d.key] ? "Damaged" : "OK"),
        cell: (h: House) =>
          h[d.key] ? (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-destructive/10 text-destructive">
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          ),
      })),
      {
        key: "capacity",
        header: "Capacity",
        sortable: true,
        width: "w-24",
        align: "center",
        value: (h) => h.capacity,
        cell: (h) => (
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="tabular-nums text-sm font-medium">
              {h.capacity}
            </span>
          </div>
        ),
      },
      {
        key: "description",
        header: "Description",
        width: "min-w-[180px]",
        value: (h) => h.description,
        cell: (h) =>
          h.description ? (
            <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
              {h.description}
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          ),
      },
      ...(isAdmin
        ? [
            {
              key: "actions",
              header: "",
              width: "w-20",
              pinned: true,
              align: "right" as const,
              cell: (h: House) => (
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(h);
                    }}
                    title="Edit"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(h);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
    [isAdmin],
  );

  return (
    <div className="space-y-6 p-6">
      <Breadcrumbs items={[{ label: "Houses", to: "/houses" }]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
            <Home className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Houses</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage all housing units — Staff, Types A through E (Barrack).
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add House
          </Button>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          icon={Home}
          title="Total"
          value={metrics.total}
          variant="blue"
          onClick={() => {
            setTypeFilter("all");
            setStatusFilter("all");
          }}
          caption="All units"
        />
        <MetricCard
          icon={CheckCircle2}
          title="Active"
          value={metrics.active}
          variant="emerald"
          onClick={() => setStatusFilter("Active")}
          caption="In use"
        />
        <MetricCard
          icon={XCircle}
          title="Inactive"
          value={metrics.inactive}
          variant="rose"
          onClick={() => setStatusFilter("Inactive")}
          caption="Off-service"
        />
        <MetricCard
          icon={Users}
          title="Capacity"
          value={metrics.capacity}
          variant="violet"
          caption="Total residents"
        />
        <MetricCard
          icon={LayoutGrid}
          title="Type A/B"
          value={metrics.typeA}
          variant="cyan"
          onClick={() => setTypeFilter("A")}
          caption="Standard units"
        />
        <MetricCard
          icon={Building}
          title="Type D"
          value={metrics.typeD}
          variant="amber"
          onClick={() => setTypeFilter("D")}
          caption="VIP villas"
        />
      </div>

      {/* Active filter chips */}
      {(typeFilter !== "all" || statusFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {typeFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Type: {TYPE_LABELS[typeFilter as HouseType]}
              <button
                onClick={() => setTypeFilter("all")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              {statusFilter}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <DataTable<House>
        tableKey="houses"
        columns={columns}
        data={filtered}
        rowKey={(h) => h.id}
        loading={loading}
        searchable
        searchPlaceholder="Search by HID, location…"
        emptyMessage="No houses found"
        exportFileName={`houses-${new Date().toISOString().slice(0, 10)}`}
        pageSize={50}
        onRowDoubleClick={(h) => navigate(`/houses/${h.id}`)}
        toolbarLeft={
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {HOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {HOUSE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <HouseFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingHouse(null);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("edit");
              return next;
            },
            { replace: true },
          );
        }}
        onSave={handleSave}
        editingHouse={editingHouse}
        saving={saving}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete House</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteTarget?.house_id}</strong> at{" "}
              {deleteTarget?.location}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
