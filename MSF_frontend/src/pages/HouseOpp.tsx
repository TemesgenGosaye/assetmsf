import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { toast } from "sonner";
import { setCachedValue } from "@/lib/data-cache";
import { SearchLoadingSkeleton } from "@/components/ui/page-skeletons";
import { useSearchLoading } from "@/hooks/useDebouncedValue";
import SearchCircularLoader from "@/components/common/SearchCircularLoader";
import {
  Home,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  Tag,
  CheckCircle2,
  XCircle,
  Users,
  Filter,
  X,
  Building,
  Hash,
  AlertTriangle,
  Search,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  Inbox,
  Clock3,
  ArrowRight,
  Award,
  ChevronDown,
  Barcode,
  Settings,
  Settings2,
  MoreVertical,
  Zap,
  LogOut,
  Bell,
  FileText,
  KeyRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { BarcodeGenerator } from "@/components/barcode/BarcodeGenerator";
import { HouseActionsDropdown } from "@/components/houses/HouseActionsDropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import MetricCard from "@/components/ui/metric-card";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import StatusChip from "@/components/ui/status-chip";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import {
  listHouses,
  createHouse,
  updateHouse,
  deleteHouse,
  HOUSE_TYPES,
  HOUSE_STATUSES,
  ALLOCATION_CATEGORY_OPTIONS,
  DAMAGE_OPTIONS,
  HOUSE_TYPE_ROOMS,
  HOUSE_TYPE_ROOM_LABELS,
  ROOM_STATUS_STYLES,
  ROOM_STATUSES,
  type House,
  type HouseFormData,
  type HouseType,
  type HouseStatus,
  type AllocationCategory,
  type RoomStatus,
} from "@/services/houses";
import {
  listApplications,
  batchAllocateAll,
  JOB_TYPE_OPTIONS,
  HOUSE_CATEGORIES,
  type HouseApplication,
} from "@/services/houseApplication";

type QueueRow = HouseApplication & {
  queuePosition: number;
  queueTimestamp: string | null;
};

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
  inside_items: [],
  description: "",
  capacity: 1,
  allocation_category: "R",
  r1_status: "Vacant",
  r1_occupant_name: "",
  r1_occupant_id: "",
  r1_notes: "",
  r2_status: "Vacant",
  r2_occupant_name: "",
  r2_occupant_id: "",
  r2_notes: "",
  r3_status: "Vacant",
  r3_occupant_name: "",
  r3_occupant_id: "",
  r3_notes: "",
};

const TYPE_STYLES: Record<HouseType, string> = {
  Staff:
    "bg-slate-500/10 text-slate-700 border-slate-400/30 dark:text-slate-300",
  A: "bg-blue-500/10 text-blue-700 border-blue-400/30 dark:text-blue-400",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400",
  C: "bg-violet-500/10 text-violet-700 border-violet-400/30 dark:text-violet-400",
  D: "bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400",
  E: "bg-rose-500/10 text-rose-700 border-rose-400/30 dark:text-rose-400",
};
const TYPE_LABELS: Record<HouseType, string> = {
  Staff: "Staff",
  A: "Type A",
  B: "Type B",
  C: "Type C",
  D: "Type D",
  E: "Barrack",
};

