import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import StatusChip from "@/components/ui/status-chip";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/lib/enterprise-feedback";
import { normalizeRole } from "@/services/permissions";
import { listHouses, type House } from "@/services/houses";
import { listEmployees, type Employee } from "@/services/employees";
import {
  listInspections,
  scheduleInspection,
  completeInspection,
  deleteInspection,
  listMaintenance,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  deleteMaintenanceRequest,
  listTransfers,
  requestTransfer,
  decideTransfer,
  completeTransfer,
  listContracts,
  createContract,
  terminateContract,
  listInvoices,
  generateMonthlyInvoices,
  listPayments,
  recordPayment,
  getRentalSummary,
  invalidateHouseOperationsCache,
  type HouseInspection,
  type MaintenanceRequest,
  type HouseTransfer,
  type RentalContract,
  type RentalInvoice,
  type RentalPayment,
  type RentalSummary,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/services/houseOperations";
import { invalidateHousingAnalyticsCache } from "@/services/houseAnalytics";
import {
  Wrench,
  Plus,
  ClipboardCheck,
  Hammer,
  ArrowLeftRight,
  Banknote,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  Receipt,
  Landmark,
  CalendarClock,
  Home,
  User,
  Sparkles,
} from "lucide-react";

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const MAINTENANCE_STATUSES: MaintenanceStatus[] = ["Pending", "In Progress", "Completed", "Cancelled"];
const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Salary Deduction", "Check"];

function isAdminOrManager() {
  try {
    const raw = localStorage.getItem("auth_user");
    const role = raw ? JSON.parse(raw).role || "" : "";
    return ["admin", "manager", "super_admin", "superadmin"].includes(normalizeRole(role));
  } catch {
    return false;
  }
}

function fmtMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(Number(v));
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v.slice(0, 10) : d.toLocaleDateString();
}

