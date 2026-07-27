import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Home, Users, CalendarClock, BedDouble, Plus, Edit, Trash2, Loader2,
  ShieldCheck, Building2, UserCheck, Clock, Accessibility,
  User, Hash, Briefcase, CalendarDays, StickyNote,
  DoorOpen, MapPin, Filter, X, ChevronRight, Maximize2, Minimize2, MoreVertical,
} from "lucide-react";
import { peekCachedValue } from "@/lib/data-cache";
import { listAllocations as _listAllocations } from "@/services/residentialAllocations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import MetricCard from "@/components/ui/metric-card";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { ResidentialActionsDropdown } from "@/components/residential/ResidentialActionsDropdown";
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import {
  listAllocations, createAllocation, updateAllocation, deleteAllocation,
  type ResidentAllocation, type AllocationFormData, type AllocationCategory,
  type AllocationStatus, type Gender,
} from "@/services/residentialAllocations";

// ── Constants ──────────────────────────────────────────────────────────────

const EMPTY_FORM: AllocationFormData = {
  category: "permanent",
  emp_id: "",
  full_name: "",
  gender: "Male",
  national_id: "",
  job_title: "",
  job_grade: "",
  service_years: 0,
  has_disability: false,
  unit_number: "",
  building: null,
  floor: null,
  room_type: null,
  move_in_date: null,
  move_out_date: null,
  lease_end_date: null,
  status: "Active",
  notes: null,
};

