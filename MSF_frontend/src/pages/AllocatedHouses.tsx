import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Home,
  KeyRound,
  DoorOpen,
  Hourglass,
  LogOut,
  RefreshCw,
  Eye,
  ArrowRight,
  User,
  Loader2,
  ShieldAlert,
  CalendarClock,
} from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import DataTable, { type ColDef, type RowAction } from "@/components/table/DataTable";
import StatusChip from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  listAllocations,
  terminateAllocation,
  type HouseAllocation,
} from "@/services/houseAllocations";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtScore(value?: number): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(1);
}

function isAdminOrManager() {
  try {
    const raw = localStorage.getItem("auth_user");
    const role = raw ? JSON.parse(raw).role || "" : "";
    return ["admin", "manager", "super_admin", "superadmin"].includes(
      role.toLowerCase(),
    );
  } catch {
    return false;
  }
}

export default function AllocatedHouses() {
  const navigate = useNavigate();
  const canAdmin = isAdminOrManager();

  const [allocations, setAllocations] = useState<HouseAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<HouseAllocation | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<HouseAllocation | null>(null);
  const [reason, setReason] = useState("");
  const [moveToQueue, setMoveToQueue] = useState(true);
  const [terminating, setTerminating] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await listAllocations({ force });
      setAllocations(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load allocations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => allocations.filter((a) => a.status === "Active"),
    [allocations],
  );

  const summary = useMemo(
    () => ({
      total: active.length,
      occupied: active.filter((a) => a.occupancy_status === "Occupied").length,
      pending: active.filter((a) => a.occupancy_status === "Pending").length,
      vacated: active.filter((a) => a.occupancy_status === "Vacated").length,
      auto: active.filter((a) => a.allocation_type === "Auto").length,
      manual: active.filter((a) => a.allocation_type === "Manual").length,
      override: active.filter((a) => a.allocation_type === "Override").length,
      avgConfidence:
        active.length === 0
          ? 0
          : active.reduce((sum, a) => sum + (a.confidence ?? 0), 0) / active.length,
    }),
    [active],
  );

  const columns: ColDef<HouseAllocation>[] = useMemo(
    () => [
      {
        key: "allocation_no",
        header: "Allocation",
        width: "w-28",
        sortable: true,
        pinned: true,
        value: (r) => r.allocation_no,
        cell: (r) => (
          <span className="font-semibold text-foreground">{r.allocation_no}</span>
        ),
      },
      {
        key: "employee_name",
        header: "Employee",
        width: "min-w-[180px]",
        sortable: true,
        value: (r) => r.employee_name,
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{r.employee_name}</span>
          </div>
        ),
      },
      {
        key: "employee_id",
        header: "Emp ID",
        width: "w-24",
        sortable: true,
        value: (r) => r.employee_id,
        cell: (r) => (
          <span className="text-muted-foreground">{r.employee_id}</span>
        ),
      },
      {
        key: "house_id",
        header: "Unit",
        width: "min-w-[120px]",
        sortable: true,
        value: (r) => r.house_id,
        cell: (r) => (
          <span className="font-medium">
            {r.resource || (r.room_label ? `${r.house_id} — Room ${r.room_label}` : r.house_id)}
          </span>
        ),
      },
      {
        key: "allocation_unit_type",
        header: "Unit Type",
        width: "w-24",
        sortable: true,
        value: (r) => r.allocation_unit_type,
        cell: (r) => (
          <Badge
            variant="outline"
            className={
              r.allocation_unit_type === "ROOM_ALLOCATION"
                ? "border-sky-300 text-[10px] text-sky-700 dark:border-sky-500/40 dark:text-sky-400"
                : "border-violet-300 text-[10px] text-violet-700 dark:border-violet-500/40 dark:text-violet-400"
            }
          >
            {r.allocation_unit_type === "ROOM_ALLOCATION" ? "Room" : "Whole house"}
          </Badge>
        ),
      },
      {
        key: "house_type",
        header: "Type",
        width: "w-20",
        sortable: true,
        value: (r) => r.house_type,
        cell: (r) => <Badge variant="outline">{r.house_type}</Badge>,
      },
      {
        key: "house_location",
        header: "Location",
        width: "min-w-[140px]",
        sortable: true,
        value: (r) => r.house_location,
        cell: (r) => <span className="text-muted-foreground">{r.house_location}</span>,
      },
      {
        key: "allocation_type",
        header: "Type",
        width: "w-24",
        sortable: true,
        value: (r) => r.allocation_type,
        badge: (r) => r.allocation_type,
      },
      {
        key: "confidence",
        header: "Confidence",
        width: "w-24",
        align: "right",
        sortable: true,
        value: (r) => r.confidence,
        cell: (r) => `${fmtScore(r.confidence)}%`,
      },
      {
        key: "status",
        header: "Status",
        width: "w-28",
        sortable: true,
        value: (r) => r.status,
        badge: true,
      },
      {
        key: "occupancy_status",
        header: "Occupancy",
        width: "w-28",
        sortable: true,
        value: (r) => r.occupancy_status,
        badge: true,
      },
      {
        key: "allocated_at",
        header: "Allocated",
        width: "w-28",
        sortable: true,
        value: (r) => r.allocated_at,
        cell: (r) => <span className="text-muted-foreground">{fmtDate(r.allocated_at)}</span>,
      },
    ],
    [],
  );

  const rowActions = useCallback(
    (row: HouseAllocation): RowAction<HouseAllocation>[] => [
      {
        label: "View Details",
        icon: Eye,
        onClick: () => setDetail(row),
      },
      {
        label: "Terminate",
        icon: LogOut,
        variant: "destructive",
        hidden: row.status !== "Active" || !canAdmin,
        onClick: () => {
          setReason("");
          setMoveToQueue(true);
          setTerminateTarget(row);
        },
      },
    ],
    [canAdmin],
  );

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setTerminating(true);
    try {
      await terminateAllocation(terminateTarget.id, {
        reason,
        move_to_queue: moveToQueue,
      });
      toast.success(
        `Allocation ${terminateTarget.allocation_no} terminated`,
      );
      setTerminateTarget(null);
      setReason("");
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to terminate allocation");
    } finally {
      setTerminating(false);
    }
  };

  if (loading && allocations.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Housing" }, { label: "Allocated Houses" }]} />
      <PageHeader
        icon={KeyRound}
        title="Allocated Houses"
        amharicTitle="የተመደቡ ቤቶች"
        description="Authoritative register of current house allocations, occupancy, and allocation history."
        actions={
          <>
            <Button variant="outline" onClick={() => load(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses/command-center")}>
              <Home className="mr-2 h-4 w-4" /> Command Center
            </Button>
            <Button variant="outline" onClick={() => navigate("/house-opp/queue")}>
              <Hourglass className="mr-2 h-4 w-4" /> Queue
            </Button>
            <Button onClick={() => navigate("/house-opp")}>
              Houses <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          icon={KeyRound}
          title="Active Allocations"
          value={summary.total}
          countValue={summary.total}
          variant="blue"
        />
        <MetricCard
          icon={DoorOpen}
          title="Occupied"
          value={summary.occupied}
          countValue={summary.occupied}
          variant="emerald"
        />
        <MetricCard
          icon={Hourglass}
          title="Pending Occupancy"
          value={summary.pending}
          countValue={summary.pending}
          variant="amber"
        />
        <MetricCard
          icon={ShieldAlert}
          title="Vacated"
          value={summary.vacated}
          countValue={summary.vacated}
          variant="rose"
        />
        <MetricCard
          icon={CalendarClock}
          title="Avg Confidence"
          value={`${fmtScore(summary.avgConfidence)}%`}
          variant="cyan"
        />
        <MetricCard
          icon={ArrowRight}
          title="By Type"
          value={`${summary.auto}A / ${summary.manual}M / ${summary.override}O`}
          variant="violet"
          caption="Auto / Manual / Override"
        />
      </div>

      {/* ── Allocation register ──────────────────────────────────────── */}
      <DataTable<HouseAllocation>
        tableKey="allocated-houses"
        exportFileName="house-allocations"
        reportTitle="Allocated House Records"
        columns={columns}
        data={allocations}
        rowKey={(r) => r.id}
        loading={loading}
        title="Allocation Register"
        emptyMessage="No allocations found"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Active", value: "Active" },
              { label: "Terminated", value: "Terminated" },
              { label: "Reallocated", value: "Reallocated" },
            ],
          },
          {
            key: "allocation_type",
            label: "Type",
            options: [
              { label: "Auto", value: "Auto" },
              { label: "Manual", value: "Manual" },
              { label: "Override", value: "Override" },
            ],
          },
          {
            key: "occupancy_status",
            label: "Occupancy",
            options: [
              { label: "Pending", value: "Pending" },
              { label: "Occupied", value: "Occupied" },
              { label: "Vacated", value: "Vacated" },
            ],
          },
        ]}
        rowActions={rowActions}
        pageSize={20}
        searchPlaceholder="Search allocation no., employee, emp ID, house…"
      />

      {/* ── Detail dialog ────────────────────────────────────────────── */}
      <Dialog open={Boolean(detail)} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {detail?.allocation_no ?? "Allocation"}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.employee_name} → ${detail.resource || detail.house_id}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Employee" value={detail.employee_name} />
              <Field label="Emp ID" value={detail.employee_id} />
              <Field label="Application" value={detail.application_no} />
              <Field label="Unit" value={detail.resource || detail.house_id} />
              <Field label="House Number" value={detail.house_number} />
              <Field label="Room" value={detail.room_label || (detail.allocation_unit_type === "ROOM_ALLOCATION" ? "—" : "Whole house")} />
              <Field label="Type" value={detail.house_type} />
              <Field label="Location" value={detail.house_location} />
              <Field label="Allocation Type" value={detail.allocation_type} />
              <Field label="Confidence" value={`${fmtScore(detail.confidence)}%`} />
              <Field label="Priority Score" value={fmtScore(detail.priority_score)} />
              <Field label="Status" value={detail.status} />
              <Field label="Occupancy" value={detail.occupancy_status} />
              <Field label="Allocated At" value={fmtDate(detail.allocated_at)} />
              <Field label="Effective Date" value={fmtDate(detail.effective_date)} />
              <Field label="Allocated By" value={detail.allocated_by_name || "—"} />
              <Field label="Terminated At" value={fmtDate(detail.terminated_at)} />
              <Field label="Termination Reason" value={detail.termination_reason || "—"} />
              <div className="col-span-2">
                <Field label="Notes" value={detail.notes || "—"} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {detail?.status === "Active" && canAdmin && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDetail(null);
                  setReason("");
                  setMoveToQueue(true);
                  setTerminateTarget(detail);
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Terminate
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Terminate dialog ─────────────────────────────────────────── */}
      <Dialog
        open={Boolean(terminateTarget)}
        onOpenChange={(o) => { if (!o && !terminating) setTerminateTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Terminate Allocation
            </DialogTitle>
            <DialogDescription>
              {terminateTarget
                ? `This will free ${terminateTarget.resource || terminateTarget.house_id} and move ${terminateTarget.employee_name}'s application back to the queue.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="term-reason" className="text-sm font-medium">
                Termination Reason
              </Label>
              <Textarea
                id="term-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Employee transferred, house damaged, relocation…"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="term-queue"
                checked={moveToQueue}
                onCheckedChange={(v) => setMoveToQueue(Boolean(v))}
              />
              <Label htmlFor="term-queue" className="text-sm text-muted-foreground">
                Return application to the allocation queue
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTerminateTarget(null)}
              disabled={terminating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={terminating}
            >
              {terminating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}