function HouseOppFormDialog({
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
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<HouseFormData>(EMPTY_FORM);
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
              inside_items: editingHouse.inside_items ?? [],
              description: editingHouse.description,
              capacity: editingHouse.capacity,
              allocation_category: editingHouse.allocation_category,
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
          "p-0 gap-0 overflow-hidden",
          expanded ? "!max-w-[90vw] !w-[90vw]" : "sm:max-w-xl",
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-muted/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Home className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>
                {editingHouse ? "Edit House" : "Register New House"}
              </DialogTitle>
              <DialogDescription>
                {editingHouse
                  ? "Update unit details and damage assessment."
                  : "Fill in the details to register a new housing unit."}
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-full"
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5 max-h-[70vh]">
          <div className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Location &amp; Classification
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>
                    Location <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Compound A – Block 1, Unit 101"
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>
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
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0 text-[10px] font-bold ${TYPE_STYLES[t]}`}
                            >
                              {TYPE_LABELS[t]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>R/G</Label>
                    <Select
                      value={form.allocation_category}
                      onValueChange={(v) => set("allocation_category", v as AllocationCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOCATION_CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
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
                  <div className="space-y-1.5">
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={form.capacity}
                      onChange={(e) =>
                        set("capacity", Math.max(1, Number(e.target.value)))
                      }
                    />
                  </div>
                </div>

              </div>
            </div>
            {form.status === "Inactive" && (
              <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Damage Assessment
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground pb-1">
                    Select all items that are damaged in this unit.
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-left font-normal h-9 text-xs border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                      >
                        <span className="truncate">
                          {DAMAGE_OPTIONS.filter((opt) => form[opt.key]).length > 0
                            ? DAMAGE_OPTIONS.filter((opt) => form[opt.key])
                                .map((opt) => opt.label)
                                .join(", ")
                            : "Select damaged items..."}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <div className="p-1 space-y-0.5">
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer border-b border-border/50 mb-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const allChecked = DAMAGE_OPTIONS.every((opt) => form[opt.key]);
                            DAMAGE_OPTIONS.forEach((opt) => set(opt.key, !allChecked));
                          }}
                        >
                          <Checkbox
                            checked={DAMAGE_OPTIONS.every((opt) => form[opt.key])}
                            className="pointer-events-none"
                          />
                          <span className="text-sm font-medium">Select All</span>
                        </div>
                        {DAMAGE_OPTIONS.map((opt) => (
                          <div
                            key={opt.key}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              set(opt.key, !form[opt.key]);
                            }}
                          >
                            <Checkbox
                              checked={form[opt.key]}
                              className="pointer-events-none"
                            />
                            <span className="text-sm capitalize">{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Inbox className="h-4 w-4 text-primary" />
                Features &amp; Inventory
              </div>
              <div className="space-y-1.5">
                <Label>Inside Items</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between text-left font-normal h-9 text-xs"
                    >
                      <span className="truncate">
                        {form.inside_items && form.inside_items.length > 0
                          ? form.inside_items.join(", ")
                          : "Select items..."}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <div className="p-1 space-y-0.5">
                      <div
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer border-b border-border/50 mb-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const availableItems = ["Bed", "Chair", "Table", "Locker"];
                          const allChecked = availableItems.every((item) => form.inside_items?.includes(item));
                          set("inside_items", !allChecked ? availableItems : []);
                        }}
                      >
                        <Checkbox
                          checked={["Bed", "Chair", "Table", "Locker"].every((item) => form.inside_items?.includes(item))}
                          className="pointer-events-none"
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                      {["Bed", "Chair", "Table", "Locker"].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const current = form.inside_items ?? [];
                            const isChecked = current.includes(item);
                            const next = !isChecked
                              ? [...current, item]
                              : current.filter((x) => x !== item);
                            set("inside_items", next);
                          }}
                        >
                          <Checkbox
                            checked={form.inside_items?.includes(item) ?? false}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Tag className="h-4 w-4 text-primary" />
                Additional Notes
              </div>
              <Textarea
                rows={2}
                placeholder="Optional notes…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
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
            className="rounded-xl gap-2 min-w-[120px]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingHouse ? "Save Changes" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HouseOpp() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [searchLoading, debouncedSearch] = useSearchLoading(search, 300);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [applications, setApplications] = useState<HouseApplication[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [batchAllocating, setBatchAllocating] = useState(false);
  const [queueTypeFilter, setQueueTypeFilter] = useState("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [queueCategoryFilter, setQueueCategoryFilter] = useState("all");
  const [role] = useState<string>(() => {
    try {
      const r = localStorage.getItem("auth_user");
      return r ? (JSON.parse(r).role ?? "").toLowerCase() : "";
    } catch {
      return "";
    }
  });
  const isAdmin = role === "admin" || role === "manager";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listHouses();
        setHouses(data);
        setCachedValue("houses:list", data);
      } catch {
        toast.error("Failed to load houses", {
          icon: <AlertCircle className="h-4 w-4" />,
          duration: 4000,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setQueueLoading(true);
      try {
        const data = await listApplications();
        setApplications(data);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load house queue");
      } finally {
        setQueueLoading(false);
      }
    })();
  }, [isAdmin]);

  const filtered = useMemo(
    () =>
      houses.filter((h) => {
        const q = debouncedSearch.toLowerCase();
        if (
          q &&
          !h.house_id.toLowerCase().includes(q) &&
          !(h.house_number || "").toLowerCase().includes(q) &&
          !h.location.toLowerCase().includes(q)
        )
          return false;
        if (typeFilter !== "all" && h.house_type !== typeFilter) return false;
        if (statusFilter !== "all" && h.status !== statusFilter) return false;
        if (categoryFilter !== "all" && h.allocation_category !== categoryFilter) return false;
        return true;
      }),
    [houses, debouncedSearch, typeFilter, statusFilter, categoryFilter],
  );

  const metrics = useMemo(
    () => ({
      total: houses.length,
      active: houses.filter((h) => h.status === "Active").length,
      inactive: houses.filter((h) => h.status === "Inactive").length,
      damaged: houses.filter((h) => h.damaged_items.length > 0).length,
      capacity: houses.reduce((s, h) => s + h.capacity, 0),
      barrack: houses.filter((h) => h.house_type === "E").length,
    }),
    [houses],
  );

  const houseQueue = useMemo<QueueRow[]>(
    () =>
      applications
        .filter((app) =>
          ["Submitted", "Under Review", "Verified", "Waiting for Allocation", "Allocated"].includes(app.status)
        )
        .filter((app) => queueTypeFilter === "all" || app.job_type === queueTypeFilter)
        .filter((app) => queueStatusFilter === "all" || app.status === queueStatusFilter)
        .filter((app) => queueCategoryFilter === "all" || app.eligible_house_category === queueCategoryFilter)
        .sort((a, b) => {
          if (a.status === "Allocated" && b.status !== "Allocated") return 1;
          if (b.status === "Allocated" && a.status !== "Allocated") return -1;
          const scoreDiff = (b.priority_score || 0) - (a.priority_score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          const aTime = new Date(a.submitted_at || a.created_at).getTime();
          const bTime = new Date(b.submitted_at || b.created_at).getTime();
          return aTime - bTime;
        })
        .map((app, index) => ({
          ...app,
          queuePosition: app.queue_position ?? index + 1,
          queueTimestamp: app.submitted_at || app.created_at,
        })),
    [applications, queueTypeFilter, queueStatusFilter, queueCategoryFilter],
  );

  const queueColumns = useMemo(
    (): ColDef<QueueRow>[] => [
      {
        key: "queuePosition",
        header: "Rank",
        width: "w-20",
        pinned: true,
        align: "center",
        sortable: true,
        value: (app) => app.queuePosition,
        cell: (app) => (
          <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {app.queuePosition}
          </span>
        ),
      },
      {
        key: "priority_score",
        header: "Score",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.priority_score || 0,
        cell: (app) => {
          const score = app.priority_score || 0;
          const color =
            score >= 70 ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
            : score >= 40 ? "bg-amber-500/10 text-amber-700 border-amber-300"
            : "bg-slate-500/10 text-slate-700 border-slate-300";
          return (
            <Badge variant="outline" className={`text-xs font-bold tabular-nums ${color}`}>
              {score.toFixed(1)}
            </Badge>
          );
        },
      },
      {
        key: "application_no",
        header: "Application",
        width: "w-36",
        sortable: true,
        value: (app) => app.application_no,
        cell: (app) => (
          <span className="font-mono text-xs text-muted-foreground">
            {app.application_no}
          </span>
        ),
      },
      {
        key: "employee_id",
        header: "Employee ID",
        width: "w-32",
        sortable: true,
        value: (app) => app.employee_id,
      },
      {
        key: "employee_name",
        header: "Employee Name",
        width: "min-w-[220px]",
        sortable: true,
        value: (app) => app.employee_name,
        cell: (app) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{app.employee_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {app.requester_name || app.requester || "Applicant"}
            </p>
          </div>
        ),
      },
      {
        key: "national_id",
        header: "National ID",
        width: "w-40",
        sortable: true,
        value: (app) => app.national_id,
      },
      {
        key: "gender",
        header: "Gender",
        width: "w-24",
        sortable: true,
        value: (app) => app.gender,
      },
      {
        key: "job_position",
        header: "Job Position",
        width: "min-w-[180px]",
        sortable: true,
        value: (app) => app.job_position,
      },
      {
        key: "job_grade",
        header: "Job Grade",
        width: "w-28",
        sortable: true,
        value: (app) => app.job_grade,
        cell: (app) => app.job_grade || "—",
      },
      {
        key: "job_type",
        header: "Job Type",
        width: "w-28",
        sortable: true,
        value: (app) => app.job_type || "",
        cell: (app) => {
          const t = app.job_type || "";
          const colors: Record<string, string> = {
            Permanent: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
            "Semi Permanent": "bg-amber-500/10 text-amber-700 border-amber-300",
            Seasonal: "bg-blue-500/10 text-blue-700 border-blue-300",
          };
          return t ? (
            <Badge variant="outline" className={`text-xs font-medium ${colors[t] || ""}`}>{t}</Badge>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          );
        },
      },
      {
        key: "years_of_service",
        header: "Years",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.years_of_service,
      },
      {
        key: "marital_status",
        header: "Marital",
        width: "w-32",
        sortable: true,
        value: (app) => app.marital_status,
      },
      {
        key: "has_disability",
        header: "Disability",
        width: "w-28",
        sortable: true,
        align: "center",
        value: (app) => (app.has_disability ? "Yes" : "No"),
        cell: (app) => (
          <Badge
            variant="outline"
            className={
              app.has_disability
                ? "border-amber-300 bg-amber-500/10 text-amber-700"
                : ""
            }
          >
            {app.has_disability ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        key: "family_size",
        header: "Family Size",
        width: "w-28",
        sortable: true,
        align: "center",
        value: (app) => app.family_size,
      },
      {
        key: "number_of_children",
        header: "Children",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.number_of_children,
      },
      {
        key: "eligible_house_category",
        header: "Eligible",
        width: "w-28",
        sortable: true,
        value: (app) => app.eligible_house_category || "",
        cell: (app) => {
          const cat = app.eligible_house_category || "";
          const badgeStyles: Record<string, string> = {
            Staff: "bg-violet-500/10 text-violet-700 border-violet-300",
            A: "bg-blue-500/10 text-blue-700 border-blue-300",
            B: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
            C: "bg-amber-500/10 text-amber-700 border-amber-300",
            D: "bg-orange-500/10 text-orange-700 border-orange-300",
            E: "bg-slate-500/10 text-slate-700 border-slate-300",
          };
          return cat ? (
            <Badge variant="outline" className={`text-xs font-medium ${badgeStyles[cat] || ""}`}>
              {cat === "E" ? "Barrack" : cat === "Staff" ? "Staff" : `Type ${cat}`}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "requested_house_category",
        header: "Requested",
        width: "w-32",
        sortable: true,
        value: (app) => app.requested_house_category,
        cell: (app) => (
          <Badge variant="outline" className="text-xs font-medium">
            {app.requested_house_category === "E"
              ? "Barrack"
              : app.requested_house_category === "Staff"
                ? "Staff"
                : `Type ${app.requested_house_category}`}
          </Badge>
        ),
      },
      {
        key: "preferred_location",
        header: "Preferred Location",
        width: "min-w-[180px]",
        sortable: true,
        value: (app) => app.preferred_location,
        cell: (app) => app.preferred_location || "—",
      },
      {
        key: "reason_for_request",
        header: "Reason",
        width: "min-w-[280px]",
        sortable: true,
        value: (app) => app.reason_for_request,
        cell: (app) => (
          <p className="line-clamp-2 max-w-[320px] text-sm text-muted-foreground">
            {app.reason_for_request || "—"}
          </p>
        ),
      },
      {
        key: "supporting_document",
        header: "Document",
        width: "w-28",
        align: "center",
        value: (app) => (app.supporting_document ? "Yes" : "No"),
        cell: (app) =>
          app.supporting_document ? (
            <Button size="sm" variant="ghost" asChild>
              <a
                href={app.supporting_document}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Open
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "queueTimestamp",
        header: "Submitted At",
        width: "min-w-[170px]",
        sortable: true,
        value: (app) => app.queueTimestamp,
        cell: (app) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {app.queueTimestamp
              ? new Date(app.queueTimestamp).toLocaleString()
              : "—"}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "w-32",
        sortable: true,
        value: (app) => app.status,
        cell: (app) => <StatusChip status={app.status} />,
      },
      {
        key: "actions",
        header: "",
        width: "w-32",
        align: "right",
        pinned: true,
        cell: (app) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              className="h-8 gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/house-opp/queue/${app.id}`);
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Open
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  const handleBatchAllocate = async () => {
    setBatchAllocating(true);
    try {
      const result = await batchAllocateAll();
      const count = result.allocated.length;
      if (count > 0) {
        toast.success(`${count} of ${result.total_houses} houses allocated successfully`);
        await loadHouses();
        loadApplications();
      } else {
        toast.info("No eligible applicants found for any available house");
      }
    } catch (e: any) {
      toast.error(e?.message || "Batch allocation failed");
    } finally {
      setBatchAllocating(false);
    }
  };

  const openAdd = () => {
    setEditingHouse(null);
    setDialogOpen(true);
  };
  const openEdit = (h: House) => {
    setEditingHouse(h);
    setDialogOpen(true);
  };

  const handleSave = async (data: HouseFormData) => {
    setSaving(true);
    try {
      const payload = { ...data } as any;

      if (editingHouse) {
        const updated = await updateHouse(editingHouse.id, payload);
        setHouses((prev) =>
          prev.map((h) => (h.id === updated.id ? updated : h)),
        );
        toast.success(`${updated.house_id} updated`, {
          icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
          description: `${updated.location} · ${TYPE_LABELS[updated.house_type]}`,
          duration: 4000,
        });
        await logActivity("house_updated", `House ${updated.house_id} updated`);
        await trackActivity("house", "update", {
          entityName: updated.house_id,
          entityId: updated.id,
        });
      } else {
        const created = await createHouse(payload);
        setHouses((prev) => [created, ...prev]);
        toast.success(`${created.house_id} registered`, {
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
      setHouses((prev) => prev.filter((h) => h.id !== deleteTarget.id));
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

  const handlePrintHouse = (h: House) => {
    // Placeholder print logic – you can replace with custom PDF generation or printable view
    console.log('Print house', h.id);
    // For now, just trigger the browser print dialog for the whole page
    window.print();
  };

  const damagedCount = (h: House) => h.damaged_items.length;

  const maxRooms = useMemo(() => {
    let max = 1;
    for (const h of houses) {
      const n = h.room_count || HOUSE_TYPE_ROOMS[h.house_type] || 1;
      if (n > max) max = n;
    }
    return max;
  }, [houses]);

  const columns = useMemo(
    (): ColDef<House>[] => [
      {
        key: "house_id",
        header: "HID",
        sortable: true,
        width: "w-36 whitespace-nowrap",
        pinned: true,
        value: (h) => h.house_id,
        cell: (h) => (
          <span className="font-mono text-xs font-semibold tracking-wide text-primary whitespace-nowrap">
            {h.house_id}
          </span>
        ),
      },
      {
        key: "house_type",
        header: "House Type",
        sortable: true,
        width: "w-32",
        value: (h) => h.house_type,
        cell: (h) => (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLES[h.house_type]}`}
          >
            {TYPE_LABELS[h.house_type]}
          </span>
        ),
      },
      {
        key: "house_number",
        header: "House No.",
        sortable: true,
        width: "w-28",
        value: (h) => h.house_number || h.house_id,
        cell: (h) => (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${TYPE_STYLES[h.house_type]}`}>
            {h.house_number || h.house_id}
          </span>
        ),
      },
      {
        key: "allocation_category",
        header: "R/G",
        sortable: true,
        width: "w-16",
        align: "center",
        value: (h) => h.allocation_category,
        cell: (h) => (
          <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold ${
            h.allocation_category === "G"
              ? "border-amber-300/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-sky-300/40 bg-sky-500/10 text-sky-700 dark:text-sky-400"
          }`}>
            {h.allocation_category === "G" ? "G" : "R"}
          </span>
        ),
      },
      ...Array.from({ length: maxRooms }, (_, i) => {
        const roomIndex = i + 1;
        const roomLabel = (h: House) =>
          (h.room_labels && h.room_labels[roomIndex - 1]) ||
          HOUSE_TYPE_ROOM_LABELS[h.house_type]?.[roomIndex - 1] ||
          `R${roomIndex}`;
        const roomName = (h: House) =>
          `${h.house_number || ""}${roomLabel(h)}`;
        const roomStatus = (h: House): RoomStatus =>
          ((h as unknown as Record<string, RoomStatus>)[`r${roomIndex}_status`]) ||
          "Vacant";
        const occupant = (h: House) =>
          (h as unknown as Record<string, string>)[`r${roomIndex}_occupant_name`] ||
          "";
        const occupantId = (h: House) =>
          (h as unknown as Record<string, string>)[`r${roomIndex}_occupant_id`] ||
          "";
        const roomDetail = (h: House) => {
          const occ = occupant(h);
          const occId = occupantId(h);
          const status = roomStatus(h);
          return occ
            ? `${roomName(h)} · ${status} · ${occ}${occId ? ` (${occId})` : ""}`
            : `${roomName(h)} · ${status}`;
        };
        return {
          key: `room_${roomIndex}`,
          header: `Room ${roomIndex}`,
          sortable: true,
          width: "min-w-[130px]",
          value: (h: House) => roomDetail(h),
          cell: (h: House) => {
            const status = roomStatus(h);
            const occ = occupant(h);
            const occId = occupantId(h);
            const letter =
              status === "Vacant"     ? "V"
              : status === "Occupied"  ? "O"
              : status === "Reserved"  ? "R"
              : status === "Maintenance" ? "M"
              : "V";
            return (
              <div
                className="flex min-w-[118px] flex-col gap-1 py-0.5"
                title={roomDetail(h)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold tracking-wide text-foreground/90">
                    {roomName(h)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold",
                      ROOM_STATUS_STYLES[status] || ROOM_STATUS_STYLES["Vacant"],
                    )}
                  >
                    {letter}
                  </span>
                </div>
                {occ && (
                  <span className="max-w-[130px] truncate text-[11px] leading-tight text-muted-foreground">
                    {occ}
                    {occId && (
                      <span className="text-[10px] opacity-70"> ({occId})</span>
                    )}
                  </span>
                )}
              </div>
            );
          },
        };
      }),
      {
        key: "location",
        header: "Location",
        sortable: true,
        width: "min-w-[220px]",
        value: (h) => h.location,
        cell: (h) => (
          <div className="flex items-center gap-2 max-w-[260px]">
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
        cell: (h) => <StatusChip status={h.status} />,
      },
      ...[
        { key: "damaged_door" as const, header: "Door" },
        { key: "damaged_windows" as const, header: "Windows" },
        { key: "damaged_walls" as const, header: "Walls" },
        { key: "damaged_switch" as const, header: "Switch" },
        { key: "damaged_bulb" as const, header: "Bulb" },
        { key: "damaged_water" as const, header: "Water" },
      ].map((damageCol) => ({
        key: damageCol.key,
        header: damageCol.header,
        width: "w-[84px]",
        align: "center" as const,
        value: (h: House) => (h[damageCol.key] ? "Damaged" : "OK"),
        cell: (h: House) =>
          h[damageCol.key] ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-rose-300/40 bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800/60 dark:text-rose-400">
              X
            </span>
          ) : (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/10 px-1.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800/60 dark:text-emerald-400">
              —
            </span>
          ),
      })),
      {
        key: "inside_items",
        header: "Inside Items",
        sortable: false,
        width: "min-w-[160px]",
        value: (h) => h.inside_items?.join(", ") || "",
        cell: (h) => (
          <div className="flex flex-row flex-wrap items-center gap-1">
            {h.inside_items && h.inside_items.length > 0 ? (
              h.inside_items.map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="bg-primary/5 text-primary text-[10px] py-0 px-1.5 font-medium border-primary/20"
                >
                  {item}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground/45 text-xs font-normal">—</span>
            )}
          </div>
        ),
      },
      {
        key: "allocation",
        header: "Allocation",
        sortable: true,
        width: "min-w-[180px]",
        value: (h) => h.allocation_status || "Unassigned",
        cell: (h) => {
          const isAssigned = h.allocation_status === "Assigned";
          return (
            <div className="flex flex-col gap-0.5">
              <span
                className={`inline-flex items-center w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  isAssigned
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                    : "bg-slate-500/10 text-slate-600 border-slate-300"
                }`}
              >
                {isAssigned ? "Assigned" : "Unassigned"}
              </span>
              {isAssigned && h.assigned_employee_name && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                  {h.assigned_employee_name} {h.assigned_employee_id ? `(${h.assigned_employee_id})` : ""}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "assigned_to",
        header: "Allocated To",
        sortable: true,
        width: "min-w-[160px]",
        value: (h) => h.assigned_employee_name || h.assigned_application_no || "",
        cell: (h) =>
          h.assigned_employee_name || h.assigned_application_no ? (
            <div className="flex flex-col gap-0.5">
              {h.assigned_employee_name && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <KeyRound className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="truncate max-w-[150px]">{h.assigned_employee_name}</span>
                </span>
              )}
              {h.assigned_application_no && (
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">
                  Ref: {h.assigned_application_no}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      ...(isAdmin
        ? [
            {
              key: "actions",
              header: "Action",
              width: "w-32",
              pinned: true,
              align: "right" as const,
              cell: (h: House) => {
                const isAssigned = h.allocation_status === "Assigned";
                return (
                  <HouseActionsDropdown
                    onEdit={() => {
                      if (isAssigned) {
                        toast.error("Cannot edit an allocated/assigned house.");
                        return;
                      }
                      openEdit(h);
                    }}
                    onBarcode={() => {
                      setBarcodeValue(h.house_number || h.house_id);
                      setBarcodeOpen(true);
                    }}
                    onPrint={() => handlePrintHouse(h)}
                    onDelete={() => {
                      if (isAssigned) {
                        toast.error("Cannot delete an allocated/assigned house.");
                        return;
                      }
                      setDeleteTarget(h);
                    }}
                    canEdit={isAdmin}
                    canDelete={isAdmin}
                    disableEdit={isAssigned}
                    disableDelete={isAssigned}
                  />
                );
              },
            },
          ]
        : []),
    ],
    [isAdmin, maxRooms],
  );

  return (
    <div className="space-y-6 p-6">
      <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
            <Home className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              House Management | የቤቶች አስተዳደር
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage housing units, track occupancy, and log damage assessments.
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="relative h-10 w-10 shrink-0 rounded-lg border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setQueueOpen(true)}
              title="Applications"
            >
              <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              {houseQueue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                  {houseQueue.length}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-lg border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" title="Operation">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>House Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer font-medium"
                  onClick={openAdd}
                >
                  <Plus className="h-4 w-4 text-primary" /> Add House
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer font-medium"
                  onClick={() => {
                    const el = document.getElementById("house-table-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Home className="h-4 w-4 text-sky-600" /> Show Houses
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer font-medium"
                  onClick={() => setQueueOpen(true)}
                >
                  <Inbox className="h-4 w-4 text-blue-600" /> House Queue
                  <Badge
                    variant="secondary"
                    className="ml-auto rounded-full px-1.5 py-0 text-[10px]"
                  >
                    {houseQueue.length}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer font-medium"
                  onClick={() => navigate("/house-opp/scoring")}
                >
                  <Settings className="h-4 w-4 text-violet-600" /> Scoring Config
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer font-medium"
                  onClick={() => navigate("/house-opp/eligibility")}
                >
                  <Settings className="h-4 w-4 text-amber-600" /> Eligibility Rules
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                  onClick={() => navigate("/residential-hub")}
                >
                  <FileText className="h-4 w-4" /> Rent Management
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                  onClick={() => navigate("/dashboard")}
                >
                  <LogOut className="h-4 w-4" /> Exit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          caption="In service"
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
          icon={AlertTriangle}
          title="Damaged"
          value={metrics.damaged}
          variant="rose"
          onClick={() => setStatusFilter("Inactive")}
          caption="Needs repair"
        />
        <MetricCard
          icon={Building}
          title="Capacity"
          value={metrics.capacity}
          variant="violet"
          caption="Total capacity"
        />
      </div>

      {isAdmin && (
        <Sheet open={queueOpen} onOpenChange={setQueueOpen}>
          <SheetContent
            side="right"
            className="w-full p-0 sm:w-[88vw] sm:max-w-5xl"
          >
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 bg-muted/10 px-6 py-5 pr-12">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                      <Inbox className="h-4 w-4 text-primary" />
                      House Queue
                    </SheetTitle>
                    <SheetDescription>
                      Ranked by priority score. Higher score = higher priority.
                      FIFO is the tie-breaker.
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-primary/5 text-primary"
                    >
                      {houseQueue.length} in queue
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Award className="h-3 w-3" />
                      Priority Ranked
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
                      title="Open queue full page"
                      onClick={() => {
                        setQueueOpen(false);
                        navigate("/house-opp/queue");
                      }}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-auto">
                <DataTable<QueueRow>
                  tableKey="house-queue"
                  data={houseQueue}
                  rowKey={(app) => app.id}
                  loading={queueLoading}
                  searchable
                  emptyMessage="No submitted applications in queue"
                  emptyIcon={
                    <Inbox className="h-8 w-8 text-muted-foreground/30" />
                  }
                  exportFileName={`house-queue-${new Date().toISOString().slice(0, 10)}`}
                  pageSize={25}
                  onRowDoubleClick={(app) =>
                    navigate(`/house-opp/queue/${app.id}`)
                  }
                  columns={queueColumns}
                  toolbarLeft={
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={queueStatusFilter} onValueChange={setQueueStatusFilter}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue placeholder="All status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {["Submitted", "Under Review", "Verified", "Waiting for Allocation", "Allocated"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={queueTypeFilter} onValueChange={setQueueTypeFilter}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue placeholder="All professions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Professions</SelectItem>
                          {JOB_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={queueCategoryFilter} onValueChange={setQueueCategoryFilter}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {HOUSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  }
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by HID, house no. or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <SearchCircularLoader size={16} />
            </div>
          )}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {HOUSE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {HOUSE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue placeholder="All R/G" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All R/G</SelectItem>
            {ALLOCATION_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} unit{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Active filter badges */}
      {(typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all" || search) && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-2">
          {search && (
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              Search: "{search}"
              <button
                onClick={() => setSearch("")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {typeFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              {TYPE_LABELS[typeFilter as HouseType]}
              <button
                onClick={() => setTypeFilter("all")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              {statusFilter}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              R/G: {ALLOCATION_CATEGORY_OPTIONS.find(o => o.value === categoryFilter)?.label ?? categoryFilter}
              <button
                onClick={() => setCategoryFilter("all")}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <div id="house-table-section">
      <DataTable<House>
        tableKey="house-opp"
        columns={columns}
        data={filtered}
        rowKey={(h) => h.id}
        loading={loading}
        searchable={false}
        emptyMessage="No houses found"
        emptyIcon={<Home className="h-8 w-8 text-muted-foreground/30" />}
        exportFileName={`house-operations-${new Date().toISOString().slice(0, 10)}`}
        pageSize={50}
        onRowDoubleClick={(h) => navigate(`/house-opp/${h.id}`)}
        toolbarLeft={
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {HOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {HOUSE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="All R/G" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All R/G</SelectItem>
                {ALLOCATION_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtered.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} unit{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        }
      />
      </div>

      <HouseOppFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editingHouse={editingHouse}
        saving={saving}
      />
      <BarcodeGenerator
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        value={barcodeValue}
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
