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
  FileText,
  AlertTriangle,
  CheckCircle2,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  listAllocations,
  type HouseAllocation,
} from "@/services/houseAllocations";
import {
  getOrCreateHandoverReceipt,
  type HandoverReceipt,
} from "@/services/houseHandoverReceipt";
import HandoverReceiptModal from "@/components/houses/HandoverReceiptModal";
import ClearanceSlipModal from "@/components/houses/ClearanceSlipModal";
import {
  terminateWithCode,
  listTerminations,
  type TerminationTransaction,
} from "@/services/houseApplication";
import {
  validatePreInspection,
} from "@/services/houseOperations";
import type { PostInspection } from "@/services/houseOperations";

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
  const [terminations, setTerminations] = useState<TerminationTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<HouseAllocation | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<HouseAllocation | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<HouseAllocation | null>(null);
  const [receipt, setReceipt] = useState<HandoverReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [slipTarget, setSlipTarget] = useState<TerminationTransaction | null>(null);

  // ── termination authorization code ────────────────────────────────────
  const [termAuthCode, setTermAuthCode] = useState("");
  const [termReason, setTermReason] = useState("");
  const [termError, setTermError] = useState("");

  // ── pre-inspection validation ────────────────────────────────────────
  const [preInspectionResult, setPreInspectionResult] = useState<{
    valid: boolean;
    post_inspection: PostInspection | null;
    message: string;
    details: {
      post_inspection_found: boolean;
      post_inspection_status: string;
      house_number_match: boolean;
      allocation_status_match: boolean;
      house_status_match: boolean;
    };
  } | null>(null);
  const [preInspectionLoading, setPreInspectionLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [data, terms] = await Promise.all([
        listAllocations({ force }),
        listTerminations(),
      ]);
      setAllocations(data);
      setTerminations(terms);
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

  const handleOpenReceipt = useCallback(async (alloc: HouseAllocation) => {
    setReceiptTarget(alloc);
    setReceiptLoading(true);
    try {
      const r = await getOrCreateHandoverReceipt(alloc.id);
      setReceipt(r);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate handover receipt");
      setReceiptTarget(null);
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  const rowActions = useCallback(
    (row: HouseAllocation): RowAction<HouseAllocation>[] => [
      {
        label: "View Details",
        icon: Eye,
        onClick: () => setDetail(row),
      },
      {
        label: "Print Handover Receipt",
        icon: FileText,
        hidden: row.status !== "Active",
        onClick: () => handleOpenReceipt(row),
      },
      {
        label: "Clearance Slip",
        icon: FileText,
        hidden: row.status !== "Terminated",
        onClick: async () => {
          let match = terminations.find(t => t.allocation === row.id || t.allocation_no === row.allocation_no);
          if (!match) {
            try {
              const freshTerms = await listTerminations();
              setTerminations(freshTerms);
              match = freshTerms.find(t => t.allocation === row.id || t.allocation_no === row.allocation_no);
            } catch {}
          }
          if (match) {
            setSlipTarget(match);
          } else {
            toast.error("No completed termination transaction found for this allocation");
          }
        },
      },
      {
        label: "Terminate",
        icon: LogOut,
        variant: "destructive",
        hidden: row.status !== "Active" || !canAdmin,
        onClick: () => {
          setTermAuthCode("");
          setTermReason("");
          setTermError("");
          setPreInspectionResult(null);
          setTerminateTarget(row);
          // Trigger pre-inspection validation
          setPreInspectionLoading(true);
          validatePreInspection(row.id)
            .then((result) => setPreInspectionResult(result))
            .catch((err: any) => {
              setPreInspectionResult({
                valid: false,
                post_inspection: null,
                message: err?.message || "Failed to validate pre-inspection",
                details: {
                  post_inspection_found: false,
                  post_inspection_status: "",
                  house_number_match: false,
                  allocation_status_match: false,
                  house_status_match: false,
                },
              });
            })
            .finally(() => setPreInspectionLoading(false));
        },
      },
    ],
    [canAdmin, handleOpenReceipt],
  );

  const handleTerminate = async () => {
    if (!terminateTarget) return;

    if (!termAuthCode.trim()) {
      toast.error("Authorization code is required");
      return;
    }

    setTerminating(true);
    setTermError("");
    try {
      const result = await terminateWithCode(
        terminateTarget.id,
        termAuthCode.trim(),
        termReason,
      );
      if (result.error) {
        setTermError(result.error);
        toast.error(result.error);
      } else {
        toast.success(`Allocation ${terminateTarget.allocation_no} terminated successfully`);
        setTerminateTarget(null);
        setTermAuthCode("");
        setTermReason("");
        setTermError("");
        await load(true);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to terminate allocation";
      setTermError(msg);
      toast.error(msg);
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
            {detail?.status === "Active" && (
              <Button
                variant="outline"
                onClick={() => {
                  setDetail(null);
                  handleOpenReceipt(detail);
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> Print Handover Receipt
              </Button>
            )}
            {detail?.status === "Terminated" && (
              <Button
                variant="outline"
                className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                onClick={async () => {
                  let match = terminations.find(t => t.allocation === detail.id || t.allocation_no === detail.allocation_no);
                  if (!match) {
                    try {
                      const freshTerms = await listTerminations();
                      setTerminations(freshTerms);
                      match = freshTerms.find(t => t.allocation === detail.id || t.allocation_no === detail.allocation_no);
                    } catch {}
                  }
                  if (match) {
                    setSlipTarget(match);
                  } else {
                    toast.error("No completed termination transaction found for this allocation");
                  }
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> Clearance Slip
              </Button>
            )}
            {detail?.status === "Active" && canAdmin && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDetail(null);
                  setTermAuthCode("");
                  setTermReason("");
                  setTermError("");
                  setPreInspectionResult(null);
                  setTerminateTarget(detail);
                  setPreInspectionLoading(true);
                  validatePreInspection(detail.id)
                    .then((result) => setPreInspectionResult(result))
                    .catch((err: any) => {
                      setPreInspectionResult({
                        valid: false,
                        post_inspection: null,
                        message: err?.message || "Failed to validate pre-inspection",
                        details: {
                          post_inspection_found: false,
                          post_inspection_status: "",
                          house_number_match: false,
                          allocation_status_match: false,
                          house_status_match: false,
                        },
                      });
                    })
                    .finally(() => setPreInspectionLoading(false));
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
        onOpenChange={(o) => { if (!o && !terminating) { setTerminateTarget(null); setTermAuthCode(""); setTermError(""); setPreInspectionResult(null); } }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Terminate Allocation
            </DialogTitle>
            <DialogDescription>
              {terminateTarget
                ? `Terminate allocation ${terminateTarget.allocation_no}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Allocation info */}
            {terminateTarget && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Employee</span>
                  <span className="font-medium">{terminateTarget.employee_name} ({terminateTarget.employee_id})</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">House</span>
                  <span className="font-medium">{terminateTarget.house_number || terminateTarget.house_id} {terminateTarget.room_label ? `— Room ${terminateTarget.room_label}` : ""}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{terminateTarget.house_type}</span>
                </div>
              </div>
            )}

            {/* Pre-inspection validation status */}
            {preInspectionLoading && (
              <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/30 p-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Validating pre-inspection status…</span>
              </div>
            )}
            {!preInspectionLoading && preInspectionResult && (
              <div className={`flex items-start gap-2 rounded-md border p-3 ${
                preInspectionResult.valid
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
              }`}>
                {preInspectionResult.valid ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
                )}
                <div className={`text-[11px] ${
                  preInspectionResult.valid
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}>
                  <p className="font-semibold">
                    {preInspectionResult.valid ? "Pre-Inspection Validated" : "Pre-Inspection Required"}
                  </p>
                  <p className="mt-0.5">{preInspectionResult.message}</p>
                  {preInspectionResult.post_inspection && (
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                      <span>Post-Inspection Status:</span>
                      <span className="font-medium">{preInspectionResult.details.post_inspection_status}</span>
                      <span>House Number Match:</span>
                      <span className="font-medium">{preInspectionResult.details.house_number_match ? "Yes" : "No"}</span>
                      <span>Condition:</span>
                      <span className="font-medium">{preInspectionResult.post_inspection.overall_condition || "N/A"}</span>
                      {preInspectionResult.post_inspection.damage_costs !== "0.00" && (
                        <>
                          <span>Damage Costs:</span>
                          <span className="font-medium">{preInspectionResult.post_inspection.damage_costs} ETB</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-[11px] text-blue-700 dark:text-blue-300">
                <p className="font-semibold">Authorization Required</p>
                <p className="mt-0.5">
                  To terminate this allocation, you must enter the authorization code
                  that was generated and approved from the{" "}
                  <span className="font-semibold">Termination Management</span> page.
                </p>
                <p className="mt-0.5">
                  The code is linked to this specific employee, allocation, and house.
                  It will be consumed upon use and cannot be reused.
                </p>
              </div>
            </div>

            {/* Authorization Code */}
            <div className="space-y-2">
              <Label htmlFor="term-auth-code" className="text-sm font-medium">
                Termination Authorization Code *
              </Label>
              <Input
                id="term-auth-code"
                value={termAuthCode}
                onChange={(e) => { setTermAuthCode(e.target.value); setTermError(""); }}
                placeholder="Paste the authorization code here..."
                className="text-xs font-mono"
                autoFocus
              />
            </div>

            {/* Optional reason */}
            <div className="space-y-2">
              <Label htmlFor="term-reason" className="text-sm font-medium">
                Termination Reason
              </Label>
              <Textarea
                id="term-reason"
                value={termReason}
                onChange={(e) => setTermReason(e.target.value)}
                placeholder="Optional additional reason for this termination..."
                rows={2}
              />
            </div>

            {/* Error display */}
            {termError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
                <p className="text-[11px] text-red-700 dark:text-red-300">{termError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setTerminateTarget(null); setTermAuthCode(""); setTermError(""); setPreInspectionResult(null); }}
              disabled={terminating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={terminating || !termAuthCode.trim() || preInspectionLoading || (preInspectionResult !== null && !preInspectionResult.valid)}
            >
              {terminating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Code & Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Handover Receipt modal ─────────────────────────────────── */}
      {receiptTarget && (
        receiptLoading ? (
          <Dialog open onOpenChange={() => { if (!receiptLoading) { setReceiptTarget(null); setReceipt(null); } }}>
            <DialogContent className="sm:max-w-md" hideCloseButton>
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating receipt…</p>
              </div>
            </DialogContent>
          </Dialog>
        ) : receipt ? (
          <HandoverReceiptModal
            open
            onOpenChange={(o) => { if (!o) { setReceiptTarget(null); setReceipt(null); } }}
            receipt={receipt}
            onReceiptUpdated={setReceipt}
          />
        ) : null
      )}

      {/* ── Clearance Slip modal ────────────────────────────────────── */}
      {slipTarget && (
        <ClearanceSlipModal
          open
          onOpenChange={(o) => { if (!o) setSlipTarget(null); }}
          slip={slipTarget}
        />
      )}
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