export default function HouseOperations() {
  const canAdmin = isAdminOrManager();
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Housing" }, { label: "Operations" }]} />
      <PageHeader
        icon={Wrench}
        title="House Operations"
        description="Inspections, maintenance, transfers, and rental billing for the estate."
        actions={
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <Tabs defaultValue="inspections">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inspections">
            <ClipboardCheck className="mr-2 h-4 w-4" /> Inspections
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Hammer className="mr-2 h-4 w-4" /> Maintenance
          </TabsTrigger>
          <TabsTrigger value="transfers">
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfers
          </TabsTrigger>
          <TabsTrigger value="rentals">
            <Banknote className="mr-2 h-4 w-4" /> Rentals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inspections" className="mt-4">
          <InspectionsTab canAdmin={canAdmin} />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenanceTab canAdmin={canAdmin} />
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <TransfersTab canAdmin={canAdmin} />
        </TabsContent>
        <TabsContent value="rentals" className="mt-4">
          <RentalsTab canAdmin={canAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Inspections ─────────────────────────────────────────────────────────────

function InspectionsTab({ canAdmin }: { canAdmin: boolean }) {
  const [rows, setRows] = useState<HouseInspection[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<HouseInspection | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    house: "",
    inspection_type: "Routine",
    scheduled_date: "",
    findings: "",
  });
  const [completeForm, setCompleteForm] = useState({
    findings: "",
    damage_costs: "",
    door: false,
    windows: false,
    walls: false,
    switch: false,
    bulb: false,
    water: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, h] = await Promise.all([listInspections(), listHouses()]);
      setRows(i);
      setHouses(h);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load inspections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () =>
    setForm({ house: "", inspection_type: "Routine", scheduled_date: "", findings: "" });

  const handleCreate = async () => {
    if (!form.house || !form.scheduled_date) {
      toast.error("House and scheduled date are required");
      return;
    }
    setBusy(true);
    try {
      await scheduleInspection(form);
      toast.success("Inspection scheduled");
      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to schedule inspection");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    setBusy(true);
    try {
      await completeInspection(completeTarget.id, {
        findings: completeForm.findings,
        damage_costs: completeForm.damage_costs,
        checklist_results: {
          door: completeForm.door,
          windows: completeForm.windows,
          walls: completeForm.walls,
          switch: completeForm.switch,
          bulb: completeForm.bulb,
          water: completeForm.water,
        },
      });
      toast.success("Inspection completed — house condition synced");
      setCompleteTarget(null);
      invalidateHousingAnalyticsCache();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to complete inspection");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColDef<HouseInspection>[] = [
    { key: "house_hid", header: "House", width: "w-28", sortable: true, pinned: true, value: (r) => r.house_hid },
    { key: "house_type", header: "Type", width: "w-20", value: (r) => r.house_type, cell: (r) => <Badge variant="outline">{r.house_type}</Badge> },
    { key: "house_location", header: "Location", width: "min-w-[140px]", value: (r) => r.house_location },
    { key: "inspection_type", header: "Kind", width: "w-24", value: (r) => r.inspection_type, cell: (r) => <span className="text-sm capitalize">{r.inspection_type}</span> },
    { key: "status", header: "Status", width: "w-28", value: (r) => r.status, badge: true },
    { key: "scheduled_date", header: "Scheduled", width: "w-28", sortable: true, value: (r) => fmtDate(r.scheduled_date) },
    { key: "completed_date", header: "Completed", width: "w-28", value: (r) => fmtDate(r.completed_date) },
    { key: "inspector_name", header: "Inspector", width: "min-w-[120px]", value: (r) => r.inspector_name },
    {
      key: "findings",
      header: "Findings",
      width: "min-w-[180px]",
      value: (r) => r.findings,
      cell: (r) => <span className="line-clamp-2 text-sm text-muted-foreground">{r.findings || "—"}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">House Inspections</CardTitle>
          <CardDescription>Schedule and complete unit condition inspections</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Schedule Inspection
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          tableKey="houses:inspections"
          columns={cols}
          data={rows}
          rowKey={(r) => r.id}
          loading={loading}
          searchable
          searchPlaceholder="Search house or location…"
          pageSize={12}
          emptyMessage="No inspections scheduled."
          rowActions={(r) => [
            {
              label: "Mark Completed",
              icon: CheckCircle2,
              hidden: !canAdmin || r.status === "Completed",
              onClick: () => {
                setCompleteForm({ findings: r.findings ?? "", damage_costs: "", door: false, windows: false, walls: false, switch: false, bulb: false, water: false });
                setCompleteTarget(r);
              },
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onClick: async () => {
                try {
                  await deleteInspection(r.id);
                  toast.success("Inspection deleted");
                  await load();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete inspection");
                }
              },
            },
          ]}
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Inspection</DialogTitle>
            <DialogDescription>Create an inspection record for a house.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>House</Label>
              <Select value={form.house} onValueChange={(v) => setForm({ ...form, house: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select house" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.house_id} · {h.location} · {h.house_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.inspection_type} onValueChange={(v) => setForm({ ...form, inspection_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Routine", "Move-in", "Move-out", "Damage", "Periodic"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scheduled date</Label>
                <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Findings (optional)</Label>
              <Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} placeholder="Pre-inspection notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>{busy ? "Scheduling…" : "Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeTarget} onOpenChange={(v) => !v && setCompleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Inspection — {completeTarget?.house_hid}</DialogTitle>
            <DialogDescription>Record findings and sync damage flags to the house.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea value={completeForm.findings} onChange={(e) => setCompleteForm({ ...completeForm, findings: e.target.value })} placeholder="Condition notes…" />
            </div>
            <div className="space-y-2">
              <Label>Damage costs (ETB, optional)</Label>
              <Input type="number" min={0} value={completeForm.damage_costs} onChange={(e) => setCompleteForm({ ...completeForm, damage_costs: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="mb-2 block">Damaged fixtures</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["door", "Door"],
                  ["windows", "Windows"],
                  ["walls", "Walls"],
                  ["switch", "Switch"],
                  ["bulb", "Bulb"],
                  ["water", "Water"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={completeForm[key]}
                      onCheckedChange={(v) => setCompleteForm({ ...completeForm, [key]: !!v })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>Cancel</Button>
            <Button onClick={handleComplete} disabled={busy}>{busy ? "Saving…" : "Complete Inspection"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

function MaintenanceTab({ canAdmin }: { canAdmin: boolean }) {
  const [rows, setRows] = useState<MaintenanceRequest[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MaintenanceRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    house: "",
    title: "",
    description: "",
    priority: "Medium" as MaintenancePriority,
  });
  const [statusForm, setStatusForm] = useState({
    status: "In Progress" as MaintenanceStatus,
    cost: "",
    assigned_to: "",
    resolution_note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, h] = await Promise.all([listMaintenance(), listHouses()]);
      setRows(m);
      setHouses(h);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => setForm({ house: "", title: "", description: "", priority: "Medium" });

  const handleCreate = async () => {
    if (!form.house || !form.title.trim()) {
      toast.error("House and title are required");
      return;
    }
    setBusy(true);
    try {
      await createMaintenanceRequest(form);
      toast.success("Maintenance request created");
      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create maintenance request");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async () => {
    if (!statusTarget) return;
    setBusy(true);
    try {
      await updateMaintenanceStatus(statusTarget.id, statusForm);
      toast.success(`Status → ${statusForm.status}`);
      setStatusTarget(null);
      invalidateHousingAnalyticsCache();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColDef<MaintenanceRequest>[] = [
    { key: "house_hid", header: "House", width: "w-28", sortable: true, pinned: true, value: (r) => r.house_hid },
    { key: "title", header: "Title", width: "min-w-[160px]", sortable: true, value: (r) => r.title },
    {
      key: "description",
      header: "Description",
      width: "min-w-[200px]",
      value: (r) => r.description,
      cell: (r) => <span className="line-clamp-2 text-sm text-muted-foreground">{r.description || "—"}</span>,
    },
    { key: "priority", header: "Priority", width: "w-24", value: (r) => r.priority, badge: true },
    { key: "status", header: "Status", width: "w-28", value: (r) => r.status, badge: true },
    { key: "cost", header: "Cost", width: "w-24", align: "right", value: (r) => r.cost, cell: (r) => fmtMoney(r.cost) },
    { key: "assigned_to", header: "Assigned", width: "min-w-[120px]", value: (r) => r.assigned_to || "—" },
    { key: "created_at", header: "Reported", width: "w-28", sortable: true, value: (r) => fmtDate(r.created_at) },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Maintenance Requests</CardTitle>
          <CardDescription>Track repair work across the estate</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Request
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          tableKey="houses:maintenance"
          columns={cols}
          data={rows}
          rowKey={(r) => r.id}
          loading={loading}
          searchable
          searchPlaceholder="Search house, title, assignee…"
          pageSize={12}
          emptyMessage="No maintenance requests."
          rowActions={(r) => [
            {
              label: "Update Status",
              icon: Hammer,
              hidden: !canAdmin || r.status === "Completed" || r.status === "Cancelled",
              onClick: () => {
                setStatusForm({ status: r.status === "Pending" ? "In Progress" : "Completed", cost: r.cost, assigned_to: r.assigned_to, resolution_note: "" });
                setStatusTarget(r);
              },
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onClick: async () => {
                try {
                  await deleteMaintenanceRequest(r.id);
                  toast.success("Request deleted");
                  await load();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete request");
                }
              },
            },
          ]}
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Maintenance Request</DialogTitle>
            <DialogDescription>Log a repair request for a house.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>House</Label>
              <Select value={form.house} onValueChange={(v) => setForm({ ...form, house: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select house" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.house_id} · {h.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leaking roof" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs fixing…" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as MaintenancePriority })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Low", "Medium", "High", "Urgent"] as const).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusTarget} onOpenChange={(v) => !v && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status — {statusTarget?.house_hid}</DialogTitle>
            <DialogDescription>{statusTarget?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm({ ...statusForm, status: v as MaintenanceStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cost (ETB)</Label>
                <Input type="number" min={0} value={statusForm.cost} onChange={(e) => setStatusForm({ ...statusForm, cost: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Assigned to</Label>
                <Input value={statusForm.assigned_to} onChange={(e) => setStatusForm({ ...statusForm, assigned_to: e.target.value })} placeholder="Technician name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Resolution note</Label>
              <Textarea value={statusForm.resolution_note} onChange={(e) => setStatusForm({ ...statusForm, resolution_note: e.target.value })} placeholder="What was done…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={handleStatus} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Transfers ───────────────────────────────────────────────────────────────

function TransfersTab({ canAdmin }: { canAdmin: boolean }) {
  const [rows, setRows] = useState<HouseTransfer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const [form, setForm] = useState({ employee: "", target_house: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, h] = await Promise.all([listTransfers(), listEmployees(), listHouses()]);
      setRows(t);
      setEmployees(e);
      setHouses(h);
    } catch (e2: any) {
      toast.error(e2?.message || "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => setForm({ employee: "", target_house: "", reason: "" });

  const handleCreate = async () => {
    if (!form.employee || !form.target_house) {
      toast.error("Employee and target house are required");
      return;
    }
    setBusy(true);
    try {
      await requestTransfer(form);
      toast.success("Transfer requested");
      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to request transfer");
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (row: HouseTransfer, decision: "Approved" | "Rejected") => {
    const ok = await confirm({
      title: `${decision} transfer`,
      description: `${row.employee_name} → ${row.target_house_hid}`,
      confirmLabel: decision === "Approved" ? "Approve" : "Reject",
      variant: decision === "Approved" ? "success" : "danger",
      onConfirm: async () => {
        try {
          await decideTransfer(row.id, decision);
          toast.success(`Transfer ${decision.toLowerCase()}`);
          invalidateHousingAnalyticsCache();
          await load();
        } catch (e: any) {
          toast.error(e?.message || `Failed to ${decision.toLowerCase()} transfer`);
          throw e;
        }
      },
    });
    void ok;
  };

  const handleComplete = async (row: HouseTransfer) => {
    const ok = await confirm({
      title: "Complete transfer",
      description: `Finalize the move of ${row.employee_name} into ${row.target_house_hid}?`,
      confirmLabel: "Complete",
      variant: "success",
      onConfirm: async () => {
        try {
          await completeTransfer(row.id);
          toast.success("Transfer completed — allocation updated");
          invalidateHousingAnalyticsCache();
          await load();
        } catch (e: any) {
          toast.error(e?.message || "Failed to complete transfer");
          throw e;
        }
      },
    });
    void ok;
  };

  const cols: ColDef<HouseTransfer>[] = [
    { key: "employee_name", header: "Employee", width: "min-w-[160px]", sortable: true, pinned: true, value: (r) => r.employee_name, cell: (r) => (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground">{r.employee_id}</div>
        </div>
      </div>
    )},
    { key: "current_house_hid", header: "From", width: "w-28", value: (r) => r.current_house_hid ?? "—" },
    { key: "target_house_hid", header: "To", width: "w-28", value: (r) => r.target_house_hid },
    { key: "reason", header: "Reason", width: "min-w-[180px]", value: (r) => r.reason, cell: (r) => <span className="line-clamp-2 text-sm text-muted-foreground">{r.reason || "—"}</span> },
    { key: "status", header: "Status", width: "w-28", value: (r) => r.status, badge: true },
    { key: "created_at", header: "Requested", width: "w-28", sortable: true, value: (r) => fmtDate(r.created_at) },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">House Transfers</CardTitle>
          <CardDescription>Move employees between houses with full allocation traceability</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Request Transfer
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          tableKey="houses:transfers"
          columns={cols}
          data={rows}
          rowKey={(r) => r.id}
          loading={loading}
          searchable
          searchPlaceholder="Search employee or house…"
          pageSize={12}
          emptyMessage="No transfers."
          rowActions={(r) => [
            {
              label: "Approve",
              icon: CheckCircle2,
              hidden: !canAdmin || r.status !== "Pending",
              onClick: () => handleDecision(r, "Approved"),
            },
            {
              label: "Reject",
              icon: XCircle,
              hidden: !canAdmin || r.status !== "Pending",
              variant: "destructive",
              onClick: () => handleDecision(r, "Rejected"),
            },
            {
              label: "Mark Complete",
              icon: Sparkles,
              hidden: !canAdmin || r.status !== "Approved",
              onClick: () => handleComplete(r),
            },
          ]}
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Transfer</DialogTitle>
            <DialogDescription>The current house is resolved automatically from the employee's active allocation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.employee_id}>
                      {e.full_name} · {e.employee_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target house</Label>
              <Select value={form.target_house} onValueChange={(v) => setForm({ ...form, target_house: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target house" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.house_id} · {h.location} · {h.house_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why is the transfer needed…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>{busy ? "Requesting…" : "Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Rentals ─────────────────────────────────────────────────────────────────

function RentalsTab({ canAdmin }: { canAdmin: boolean }) {
  const [view, setView] = useState<"contracts" | "invoices" | "payments">("contracts");
  const [summary, setSummary] = useState<RentalSummary | null>(null);
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [invoices, setInvoices] = useState<RentalInvoice[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractOpen, setContractOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<RentalInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const [contractForm, setContractForm] = useState({
    tenant: "",
    house: "",
    start_date: "",
    end_date: "",
    monthly_rent: "",
    security_deposit: "",
    terms_conditions: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({ billing_month: "", due_date: "" });
  const [paymentForm, setPaymentForm] = useState({ amount_paid: "", payment_method: "Bank Transfer", reference_no: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, i, p, e, h] = await Promise.all([
        getRentalSummary({ force: true }),
        listContracts(),
        listInvoices(),
        listPayments(),
        listEmployees(),
        listHouses(),
      ]);
      setSummary(s);
      setContracts(c);
      setInvoices(i);
      setPayments(p);
      setEmployees(e);
      setHouses(h);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load rentals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateContract = async () => {
    if (!contractForm.tenant || !contractForm.house || !contractForm.start_date || !contractForm.end_date || !contractForm.monthly_rent) {
      toast.error("Tenant, house, dates and monthly rent are required");
      return;
    }
    setBusy(true);
    try {
      await createContract(contractForm);
      toast.success("Contract created");
      setContractOpen(false);
      setContractForm({ tenant: "", house: "", start_date: "", end_date: "", monthly_rent: "", security_deposit: "", terms_conditions: "" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create contract");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateInvoices = async () => {
    if (!invoiceForm.billing_month || !invoiceForm.due_date) {
      toast.error("Billing month and due date are required");
      return;
    }
    setBusy(true);
    try {
      const created = await generateMonthlyInvoices(invoiceForm.billing_month, invoiceForm.due_date);
      toast.success(`${created.length} invoice(s) generated`);
      setInvoiceOpen(false);
      setInvoiceForm({ billing_month: "", due_date: "" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate invoices");
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentTarget || !paymentForm.amount_paid) {
      toast.error("Amount is required");
      return;
    }
    setBusy(true);
    try {
      await recordPayment({ invoice: paymentTarget.id, ...paymentForm });
      toast.success("Payment recorded");
      setPaymentTarget(null);
      setPaymentForm({ amount_paid: "", payment_method: "Bank Transfer", reference_no: "", notes: "" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  const handleTerminate = async (row: RentalContract) => {
    const ok = await confirm({
      title: "Terminate contract",
      description: `${row.contract_no} — ${row.tenant_name} on ${row.house_hid}?`,
      confirmLabel: "Terminate",
      variant: "danger",
      onConfirm: async () => {
        try {
          await terminateContract(row.id);
          toast.success("Contract terminated");
          await load();
        } catch (e: any) {
          toast.error(e?.message || "Failed to terminate contract");
          throw e;
        }
      },
    });
    void ok;
  };

  const contractCols: ColDef<RentalContract>[] = [
    { key: "contract_no", header: "Contract", width: "w-32", sortable: true, pinned: true, value: (r) => r.contract_no },
    { key: "tenant_name", header: "Tenant", width: "min-w-[160px]", sortable: true, value: (r) => r.tenant_name },
    { key: "house_hid", header: "House", width: "w-28", value: (r) => r.house_hid },
    { key: "monthly_rent", header: "Monthly", width: "w-28", align: "right", sortable: true, value: (r) => r.monthly_rent, cell: (r) => fmtMoney(r.monthly_rent) },
    { key: "start_date", header: "Start", width: "w-28", value: (r) => fmtDate(r.start_date) },
    { key: "end_date", header: "End", width: "w-28", value: (r) => fmtDate(r.end_date) },
    { key: "status", header: "Status", width: "w-28", value: (r) => r.status, badge: true },
  ];

  const invoiceCols: ColDef<RentalInvoice>[] = [
    { key: "invoice_no", header: "Invoice", width: "w-32", sortable: true, pinned: true, value: (r) => r.invoice_no },
    { key: "tenant_name", header: "Tenant", width: "min-w-[140px]", value: (r) => r.tenant_name },
    { key: "contract_no", header: "Contract", width: "w-32", value: (r) => r.contract_no },
    { key: "billing_month", header: "Month", width: "w-28", value: (r) => r.billing_month },
    { key: "due_date", header: "Due", width: "w-28", sortable: true, value: (r) => fmtDate(r.due_date) },
    { key: "rent_amount", header: "Rent", width: "w-24", align: "right", value: (r) => r.rent_amount, cell: (r) => fmtMoney(r.rent_amount) },
    { key: "paid_amount", header: "Paid", width: "w-24", align: "right", value: (r) => r.paid_amount, cell: (r) => fmtMoney(r.paid_amount) },
    { key: "balance", header: "Balance", width: "w-24", align: "right", value: (r) => r.balance, cell: (r) => <span className="font-medium tabular-nums">{fmtMoney(r.balance)}</span> },
    { key: "status", header: "Status", width: "w-28", value: (r) => r.status, badge: true },
  ];

  const paymentCols: ColDef<RentalPayment>[] = [
    { key: "receipt_no", header: "Receipt", width: "w-32", sortable: true, pinned: true, value: (r) => r.receipt_no },
    { key: "invoice_no", header: "Invoice", width: "w-32", value: (r) => r.invoice_no },
    { key: "tenant_name", header: "Tenant", width: "min-w-[140px]", value: (r) => r.tenant_name },
    { key: "amount_paid", header: "Amount", width: "w-28", align: "right", sortable: true, value: (r) => r.amount_paid, cell: (r) => <span className="font-medium tabular-nums">{fmtMoney(r.amount_paid)}</span> },
    { key: "payment_method", header: "Method", width: "w-36", value: (r) => r.payment_method },
    { key: "reference_no", header: "Reference", width: "min-w-[120px]", value: (r) => r.reference_no || "—" },
    { key: "recorded_by_name", header: "Recorded by", width: "min-w-[120px]", value: (r) => r.recorded_by_name },
    { key: "created_at", header: "Date", width: "w-28", sortable: true, value: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={FileText} title="Active Contracts" value={summary?.active_contracts ?? 0} countValue={summary?.active_contracts ?? 0} variant="blue" />
        <MetricCard icon={Banknote} title="Monthly Revenue" value={fmtMoney(summary?.monthly_rent_revenue)} variant="emerald" />
        <MetricCard icon={Receipt} title="Total Collected" value={fmtMoney(summary?.total_collected)} variant="cyan" />
        <MetricCard icon={Landmark} title="Outstanding" value={fmtMoney(summary?.outstanding_balance)} variant="amber" />
        <MetricCard icon={CalendarClock} title="Overdue Invoices" value={summary?.overdue_invoices ?? 0} countValue={summary?.overdue_invoices ?? 0} variant="rose" />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Rent Roll</CardTitle>
            <CardDescription>Contracts, billing and payment collection</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {([
              ["contracts", "Contracts"],
              ["invoices", "Invoices"],
              ["payments", "Payments"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => setView(key)}
                className={view === key ? "bg-accent" : ""}
              >
                {label}
              </Button>
            ))}
            {view === "contracts" && (
              <Button size="sm" onClick={() => setContractOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New Contract
              </Button>
            )}
            {view === "invoices" && canAdmin && (
              <Button size="sm" onClick={() => setInvoiceOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Generate Invoices
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === "contracts" && (
            <DataTable
              tableKey="houses:contracts"
              columns={contractCols}
              data={contracts}
              rowKey={(r) => r.id}
              loading={loading}
              searchable
              searchPlaceholder="Search contract, tenant, house…"
              pageSize={12}
              emptyMessage="No contracts yet."
              rowActions={(r) => [
                {
                  label: "Terminate",
                  icon: XCircle,
                  variant: "destructive",
                  hidden: !canAdmin || r.status === "Terminated",
                  onClick: () => handleTerminate(r),
                },
              ]}
            />
          )}
          {view === "invoices" && (
            <DataTable
              tableKey="houses:invoices"
              columns={invoiceCols}
              data={invoices}
              rowKey={(r) => r.id}
              loading={loading}
              searchable
              searchPlaceholder="Search invoice, tenant…"
              pageSize={12}
              emptyMessage="No invoices yet — generate monthly invoices."
              rowActions={(r) => [
                {
                  label: "Record Payment",
                  icon: Banknote,
                  hidden: !canAdmin || r.status === "Paid" || r.status === "Cancelled",
                  onClick: () => {
                    setPaymentForm({ amount_paid: r.balance || "", payment_method: "Bank Transfer", reference_no: "", notes: "" });
                    setPaymentTarget(r);
                  },
                },
              ]}
            />
          )}
          {view === "payments" && (
            <DataTable
              tableKey="houses:payments"
              columns={paymentCols}
              data={payments}
              rowKey={(r) => r.id}
              loading={loading}
              searchable
              searchPlaceholder="Search receipt, invoice…"
              pageSize={12}
              emptyMessage="No payments recorded."
            />
          )}
        </CardContent>
      </Card>

      {/* Contract dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Rental Contract</DialogTitle>
            <DialogDescription>Create a tenancy for an employee on a house.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={contractForm.tenant} onValueChange={(v) => setContractForm({ ...contractForm, tenant: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.employee_id}>
                      {e.full_name} · {e.employee_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>House</Label>
              <Select value={contractForm.house} onValueChange={(v) => setContractForm({ ...contractForm, house: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select house" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.house_id} · {h.location} · {h.house_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="date" value={contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly rent (ETB)</Label>
                <Input type="number" min={0} value={contractForm.monthly_rent} onChange={(e) => setContractForm({ ...contractForm, monthly_rent: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Security deposit</Label>
                <Input type="number" min={0} value={contractForm.security_deposit} onChange={(e) => setContractForm({ ...contractForm, security_deposit: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Terms (optional)</Label>
              <Textarea value={contractForm.terms_conditions} onChange={(e) => setContractForm({ ...contractForm, terms_conditions: e.target.value })} placeholder="Terms and conditions…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateContract} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate invoices dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Invoices</DialogTitle>
            <DialogDescription>Batch-generate invoices for all active contracts.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Billing month</Label>
              <Input type="month" value={invoiceForm.billing_month} onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_month: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateInvoices} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!paymentTarget} onOpenChange={(v) => !v && setPaymentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {paymentTarget?.invoice_no}</DialogTitle>
            <DialogDescription>
              {paymentTarget ? `${paymentTarget.tenant_name} · balance ${fmtMoney(paymentTarget.balance)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount paid (ETB)</Label>
              <Input type="number" min={0} value={paymentForm.amount_paid} onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference no.</Label>
              <Input value={paymentForm.reference_no} onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} placeholder="Bank ref / receipt" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={busy}>{busy ? "Recording…" : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