const ROOM_TYPES = ["Single", "Double", "Suite", "Studio", "Family"];
const STATUS_OPTIONS: AllocationStatus[] = ["Active", "Pending", "Vacated", "Suspended"];
const GENDER_OPTIONS: Gender[] = ["Male", "Female", "Other"];

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AllocationStatus }) {
  const cls =
    status === "Active"    ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400 border" :
    status === "Pending"   ? "bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400 border" :
    status === "Vacated"   ? "bg-slate-500/10 text-slate-600 border-slate-400/30 dark:text-slate-400 border" :
                             "bg-rose-500/10 text-rose-700 border-rose-400/30 dark:text-rose-400 border";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

// ── Detail Sheet ──────────────────────────────────────────────────────────

function AllocationDetailSheet({
  record, open, onClose, onEdit,
}: {
  record: ResidentAllocation | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (r: ResidentAllocation) => void;
}) {
  if (!record) return null;

  const initials = record.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const catLabel = record.category === "permanent" ? "Permanent" : record.category === "seasonal" ? "Seasonal" : "Guest";
  const catColor =
    record.category === "permanent" ? "from-blue-500/10 via-blue-500/5" :
    record.category === "seasonal"  ? "from-amber-500/10 via-amber-500/5" :
                                      "from-emerald-500/10 via-emerald-500/5";
  const avatarColor =
    record.category === "permanent" ? "bg-blue-500/15 text-blue-600 ring-blue-400/30" :
    record.category === "seasonal"  ? "bg-amber-500/15 text-amber-600 ring-amber-400/30" :
                                      "bg-emerald-500/15 text-emerald-600 ring-emerald-400/30";

  const Field = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${catColor} to-transparent px-6 pt-8 pb-6 border-b border-border/60`}>
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ring-2 ${avatarColor}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold leading-tight">{record.full_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{record.job_title || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={record.status} />
                <Badge variant="outline" className="text-xs">{catLabel}</Badge>
                {record.has_disability && (
                  <Badge className="bg-violet-500/10 text-violet-700 border-violet-400/30 dark:text-violet-400 text-xs border">Disability</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</p>
            <div className="space-y-3">
              <Field icon={Hash}       label="Employee ID"  value={<span className="font-mono">{record.emp_id}</span>} />
              <Field icon={User}       label="Full Name"    value={record.full_name} />
              <Field icon={record.gender === "Male" ? User : UserCheck} label="Gender" value={record.gender} />
              <Field icon={ShieldCheck} label="National ID" value={<span className="font-mono">{record.national_id}</span>} />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Career</p>
            <div className="space-y-3">
              <Field icon={Briefcase}    label="Job Title"       value={record.job_title} />
              <Field icon={UserCheck}    label="Job Grade"       value={record.job_grade} />
              <Field icon={Clock}        label="Service Years"   value={`${record.service_years} yr${record.service_years !== 1 ? "s" : ""}`} />
              <Field icon={Accessibility} label="Disability"    value={record.has_disability ? "Registered" : "None"} />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Housing</p>
            <div className="space-y-3">
              <Field icon={BedDouble}    label="Unit"            value={record.unit_number} />
              <Field icon={Building2}    label="Building"        value={record.building} />
              <Field icon={MapPin}       label="Floor"           value={record.floor} />
              <Field icon={DoorOpen}     label="Room Type"       value={record.room_type} />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dates</p>
            <div className="space-y-3">
              <Field icon={CalendarDays}   label="Move-In Date"   value={record.move_in_date} />
              {record.move_out_date && <Field icon={CalendarClock} label="Move-Out Date" value={record.move_out_date} />}
              {record.lease_end_date && <Field icon={CalendarClock} label="Lease End"    value={record.lease_end_date} />}
            </div>
          </div>
          {record.notes && (
            <>
              <Separator />
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{record.notes}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {onEdit && (
          <div className="border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button className="w-full gap-2" onClick={() => { onClose(); onEdit(record); }}>
              <Edit className="h-4 w-4" /> Edit Allocation
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Allocation Form Dialog ─────────────────────────────────────────────────

function AllocationFormDialog({
  open, onClose, onSave, editingRecord, category, saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: AllocationFormData) => Promise<void>;
  editingRecord: ResidentAllocation | null;
  category: AllocationCategory;
  saving: boolean;
}) {
  const [form, setForm] = useState<AllocationFormData>({ ...EMPTY_FORM, category });
  const [formExpanded, setFormExpanded] = useState(false);
  const set = (k: keyof AllocationFormData, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm(editingRecord
        ? { ...editingRecord }
        : { ...EMPTY_FORM, category }
      );
    }
  }, [open, editingRecord, category]);

  const catLabel = category === "permanent" ? "Permanent" : category === "seasonal" ? "Seasonal" : "Guest";

  const handleSave = async () => {
    if (!form.emp_id.trim())   { toast.error("Employee ID is required."); return; }
    if (!form.full_name.trim()) { toast.error("Full name is required."); return; }
    if (!form.national_id.trim()) { toast.error("National ID is required."); return; }
    if (!form.unit_number.trim()) { toast.error("Unit number is required."); return; }
    await onSave({ ...form, category });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={cn(
        "p-0 gap-0 overflow-hidden transition-all duration-200",
        formExpanded
          ? "w-full h-full max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg"
          : "sm:max-w-2xl max-h-[90vh]"
      )}>
        <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-14 text-left border-b border-border/60 bg-muted/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Home className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <DialogTitle>{editingRecord ? `Edit ${catLabel} Allocation` : `New ${catLabel} Allocation`}</DialogTitle>
              <DialogDescription>Fill in all required fields for the residential allocation.</DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFormExpanded(!formExpanded)} title={formExpanded ? "Collapse" : "Expand"}>
            {formExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </DialogHeader>

        {/* Employee info */}
          <div className="overflow-y-auto px-6 py-5 max-h-[70vh] space-y-5">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Employee Information
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee ID <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. EMP-001" value={form.emp_id} onChange={e => set("emp_id", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Full Name" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gender</Label>
                  <Select value={form.gender} onValueChange={v => set("gender", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">National ID <span className="text-destructive">*</span></Label>
                  <Input placeholder="National ID" value={form.national_id} onChange={e => set("national_id", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</Label>
                  <Input placeholder="Job Title" value={form.job_title} onChange={e => set("job_title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Grade</Label>
                  <Input placeholder="e.g. G5" value={form.job_grade} onChange={e => set("job_grade", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Service Years</Label>
                  <Input type="number" min={0} value={form.service_years} onChange={e => set("service_years", Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="disability" checked={form.has_disability} onCheckedChange={v => set("has_disability", !!v)} />
                  <Label htmlFor="disability" className="cursor-pointer">Has Disability</Label>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Housing Details
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unit Number <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. A-101" value={form.unit_number} onChange={e => set("unit_number", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Building</Label>
                  <Input placeholder="Building name" value={form.building ?? ""} onChange={e => set("building", e.target.value || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Floor</Label>
                  <Input placeholder="e.g. 3rd Floor" value={form.floor ?? ""} onChange={e => set("floor", e.target.value || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Room Type</Label>
                  <Select value={form.room_type ?? "__none__"} onValueChange={v => set("room_type", v === "__none__" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Dates & Status
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Move-In Date</Label>
                  <Input type="date" value={form.move_in_date ?? ""} onChange={e => set("move_in_date", e.target.value || null)} />
                </div>
                {category !== "permanent" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Move-Out Date</Label>
                    <Input type="date" value={form.move_out_date ?? ""} onChange={e => set("move_out_date", e.target.value || null)} />
                  </div>
                )}
                {(category === "seasonal" || category === "guest") && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lease End Date</Label>
                    <Input type="date" value={form.lease_end_date ?? ""} onChange={e => set("lease_end_date", e.target.value || null)} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                  <Select value={form.status} onValueChange={v => set("status", v as AllocationStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <StickyNote className="h-4 w-4 text-primary" />
                Notes
              </div>
              <Textarea rows={3} placeholder="Optional notes…" value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)} />
            </div>
          </div>

          <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRecord ? "Save Changes" : "Create Allocation"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Section panel (one per tab) ───────────────────────────────────────────

export function AllocationSection({ category }: { category: AllocationCategory }) {
  const [records, setRecords] = useState<ResidentAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ResidentAllocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResidentAllocation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ResidentAllocation | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");

  const [role] = useState<string>(() => {
    try { const r = localStorage.getItem("auth_user"); return r ? (JSON.parse(r).role ?? "").toLowerCase() : ""; } catch { return ""; }
  });
  const isAdmin = role === "admin" || role === "manager";

  // Load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setRecords(await listAllocations(category, { force: true })); }
      catch (e: any) { toast.error(e.message || "Failed to load records"); }
      finally { setLoading(false); }
    })();
  }, [category]);

  // Filtered
  const filtered = useMemo(() =>
    records.filter(r => statusFilter === "all" || r.status === statusFilter),
  [records, statusFilter]);

  // Metrics
  const metrics = useMemo(() => ({
    total:     records.length,
    active:    records.filter(r => r.status === "Active").length,
    pending:   records.filter(r => r.status === "Pending").length,
    vacated:   records.filter(r => r.status === "Vacated").length,
    suspended: records.filter(r => r.status === "Suspended").length,
    disability:records.filter(r => r.has_disability).length,
  }), [records]);

  const catLabel = category === "permanent" ? "Permanent" : category === "seasonal" ? "Seasonal" : "Guest";

  // Handlers
  const openAdd  = () => { setEditingRecord(null); setDialogOpen(true); };
  const openEdit = (r: ResidentAllocation) => { setEditingRecord(r); setDialogOpen(true); };

  const handleSave = async (data: AllocationFormData) => {
    setSaving(true);
    try {
      if (editingRecord) {
        const updated = await updateAllocation(editingRecord.id, data);
        setRecords(prev => prev.map(r => r.id === editingRecord.id ? updated : r));
        toast.success("Allocation updated");
        await logActivity("residential_updated", `${data.full_name} allocation updated (${catLabel})`);
        await trackActivity("allocation", "update", { entityName: data.full_name, entityId: editingRecord.id });
      } else {
        const created = await createAllocation(data);
        setRecords(prev => [created, ...prev]);
        toast.success("Allocation created");
        await logActivity("residential_created", `${data.full_name} allocated to ${data.unit_number} (${catLabel})`);
        await trackActivity("allocation", "create", { entityName: data.full_name, entityId: created.id });
      }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAllocation(deleteTarget.id, category);
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast.success(`${deleteTarget.full_name} removed`);
      await logActivity("residential_deleted", `${deleteTarget.full_name} removed from ${catLabel}`);
      await trackActivity("allocation", "delete", { entityName: deleteTarget.full_name, entityId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (e: any) { toast.error(e.message || "Failed to delete"); }
    finally { setDeleting(false); }
  };

  // Columns
  const columns = useMemo((): ColDef<ResidentAllocation>[] => [
    {
      key: "emp_id", header: "Emp ID", sortable: true, width: "w-28", pinned: true,
      value: r => r.emp_id,
      cell: r => <span className="font-mono text-xs text-muted-foreground tracking-wide">{r.emp_id || "—"}</span>,
    },
    {
      key: "full_name", header: "Name", sortable: true, width: "min-w-[180px]",
      value: r => r.full_name,
      cell: r => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {r.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{r.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{r.national_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "gender", header: "Gender", width: "w-20",
      value: r => r.gender,
      cell: r => <span className="text-xs">{r.gender}</span>,
    },
    {
      key: "national_id", header: "National ID", width: "w-32", defaultHidden: true,
      value: r => r.national_id,
      cell: r => <span className="font-mono text-xs">{r.national_id}</span>,
    },
    {
      key: "job_title", header: "Job", sortable: true,
      value: r => r.job_title,
      cell: r => <span className="text-sm">{r.job_title || "—"}</span>,
    },
    {
      key: "job_grade", header: "Grade", width: "w-20",
      value: r => r.job_grade,
      cell: r => r.job_grade
        ? <Badge variant="outline" className="text-xs font-mono">{r.job_grade}</Badge>
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "service_years", header: "Svc Yrs", width: "w-20", align: "center",
      value: r => r.service_years,
      cell: r => <span className="tabular-nums text-xs font-medium">{r.service_years}</span>,
    },
    {
      key: "has_disability", header: "Disability", width: "w-24", align: "center",
      value: r => r.has_disability ? "Yes" : "No",
      cell: r => r.has_disability
        ? <Badge className="bg-violet-500/10 text-violet-700 border-violet-400/30 dark:text-violet-400 text-xs border">Yes</Badge>
        : <span className="text-muted-foreground/40 text-xs">No</span>,
    },
    {
      key: "unit_number", header: "Unit", sortable: true, width: "w-24",
      value: r => r.unit_number,
      cell: r => <span className="font-mono text-xs font-semibold">{r.unit_number}</span>,
    },
    {
      key: "building", header: "Building", width: "w-28", defaultHidden: category === "guest",
      value: r => r.building,
      cell: r => <span className="text-xs">{r.building || "—"}</span>,
    },
    {
      key: "floor", header: "Floor", width: "w-20", defaultHidden: true,
      value: r => r.floor,
      cell: r => <span className="text-xs">{r.floor || "—"}</span>,
    },
    {
      key: "room_type", header: "Room Type", width: "w-24",
      value: r => r.room_type,
      cell: r => r.room_type
        ? <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-xs font-medium">{r.room_type}</span>
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "move_in_date", header: "Move In", sortable: true, width: "w-28",
      value: r => r.move_in_date,
      cell: r => <span className="tabular-nums text-xs">{r.move_in_date ?? "—"}</span>,
    },
    ...(category !== "permanent" ? [{
      key: "move_out_date", header: "Move Out", sortable: true, width: "w-28",
      value: (r: ResidentAllocation) => r.move_out_date,
      cell: (r: ResidentAllocation) => <span className="tabular-nums text-xs">{r.move_out_date ?? "—"}</span>,
    }] : []),
    ...(category !== "permanent" ? [{
      key: "lease_end_date", header: "Lease End", sortable: true, width: "w-28",
      value: (r: ResidentAllocation) => r.lease_end_date,
      cell: (r: ResidentAllocation) => r.lease_end_date
        ? <span className="tabular-nums text-xs text-amber-600 dark:text-amber-400 font-medium">{r.lease_end_date}</span>
        : <span className="text-muted-foreground/50 text-xs">—</span>,
    }] : []),
    {
      key: "status", header: "Status", sortable: true, width: "w-28",
      value: r => r.status,
      cell: r => <StatusBadge status={r.status as AllocationStatus} />,
    },
    ...(isAdmin ? [{
      key: "actions", header: "", width: "w-20", pinned: true, align: "right" as const,
      cell: (r: ResidentAllocation) => (
        <ResidentialActionsDropdown
          onEdit={() => openEdit(r)}
          onDelete={() => setDeleteTarget(r)}
          canEdit={isAdmin}
          canDelete={isAdmin}
        />
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin, category]);

  const metricVariants = {
    permanent: { active: "emerald" as const, pending: "amber" as const, vacated: "default" as const, total: "blue" as const },
    seasonal:  { active: "emerald" as const, pending: "amber" as const, vacated: "default" as const, total: "orange" as const },
    guest:     { active: "emerald" as const, pending: "amber" as const, vacated: "default" as const, total: "cyan" as const },
  };
  const mv = metricVariants[category];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Home}         title="Total"      value={metrics.total}     variant={mv.total}
          onClick={() => setStatusFilter("all")} caption="All allocations" />
        <MetricCard icon={UserCheck}    title="Active"     value={metrics.active}    variant={mv.active}
          onClick={() => setStatusFilter("Active")} caption="Currently housed" />
        <MetricCard icon={Clock}        title="Pending"    value={metrics.pending}   variant={mv.pending}
          onClick={() => setStatusFilter("Pending")} caption="Awaiting move-in" />
        <MetricCard icon={DoorOpen}     title="Vacated"    value={metrics.vacated}   variant="default"
          onClick={() => setStatusFilter("Vacated")} caption="Moved out" />
        <MetricCard icon={ShieldCheck}  title="Suspended"  value={metrics.suspended} variant="rose"
          onClick={() => setStatusFilter("Suspended")} caption="On hold" />
        <MetricCard icon={Accessibility} title="Disability" value={metrics.disability} variant="violet"
          caption="Registered" />
      </div>

      {/* Active filter chip */}
      {statusFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtering by:</span>
          <Badge variant="secondary" className="gap-1.5 pr-1">
            {statusFilter}
            <button onClick={() => setStatusFilter("all")} className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Table */}
      <DataTable<ResidentAllocation>
        tableKey={`residential-${category}`}
        columns={columns}
        data={filtered}
        rowKey={r => r.id}
        loading={loading}
        searchable
        searchPlaceholder={`Search ${catLabel.toLowerCase()} residents…`}
        emptyMessage={`No ${catLabel.toLowerCase()} allocations found`}
        exportFileName={`residential-${category}-${new Date().toISOString().slice(0, 10)}`}
        pageSize={50}
        onRowDoubleClick={r => { setDetailRecord(r); }}
        toolbarLeft={
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        toolbarRight={
          isAdmin ? (
            <Button size="sm" className="h-8 gap-1.5" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add {catLabel}
            </Button>
          ) : undefined
        }
      />

      {/* Form dialog */}
      <AllocationFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editingRecord={editingRecord}
        category={category}
        saving={saving}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Allocation</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.full_name}</strong> from {catLabel.toLowerCase()} housing (Unit {deleteTarget?.unit_number})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail sheet */}
      <AllocationDetailSheet
        record={detailRecord}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        onEdit={isAdmin ? r => { setDetailRecord(null); openEdit(r); } : undefined}
      />
    </div>
  );
}

// ── Hub navigation cards ───────────────────────────────────────────────────

function HubCards() {
  const navigate = useNavigate();

  const cards = [
    {
      href: "/residential-hub/permanent",
      label: "Permanent House",
      description: "Long-term allocations for permanent staff members.",
      icon: BedDouble,
      gradient: "from-blue-500 to-indigo-600",
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      href: "/residential-hub/seasonal",
      label: "Seasonal House",
      description: "Temporary allocations for seasonal or contract workers.",
      icon: CalendarClock,
      gradient: "from-amber-500 to-orange-600",
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
    },
    {
      href: "/residential-hub/guest",
      label: "Guest House",
      description: "Short-stay accommodation for visiting staff or guests.",
      icon: Users,
      gradient: "from-emerald-500 to-teal-600",
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ href, label, description, icon: Icon, gradient, bg, text }) => (
        <button
          key={href}
          onClick={() => navigate(href)}
          className="group flex flex-col items-start gap-4 rounded-xl border border-border/60 bg-card p-5 text-left shadow-sm transition-all hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
            <Icon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="font-semibold leading-tight">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <span className={`flex items-center gap-1 text-xs font-medium ${text}`}>
            Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main hub landing page ──────────────────────────────────────────────────

export default function ResidentialHub() {
  return (
    <div className="space-y-8 p-6">
      <Breadcrumbs items={[{ label: "Residential Hub", to: "/residential-hub" }]} />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <Home className="h-6 w-6" />
          </span>
          Residential Hub
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Select a section below to manage housing units or staff allocations.
        </p>
      </div>

      {/* 4 horizontal navigation cards */}
      <HubCards />
    </div>
  );
}
