import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusChip from "@/components/ui/status-chip";
import {
  getApplication,
  updateApplicationStatus,
  autoAllocateHouse,
  deallocateHouse,
  listAllocationLogs,
  recalculateApplicationScore,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type HouseApplication,
  type AllocationLog,
} from "@/services/houseApplication";
import { listHouses, type House } from "@/services/houses";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  Zap,
  XCircle,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-slate-500/10 text-slate-700 border-slate-300",
  Submitted: "bg-blue-500/10 text-blue-700 border-blue-300",
  "Under Review": "bg-amber-500/10 text-amber-700 border-amber-300",
  Verified: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  "Waiting for Allocation": "bg-violet-500/10 text-violet-700 border-violet-300",
  Allocated: "bg-green-500/10 text-green-700 border-green-300",
  Rejected: "bg-rose-500/10 text-rose-700 border-rose-300",
  Returned: "bg-orange-500/10 text-orange-700 border-orange-300",
};

const CATEGORY_BADGE: Record<string, string> = {
  Staff: "bg-violet-500/10 text-violet-700 border-violet-300",
  A: "bg-blue-500/10 text-blue-700 border-blue-300",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  C: "bg-amber-500/10 text-amber-700 border-amber-300",
  D: "bg-orange-500/10 text-orange-700 border-orange-300",
  E: "bg-slate-500/10 text-slate-700 border-slate-300",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-border/50 bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export default function HouseQueueReview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<HouseApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonStatus, setReasonStatus] = useState<ApplicationStatus | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [deallocating, setDeallocating] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [confirmAllocOpen, setConfirmAllocOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [allocationLogs, setAllocationLogs] = useState<AllocationLog[]>([]);
  const [availableHouses, setAvailableHouses] = useState<House[]>([]);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const app = await getApplication(id);
      setDetail(app);
      // Fetch allocation logs for this application
      const logs = await listAllocationLogs();
      setAllocationLogs(logs.filter((l) => l.application === id));
      // Fetch available houses matching eligible category
      if (app.eligible_house_category) {
        const houses = await listHouses();
        setAvailableHouses(
          houses.filter(
            (h) => h.house_type === app.eligible_house_category && h.status === "Active"
          )
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load queue application");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const actionButtons = useMemo(
    () => [
      {
        label: "Mark Under Review",
        status: "Under Review" as ApplicationStatus,
        variant: "outline" as const,
        className: "",
      },
      {
        label: "Verify",
        status: "Verified" as ApplicationStatus,
        variant: "outline" as const,
        className: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
      },
      {
        label: "Wait Allocation",
        status: "Waiting for Allocation" as ApplicationStatus,
        variant: "outline" as const,
        className: "border-violet-300 text-violet-700 hover:bg-violet-50",
      },
    ],
    [],
  );

  const setStatus = async (status: ApplicationStatus, reason?: string) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const updated = await updateApplicationStatus(id, status, reason);
      setDetail(updated);
      toast.success(`Application marked as ${status}`);
      setReasonOpen(false);
      setReasonStatus(null);
      setReasonText("");
    } catch (err: any) {
      toast.error(err?.message || `Failed to update status to ${status}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoAllocate = async (houseId: string) => {
    if (!id) return;
    try {
      setAllocating(true);
      const updated = await autoAllocateHouse(houseId, id);
      setDetail(updated);
      toast.success("House allocated successfully!");
      void fetchDetail();
    } catch (err: any) {
      toast.error(err?.message || "Failed to allocate house");
    } finally {
      setAllocating(false);
    }
  };

  const handleDeallocate = async () => {
    if (!id) return;
    try {
      setDeallocating(true);
      const updated = await deallocateHouse(id, "Manual deallocation from queue review");
      setDetail(updated);
      toast.success("Allocation reversed");
      void fetchDetail();
    } catch (err: any) {
      toast.error(err?.message || "Failed to deallocate");
    } finally {
      setDeallocating(false);
    }
  };

  const handleRecalculate = async () => {
    if (!id) return;
    try {
      setCalculating(true);
      const updated = await recalculateApplicationScore(id);
      setDetail(updated);
      toast.success("Priority score recalculated");
      void fetchDetail();
    } catch (err: any) {
      toast.error(err?.message || "Failed to recalculate score");
    } finally {
      setCalculating(false);
    }
  };

  const openReasonModal = (status: ApplicationStatus) => {
    setReasonStatus(status);
    setReasonText("");
    setReasonOpen(true);
  };

  if (loading) return <PageSkeleton />;

  if (!detail) {
    return (
      <div className="space-y-6 p-6">
        <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }, { label: "Queue Review" }]} />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Application not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-10">
      <Breadcrumbs
        items={[
          { label: "House Opp", to: "/house-opp" },
          { label: "House Queue", to: "/house-opp/queue" },
          { label: detail.application_no || detail.id },
        ]}
      />

      <PageHeader
        title={`Queue Review • ${detail.application_no || detail.id}`}
        description="Review scoring, eligibility, and allocate housing."
      >
        <div className="flex items-center gap-2">
          <StatusChip status={detail.status} />
          {detail.eligible_house_category && (
            <Badge variant="outline" className={CATEGORY_BADGE[detail.eligible_house_category] || ""}>
              Eligible: {detail.eligible_house_category === "E" ? "Barrack" : detail.eligible_house_category === "Staff" ? "Staff" : `Type ${detail.eligible_house_category}`}
            </Badge>
          )}
          <Badge variant="outline" className={STATUS_STYLES[detail.status] || ""}>
            Rank #{detail.queue_position ?? "—"}
          </Badge>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => navigate("/house-opp/queue")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <FileText className="mr-2 h-4 w-4" />
          Print
        </Button>
        {detail.supporting_document ? (
          <Button variant="outline" asChild>
            <a href={detail.supporting_document} target="_blank" rel="noreferrer">
              Open Supporting Document
            </a>
          </Button>
        ) : null}
      </div>

      {/* ── Priority Score & Eligibility ─────────────────────────── */}
      <Card className="overflow-hidden border border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border bg-slate-100 dark:bg-slate-800 px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            <Award className="h-4 w-4 text-primary" />
            Priority Score & Eligibility
          </CardTitle>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={() => void handleRecalculate()}
            disabled={calculating}
          >
            {calculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {calculating ? "Calculating..." : "Calculate Score"}
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {/* ── While calculating ─────── */}
          {calculating ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Algorithm is running…</p>
                <p className="mt-1 text-xs text-muted-foreground">Calculating priority score based on weighted criteria</p>
              </div>
            </div>
          ) : detail.priority_score > 0 || detail.eligible_house_category ? (
            <div className="p-5 flex flex-wrap gap-6 items-start">
              {/* ── Table 1: Priority Info ─────────────── */}
              <div className="inline-block">
                <table className="table-auto border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Field</th>
                      <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { label: "Priority Score",     value: `${(detail.priority_score || 0).toFixed(1)} pts` },
                      { label: "Eligible Category",  value: detail.eligible_house_category
                          ? detail.eligible_house_category === "E" ? "Barrack (E)"
                            : detail.eligible_house_category === "Staff" ? "Staff House"
                            : `Type ${detail.eligible_house_category}`
                          : "—" },
                      { label: "Requested Category", value: detail.requested_house_category || "—" },
                      { label: "Queue Position",     value: detail.queue_position ? `#${detail.queue_position}` : "Not queued" },
                      { label: "Allocated House No.", value: detail.allocated_house_id || detail.allocated_house || "—" },
                      ...(detail.allocated_at ? [{ label: "Allocated At", value: formatDateTime(detail.allocated_at) }] : []),
                      ...((detail.allocated_by_name || detail.allocated_by) ? [{ label: "Allocated By", value: detail.allocated_by_name || detail.allocated_by || "—" }] : []),
                    ] as { label: string; value: string }[]).map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-slate-900/40"}>
                        <td className="border border-border px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.label}</td>
                        <td className="border border-border px-4 py-2 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Table 2: Score Breakdown ─────────────── */}
              <div className="inline-block">
                <table className="table-auto border-collapse text-sm">
                  <thead>
                    {/* Title row spanning all columns */}
                    <tr className="bg-slate-200 dark:bg-slate-700">
                      <th
                        colSpan={5}
                        className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100"
                      >
                        Score Breakdown
                        {(detail.employee_name || detail.employee_id) && (
                          <span className="ml-2 normal-case">
                            — <span className="font-bold">{detail.employee_name}</span>
                            {detail.employee_id && (
                              <span className="font-bold"> ({detail.employee_id})</span>
                            )}
                          </span>
                        )}
                      </th>
                    </tr>
                    {/* Column headers */}
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Criterion</th>
                      <th className="border border-border px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Score</th>
                      <th className="border border-border px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Max</th>
                      <th className="border border-border px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">%</th>
                      <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300" style={{minWidth:"140px"}}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Job Grade",        value: gradeScore(detail),             max: 30, bar: "bg-blue-500" },
                      { label: "Years of Service", value: serviceScore(detail),           max: 25, bar: "bg-violet-500" },
                      { label: "Family Size",      value: familyScore(detail),            max: 20, bar: "bg-emerald-500" },
                      { label: "Disability",       value: detail.has_disability ? 15 : 0, max: 15, bar: "bg-amber-500" },
                      { label: "FIFO",             value: fifoScore(detail),              max: 10, bar: "bg-rose-500" },
                    ].map((s, i) => {
                      const pct = s.max > 0 ? Math.min((s.value / s.max) * 100, 100) : 0;
                      return (
                        <tr key={s.label} className={i % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-slate-900/40"}>
                          <td className="border border-border px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{s.label}</td>
                          <td className="border border-border px-4 py-2 text-center font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">{s.value.toFixed(1)}</td>
                          <td className="border border-border px-4 py-2 text-center font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{s.max}</td>
                          <td className="border border-border px-4 py-2 text-center font-mono text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{pct.toFixed(0)}%</td>
                          <td className="border border-border px-4 py-2">
                            <div className="h-3 overflow-hidden bg-slate-200 dark:bg-slate-700" style={{minWidth:"120px"}}>
                              <div className={`h-full ${s.bar} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <td className="border border-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200 whitespace-nowrap">Total</td>
                      <td className="border border-border px-4 py-2 text-center font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{(detail.priority_score || 0).toFixed(1)}</td>
                      <td className="border border-border px-4 py-2 text-center font-mono text-slate-500 dark:text-slate-400 tabular-nums">100</td>
                      <td className="border border-border px-4 py-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">{Math.min(detail.priority_score || 0, 100).toFixed(0)}%</td>
                      <td className="border border-border px-4 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── Empty state ─── */
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No score calculated yet</p>
              <p className="text-xs text-muted-foreground/70">
                Click <span className="font-semibold text-foreground">Calculate Score</span> to run the priority algorithm
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Auto-Allocate Section ─────────────────────────────────── */}
      {(detail.status === "Waiting for Allocation" || detail.status === "Verified") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Allocate House
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.status === "Allocated" && detail.allocated_house_id ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Allocated to: {detail.allocated_house_id}
                  </p>
                  <p className="text-xs text-emerald-600">
                    At {formatDateTime(detail.allocated_at)} by {detail.allocated_by_name || "System"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  onClick={() => void handleDeallocate()}
                  disabled={deallocating}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deallocating ? "Deallocating..." : "Deallocate"}
                </Button>
              </div>
            ) : availableHouses.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Available <strong>{detail.eligible_house_category}</strong> houses:
                    <Badge variant="outline" className="ml-2 text-xs">
                      {availableHouses.length} available
                    </Badge>
                  </p>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">House ID</th>
                        <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Location</th>
                        <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Capacity</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableHouses.map((house, i) => (
                        <tr key={house.id} className={i % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-slate-900/40"}>
                          <td className="px-4 py-2 font-mono font-semibold">{house.house_id}</td>
                          <td className="px-4 py-2 font-mono">{house.house_number}</td>
                          <td className="px-4 py-2">{house.location || "—"}</td>
                          <td className="px-4 py-2 text-center">{house.capacity || 1}</td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                              onClick={() => { setSelectedHouse(house); setConfirmAllocOpen(true); }}
                              disabled={allocating}
                            >
                              <Home className="h-3.5 w-3.5" />
                              Allocate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    No available {detail.eligible_house_category} houses for allocation.
                  </p>
                  <p className="mt-1 text-xs text-amber-600">
                    All houses of this type are currently allocated or inactive. 
                    You may need to deallocate an existing assignment or add new houses.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Allocation Confirmation Dialog ─────────────────────────── */}
      <Dialog open={confirmAllocOpen} onOpenChange={setConfirmAllocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm House Allocation</DialogTitle>
            <DialogDescription>
              You are about to allocate a house to this applicant. This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          {selectedHouse && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">House</span>
                <span className="font-semibold">{selectedHouse.house_id} ({selectedHouse.house_number})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold">{selectedHouse.location || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className={CATEGORY_BADGE[selectedHouse.house_type] || ""}>
                  {selectedHouse.house_type === "E" ? "Barrack" : selectedHouse.house_type === "Staff" ? "Staff" : `Type ${selectedHouse.house_type}`}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold">{selectedHouse.capacity || 1} resident(s)</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applicant</span>
                  <span className="font-semibold">{detail.employee_name} ({detail.employee_id})</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Priority Score</span>
                  <span className="font-mono font-bold">{(detail.priority_score || 0).toFixed(1)} pts</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmAllocOpen(false); setSelectedHouse(null); }} disabled={allocating}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => { if (selectedHouse) void handleAutoAllocate(selectedHouse.id); setConfirmAllocOpen(false); setSelectedHouse(null); }}
              disabled={allocating}
            >
              {allocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {allocating ? "Allocating..." : "Confirm Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Allocation Logs ───────────────────────────────────────── */}
      {allocationLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              Allocation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allocationLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3 text-sm">
                  <Badge variant="outline" className="text-xs">{log.action}</Badge>
                  {log.house_id && <span className="font-mono text-xs">{log.house_id}</span>}
                  <span className="text-xs text-muted-foreground">{log.notes}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)} by {log.performed_by_name || "System"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Workflow Actions ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Workflow Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {actionButtons.map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                className={action.className}
                disabled={submitting || detail.status === action.status}
                onClick={() => void setStatus(action.status)}
              >
                {action.status === "Verified" ? (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </Button>
            ))}
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              disabled={submitting}
              onClick={() => openReasonModal("Returned")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return
            </Button>
            <Button
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
              disabled={submitting}
              onClick={() => openReasonModal("Rejected")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {APPLICATION_STATUSES.map((s) => (
              <div
                key={s}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  detail.status === s
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {s}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Applicant Information & System Fields ─────────────────── */}
      <Card className="overflow-hidden border border-border">
        <CardHeader className="border-b border-border bg-slate-100 dark:bg-slate-800 px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            <UserRound className="h-4 w-4 text-primary" />
            Applicant Information &amp; System Fields
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">

          {/* ── Both tables side by side ── */}
          <div className="flex flex-wrap gap-6 items-start">

            {/* Table 1 — Applicant Info */}
            <div className="inline-block">
              <table className="table-auto border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-700">
                    <th colSpan={2} className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      Applicant Information
                    </th>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Field</th>
                    <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "Employee ID",       value: detail.employee_id || "—" },
                    { label: "Employee Name",      value: detail.employee_name || "—" },
                    { label: "National ID",        value: detail.national_id || "—" },
                    { label: "Gender",             value: detail.gender || "—" },
                    { label: "Job Position",       value: detail.job_position || "—" },
                    { label: "Job Grade",          value: detail.job_grade || "—" },
                    { label: "Years of Service",   value: String(detail.years_of_service) },
                    { label: "Marital Status",     value: detail.marital_status || "—" },
                    { label: "Has Disability",     value: detail.has_disability ? "Yes" : "No" },
                    { label: "Family Size",        value: String(detail.family_size) },
                    { label: "Number of Children", value: String(detail.number_of_children) },
                    { label: "Preferred Location", value: detail.preferred_location || "—" },
                  ] as { label: string; value: string }[]).map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-slate-900/40"}>
                      <td className="border border-border px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.label}</td>
                      <td className="border border-border px-4 py-2 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table 2 — System Fields */}
            <div className="inline-block">
              <table className="table-auto border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-700">
                    <th colSpan={2} className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      System Fields
                    </th>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Field</th>
                    <th className="border border-border px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 whitespace-nowrap">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "Application ID",     value: detail.id || "—" },
                    { label: "Application Number", value: detail.application_no || "—" },
                    { label: "Requester",          value: detail.requester_name || detail.requester || "—" },
                    { label: "Status",             value: detail.status || "—" },
                    { label: "Is Active",          value: detail.is_active ? "Yes" : "No" },
                    { label: "Created At",         value: formatDateTime(detail.created_at) },
                    { label: "Updated At",         value: formatDateTime(detail.updated_at) },
                    { label: "Submitted At",       value: formatDateTime(detail.submitted_at) },
                    { label: "Reviewed At",        value: formatDateTime(detail.reviewed_at) },
                    { label: "Reviewed By",        value: detail.reviewed_by_name || "—" },
                  ] as { label: string; value: string }[]).map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-slate-900/40"}>
                      <td className="border border-border px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.label}</td>
                      <td className="border border-border px-4 py-2 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* ── Text fields: same flex layout as the tables above ── */}
          <div className="flex flex-wrap gap-6 items-start">

            {/* Reason for Request */}
            <div className="inline-block" style={{ minWidth: "220px" }}>
              <div className="border border-border overflow-hidden">
                <div className="bg-slate-200 dark:bg-slate-700 px-4 py-2 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Reason for Request
                  </p>
                </div>
                <textarea
                  value={detail.reason_for_request || ""}
                  readOnly
                  rows={5}
                  className="w-full resize-none bg-white dark:bg-background px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed outline-none border-0 focus:ring-0"
                />
              </div>
            </div>

            {/* Supporting Document */}
            <div className="inline-block" style={{ minWidth: "220px" }}>
              <div className="border border-border overflow-hidden">
                <div className="bg-slate-200 dark:bg-slate-700 px-4 py-2 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Supporting Document
                  </p>
                </div>
                <div className="bg-white dark:bg-background px-4 py-3 min-h-[120px] flex items-center">
                  {detail.supporting_document ? (
                    <a
                      href={detail.supporting_document}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
                    >
                      📎 Open uploaded file
                    </a>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic">No document uploaded</p>
                  )}
                </div>
              </div>
            </div>

            {/* Returned Reason */}
            <div className="inline-block" style={{ minWidth: "220px" }}>
              <div className="border border-border overflow-hidden">
                <div className="bg-slate-200 dark:bg-slate-700 px-4 py-2 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Returned Reason
                  </p>
                </div>
                <textarea
                  value={detail.returned_reason || ""}
                  readOnly
                  rows={5}
                  className="w-full resize-none bg-white dark:bg-background px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed outline-none border-0 focus:ring-0"
                />
              </div>
            </div>

            {/* Rejection Reason */}
            <div className="inline-block" style={{ minWidth: "220px" }}>
              <div className="border border-border overflow-hidden">
                <div className="bg-slate-200 dark:bg-slate-700 px-4 py-2 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Rejection Reason
                  </p>
                </div>
                <textarea
                  value={detail.rejection_reason || ""}
                  readOnly
                  rows={5}
                  className="w-full resize-none bg-white dark:bg-background px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed outline-none border-0 focus:ring-0"
                />
              </div>
            </div>

          </div>

        </CardContent>
      </Card>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonStatus === "Returned" ? "Return application" : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {reasonStatus === "Returned"
                ? "Provide a reason so the applicant knows what to correct."
                : "Provide a reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              {reasonStatus === "Returned" ? "Return reason" : "Rejection reason"}
            </Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={5}
              placeholder="Enter reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!reasonStatus) return;
                if (!reasonText.trim()) {
                  toast.error("Reason is required");
                  return;
                }
                void setStatus(reasonStatus, reasonText.trim());
              }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Score breakdown helpers (approximate component values) ─────────────
function gradeScore(app: HouseApplication): number {
  try {
    const grade = parseInt(String(app.job_grade).trim()) || 1;
    return Math.min(30, (grade / 20) * 30);
  } catch { return 0; }
}

function serviceScore(app: HouseApplication): number {
  return Math.min(25, (app.years_of_service / 30) * 25);
}

function familyScore(app: HouseApplication): number {
  return Math.min(20, (app.family_size / 10) * 20);
}

function fifoScore(app: HouseApplication): number {
  // Approximate: FIFO score is part of the weighted total
  return app.queue_position ? Math.max(0, 10 - (app.queue_position - 1)) : 5;
}