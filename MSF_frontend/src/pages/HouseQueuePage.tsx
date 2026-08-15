import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import StatusChip from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import {
  getRankedQueue, listAllocationLogs, updateApplicationStatus,
  batchAllocateAll, determineAllocationMode, allocationModeLabel,
  type BatchAllocateResult,
  type HouseApplication, type ApplicationStatus,
  type ScoreBreakdown, type CriterionContribution,
} from "@/services/houseApplication";
import {
  ArrowLeft, ArrowRight, Award, BarChart3, CheckCircle2, Clock3,
  FileText, Home, Inbox, Loader2, Paperclip, RefreshCw, Search, Send,
  ShieldCheck, Sparkles, Target, TrendingUp, Trophy, UserRound, Users,
  Zap, Eye, XCircle, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

type QueueRow = HouseApplication & {
  queuePosition: number;
  queueTimestamp: string | null;
};

const CATEGORY_BADGE: Record<string, string> = {
  Staff: "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.15)]",
  A: "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  B: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
  D: "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
  E: "bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/40 shadow-[0_0_10px_rgba(100,116,139,0.15)]",
};

const STATUS_TABS = [
  { value: "all", label: "All Active", icon: Inbox },
  { value: "Submitted", label: "Submitted", icon: Send },
  { value: "Under Review", label: "Under Review", icon: Clock3 },
  { value: "Verified", label: "Verified", icon: ShieldCheck },
  { value: "Waiting for Allocation", label: "Waiting", icon: Target },
];



function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-bold px-2 py-0.5", CATEGORY_BADGE[category] || "")}>
      {category === "E" ? "Barrack" : category === "Staff" ? "Staff" : `Type ${category}`}
    </Badge>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const color = clamped >= 70 ? "#10b981" : clamped >= 40 ? "#f59e0b" : "#64748b";
  const label = clamped >= 70 ? "High" : clamped >= 40 ? "Med" : "Low";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-16 overflow-hidden rounded-full bg-white/10 shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 shadow-[0_0_5px_currentColor]"
          style={{ width: `${clamped}%`, backgroundColor: color, color: color }}
        />
      </div>
      <span className="text-xs font-black tabular-nums" style={{ color, textShadow: `0 0 10px ${color}80` }}>{score.toFixed(1)}</span>
      <span className="text-[9px] font-bold uppercase text-slate-500">{label}</span>
    </div>
  );
}

function ApplicantAvatar({ name, id }: { name: string; id?: string }) {
  const initials = (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = [
    "bg-blue-500/20 text-blue-300 border-blue-500/40",
    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    "bg-violet-500/20 text-violet-300 border-violet-500/40",
    "bg-amber-500/20 text-amber-300 border-amber-500/40",
    "bg-rose-500/20 text-rose-300 border-rose-500/40",
    "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  ];
  const colorIdx = (id?.length ?? 0) % colors.length;
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black shadow-sm", colors[colorIdx])}>
      {initials}
    </div>
  );
}

// ─── Score breakdown dialog ───────────────────────────────────────────────
const CRITERION_LABELS: Record<string, string> = {
  job_grade: "Job Grade",
  years_of_service: "Years of Service",
  family_size: "Family Size",
  disability: "Disability",
  fifo: "Waiting Time (FIFO)",
  marital_status: "Marital Status",
  employment_type: "Employment Type",
  medical_priority: "Medical Priority",
};

function formatRawValue(raw: unknown): string {
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (raw === null || raw === undefined || raw === "") return "—";
  return String(raw);
}

function BreakdownDialog({ app, onClose }: { app: HouseApplication | null; onClose: () => void }) {
  const bd = app?.score_breakdown;

  const rows = useMemo(() => {
    if (!bd) return [];
    return (Object.keys(CRITERION_LABELS) as (keyof typeof CRITERION_LABELS)[])
      .map((key) => {
        const c = bd[key] as CriterionContribution | undefined;
        if (!c || typeof c !== "object" || c.normalised === undefined) return null;
        return {
          key,
          label: CRITERION_LABELS[key],
          raw: formatRawValue(c.raw),
          weight: Number(c.weight) || 0,
          normalised: Number(c.normalised) || 0,
          contribution: Number(c.contribution) || 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [bd]);

  const reasons = bd?.recommendation_reasons ?? [];
  const topsis = bd?.topsis_closeness ?? null;

  return (
    <Dialog open={app !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl text-slate-800 dark:text-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-900 dark:text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              <BarChart3 className="h-5 w-5" />
            </div>
            Score Breakdown
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 font-semibold text-sm pt-1">
            {app?.employee_name} · {app?.employee_id} · {app?.application_no}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[440px] space-y-4 overflow-y-auto pr-2 custom-scrollbar mt-2">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Priority Score</p>
              <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                {Number(app?.priority_score || 0).toFixed(2)}
              </p>
            </div>
            {topsis != null && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">TOPSIS Confidence</p>
                <p className="text-xl font-black text-emerald-500">{Math.round(topsis * 100)}%</p>
              </div>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="space-y-3">
              {rows.map((r) => {
                const pct = Math.min(100, Math.max(0, r.normalised * 100));
                const color = r.contribution >= 0 ? "#10b981" : "#f43f5e";
                return (
                  <div key={r.key} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="truncate text-xs font-bold text-slate-900 dark:text-white">{r.label}</span>
                      <span className="shrink-0 text-xs font-black tabular-nums text-slate-900 dark:text-white">
                        +{r.contribution.toFixed(2)}
                        <span className="text-slate-500 font-medium"> / {r.weight}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[10px] text-slate-500 font-bold tabular-nums">
                        {Math.round(r.normalised * 100)}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Raw: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{r.raw}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">
              No score breakdown computed yet. Open the application and run <strong>Recalculate</strong>.
            </p>
          )}

          {reasons.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Engine Recommendation
              </p>
              <ul className="space-y-1">
                {reasons.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-100/80">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HouseQueuePage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<HouseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<HouseApplication | null>(null);
  const [breakdownApp, setBreakdownApp] = useState<HouseApplication | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<{ allocated: BatchAllocateResult[]; skipped: BatchAllocateResult[] } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const cat = categoryFilter || undefined;
      const data = await getRankedQueue(cat);
      setApplications(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load house queue");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const handleQuickStatus = async (id: string, status: ApplicationStatus) => {
    try {
      setActionLoading(id);
      const updated = await updateApplicationStatus(id, status);
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success(`Marked as ${status}`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to update to ${status}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchAllocate = async () => {
    try {
      setBatchLoading(true);
      const result = await batchAllocateAll();
      setBatchResult(result);
      toast.success(`Allocated ${result.allocated.length}, ${result.skipped.length} skipped`);
      void fetchQueue();
    } catch (err: any) {
      toast.error(err?.message || "Batch allocation failed");
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const filtered = useMemo<QueueRow[]>(() => {
    let list = applications
      .map((app, index) => ({
        ...app,
        queuePosition: app.queue_position ?? index + 1,
        queueTimestamp: app.submitted_at || app.created_at,
      }));

    if (statusTab !== "all") {
      list = list.filter((app) => app.status === statusTab);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (app) =>
          (app.employee_name || "").toLowerCase().includes(q) ||
          (app.employee_id || "").toLowerCase().includes(q) ||
          (app.application_no || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [applications, statusTab, searchTerm]);

  const metrics = useMemo(() => {
    const inProgress = applications.filter(
      (a) => a.status === "Submitted" || a.status === "Under Review"
    ).length;
    const waiting = applications.filter(
      (a) => a.status === "Waiting for Allocation" || a.status === "Verified"
    ).length;
    const allocated = applications.filter((a) => a.status === "Allocated").length;
    const withDocs = applications.filter((a) => Boolean(a.supporting_document)).length;
    const disabilityFlagged = applications.filter((a) => a.has_disability).length;
    const avgScore = applications.length
      ? (applications.reduce((s, a) => s + (a.priority_score || 0), 0) / applications.length).toFixed(1)
      : "0.0";
    const highPriority = applications.filter((a) => (a.priority_score || 0) >= 70).length;
    const total = applications.length;

    return { inProgress, waiting, allocated, withDocs, disabilityFlagged, avgScore, total, highPriority };
  }, [applications]);

  const queueColumns = useMemo(
    (): ColDef<QueueRow>[] => [
      {
        key: "queuePosition",
        header: "Rank",
        width: "w-16",
        pinned: true,
        align: "center",
        sortable: true,
        value: (app) => app.queuePosition,
        cell: (app) => {
          const isTop3 = app.queuePosition <= 3;
          return (
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold border shadow-sm",
                isTop3
                  ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  : "bg-slate-200 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10",
              )}
            >
              {isTop3
                ? ["\u{1F947}", "\u{1F948}", "\u{1F949}"][app.queuePosition - 1]
                : app.queuePosition
              }
            </span>
          );
        },
      },
      {
        key: "priority_score",
        header: "Score",
        width: "w-40",
        sortable: true,
        align: "left",
        value: (app) => app.priority_score || 0,
        cell: (app) => <ScoreIndicator score={app.priority_score || 0} />,
      },
      {
        key: "employee_name",
        header: "Applicant",
        width: "min-w-[200px]",
        sortable: true,
        value: (app) => app.employee_name,
        cell: (app) => (
          <div className="flex items-center gap-2.5 min-w-0 py-1">
            <ApplicantAvatar name={app.employee_name} id={app.employee_id} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{app.employee_name}</p>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {app.employee_id} {app.job_position ? `\u00B7 ${app.job_position}` : ""}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "supporting_document",
        header: "Doc",
        width: "w-12",
        align: "center",
        value: (app) => (app.supporting_document ? "Yes" : "No"),
        cell: (app) =>
          app.supporting_document ? (
            <button
              onClick={(e) => { e.stopPropagation(); setDocPreview(app); }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/30 transition-colors shadow-sm"
              title="View document"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-xs text-slate-600">\u2014</span>
          ),
      },
      {
        key: "eligible_house_category",
        header: "Eligible",
        width: "w-24",
        sortable: true,
        value: (app) => app.eligible_house_category || "",
        cell: (app) =>
          app.eligible_house_category ? (
            <CategoryBadge category={app.eligible_house_category} />
          ) : (
            <Badge variant="outline" className="text-xs border-slate-200 dark:border-white/10 text-slate-600">\u2014</Badge>
          ),
      },
      {
        key: "requested_house_category",
        header: "Requested",
        width: "w-24",
        sortable: true,
        value: (app) => app.requested_house_category,
        cell: (app) => app.requested_house_category ? <CategoryBadge category={app.requested_house_category} /> : <Badge variant="outline" className="text-xs border-slate-200 dark:border-white/10 text-slate-600">\u2014</Badge>,
      },
      {
        key: "allocated_house",
        header: "Allocated To",
        width: "min-w-[140px]",
        sortable: true,
        value: (app) => app.allocated_house || "",
        cell: (app) => app.allocated_house ? (
          <div className="flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate text-xs font-bold text-emerald-600 dark:text-emerald-300">
              {app.allocated_resource
                ?? `${app.allocated_house}${app.allocated_room_label ? ` — Room ${app.allocated_room_label}` : ""}`}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400">\u2014</span>
        ),
      },
      {
        key: "allocation_mode",
        header: "Unit",
        width: "w-28",
        sortable: true,
        value: (app) => app.allocation_mode || determineAllocationMode(app),
        cell: (app) => {
          const mode = app.allocation_mode || determineAllocationMode(app);
          return mode ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                mode === "ROOM_ALLOCATION"
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
              )}
            >
              {mode === "ROOM_ALLOCATION" ? "Room" : "House"}
            </Badge>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-400">\u2014</span>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        width: "w-32",
        sortable: true,
        value: (app) => app.status,
        cell: (app) => <StatusChip status={app.status} size="sm" />,
      },
      {
        key: "queueTimestamp",
        header: "Submitted",
        width: "min-w-[100px]",
        sortable: true,
        value: (app) => app.queueTimestamp,
        cell: (app) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            {app.queueTimestamp ? new Date(app.queueTimestamp).toLocaleDateString() : "\u2014"}
          </div>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "w-64",
        align: "right",
        pinned: true,
        cell: (app) => {
          const isLoading = actionLoading === app.id;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-bold text-violet-400 hover:bg-violet-500/20 border-violet-500/30 border shadow-sm"
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  setBreakdownApp(app);
                }}
              >
                <BarChart3 className="h-3 w-3" />
                Score
              </Button>
              {app.status === "Submitted" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500/20 border-blue-500/30 border shadow-sm"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleQuickStatus(app.id, "Under Review");
                  }}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                  Review
                </Button>
              )}
              {app.status === "Under Review" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 border shadow-sm"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleQuickStatus(app.id, "Verified");
                  }}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Verify
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-bold text-slate-900 dark:text-white hover:bg-white/20 border-slate-300 dark:border-white/20 border bg-white/60 dark:bg-white/5 shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/house-opp/queue/${app.id}`);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                Open
              </Button>
            </div>
          );
        },
      },
    ],
    [navigate, actionLoading],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: applications.length };
    STATUS_TABS.slice(1).forEach((t) => {
      counts[t.value] = applications.filter((a) => a.status === t.value).length;
    });
    return counts;
  }, [applications]);

  // ── Expandable row content ─────────────────────────────────────────────────
  const renderExpandedContent = useCallback((app: QueueRow) => (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        {/* Applicant Info */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Applicant Details</h4>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <p><span className="font-medium text-slate-500">Name:</span> {app.employee_name}</p>
            <p><span className="font-medium text-slate-500">Employee ID:</span> {app.employee_id}</p>
            <p><span className="font-medium text-slate-500">National ID:</span> {app.national_id}</p>
            <p><span className="font-medium text-slate-500">Gender:</span> {app.gender}</p>
          </div>
        </div>
        
        {/* Employment Info */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Employment</h4>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <p><span className="font-medium text-slate-500">Position:</span> {app.job_position}</p>
            <p><span className="font-medium text-slate-500">Grade:</span> {app.job_grade}</p>
            <p><span className="font-medium text-slate-500">Years of Service:</span> {app.years_of_service}</p>
            <p><span className="font-medium text-slate-500">Marital Status:</span> {app.marital_status}</p>
          </div>
        </div>
        
        {/* Request Info */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Request Details</h4>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <p><span className="font-medium text-slate-500">Application No:</span> {app.application_no}</p>
            <p><span className="font-medium text-slate-500">Requested Category:</span> {app.requested_house_category}</p>
            <p><span className="font-medium text-slate-500">Eligible Category:</span> {app.eligible_house_category || "N/A"}</p>
            <p><span className="font-medium text-slate-500">Preferred Location:</span> {app.preferred_location}</p>
          </div>
        </div>
        
        {/* Family & Reason */}
        <div className="space-y-2 md:col-span-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Family & Reason</h4>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <p><span className="font-medium text-slate-500">Family Size:</span> {app.family_size}</p>
            <p><span className="font-medium text-slate-500">Number of Children:</span> {app.number_of_children}</p>
            <p><span className="font-medium text-slate-500">Has Disability:</span> {app.has_disability ? "Yes" : "No"}</p>
            <p><span className="font-medium text-slate-500">Reason for Request:</span> {app.reason_for_request}</p>
          </div>
        </div>
        
        {/* Allocation & Status */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Allocation</h4>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <p><span className="font-medium text-slate-500">Status:</span> <StatusChip status={app.status} size="sm" /></p>
            <p><span className="font-medium text-slate-500">Priority Score:</span> {app.priority_score?.toFixed(2) || "N/A"}</p>
            <p><span className="font-medium text-slate-500">Queue Position:</span> #{app.queuePosition}</p>
            {app.allocated_house && (
              <p><span className="font-medium text-slate-500">Allocated Unit:</span> {app.allocated_resource ?? `${app.allocated_house}${app.allocated_room_label ? ` — Room ${app.allocated_room_label}` : ""}`}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  ), []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e17] text-slate-800 dark:text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* ─── AMBIENT GLASSMORPHIC ORBS ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1800px] space-y-6 p-4 md:p-6 pb-20">
        
        {/* ═══════════════════ COMMAND CENTER HEADER ═══════════════════ */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-2xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-violet-500/10 opacity-50" />
          <div className="relative p-6 md:p-8 flex flex-col xl:flex-row gap-8 items-center xl:items-start justify-between">
            {/* Branding & Breadcrumbs */}
             <div className="flex items-center gap-6 w-full xl:w-auto">
              <div className="flex h-20 w-20 md:h-24 md:w-24 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-slate-300 dark:border-white/20 shadow-2xl bg-white/10 backdrop-blur-md">
                <img src="/msf_logo.jpg" alt="MSF" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-screen" />
              </div>
              <div className="space-y-3 flex-1">
                <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight drop-shadow-md">
                  House Priority Queue
                </h1>
                <Breadcrumbs items={[{ label: "House Allocation", to: "/house-opp" }, { label: "Queue" }]} />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap xl:justify-end">
              <Button variant="outline" size="sm" className="h-11 px-5 text-sm font-bold gap-2 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-white/10 rounded-xl transition-all" onClick={() => navigate("/house-opp")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                size="sm"
                className="h-11 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-black shadow-[0_0_20px_rgba(var(--primary),0.3)] rounded-xl transition-all"
                onClick={() => void handleBatchAllocate()}
                disabled={batchLoading}
              >
                {batchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {batchLoading ? "Allocating..." : "Auto-Allocate All"}
              </Button>
              <Button variant="outline" size="sm" className="h-11 px-5 text-sm font-bold gap-2 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-white/10 rounded-xl transition-all" onClick={() => void fetchQueue()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════ ADVANCED KPI METRICS ═══════════════════ */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Inbox, label: "Total Queued", value: metrics.total, color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30", trend: `${applications.length} apps` },
            { icon: BarChart3, label: "In Progress", value: metrics.inProgress, color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30", trend: "Under review" },
            { icon: Target, label: "Ready to Assign", value: metrics.waiting, color: "text-violet-400", bg: "bg-violet-500/20", border: "border-violet-500/30", trend: "Awaiting allocation" },
            { icon: Home, label: "Allocated", value: metrics.allocated, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", trend: "Completed" },
            { icon: TrendingUp, label: "High Priority", value: metrics.highPriority, color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30", trend: `${metrics.avgScore} avg score` },
            { icon: Users, label: "Avg Score", value: metrics.avgScore, color: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30", trend: "pts average" },
          ].map((s, index) => (
            <div
              key={s.label}
              className={cn(
                "rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-5 group hover:bg-white/10 hover:border-slate-300 dark:border-white/20 transition-all duration-300 shadow-xl",
                index === 0 && "sm:col-span-3 lg:col-span-1"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors", s.bg, s.border)}>
                  <s.icon className={cn("h-6 w-6 drop-shadow-md", s.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{s.label}</p>
                  <div className="flex flex-col mt-1">
                    <p className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white drop-shadow-sm">{s.value}</p>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1">{s.trend}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════ FILTERS & TABLE TOOLBAR ═══════════════════ */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden relative">
          <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full sm:w-auto">
              <TabsList className="h-12 flex-wrap gap-1 bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-10 rounded-lg px-4 text-xs font-bold text-slate-500 dark:text-slate-400 data-[state=active]:bg-white/10 data-[state=active]:text-slate-900 dark:text-white data-[state=active]:shadow-md hover:bg-white/60 dark:bg-white/5 transition-all gap-2"
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    <span className="ml-1 text-[10px] bg-slate-200 dark:bg-black/40 px-2 py-0.5 rounded-md font-mono text-slate-600 dark:text-slate-300 group-data-[state=active]:text-slate-900 dark:text-white">{statusCounts[tab.value] || 0}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3">
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); }}>
                <SelectTrigger className="h-11 w-[150px] text-xs font-bold border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-xl">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 dark:border-white/10 bg-slate-900 text-slate-800 dark:text-slate-200 backdrop-blur-2xl">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="A">Type A</SelectItem>
                  <SelectItem value="B">Type B</SelectItem>
                  <SelectItem value="C">Type C</SelectItem>
                  <SelectItem value="D">Type D</SelectItem>
                  <SelectItem value="E">Barrack</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <Input
                  placeholder="Search name, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-[180px] lg:w-[260px] pl-10 text-xs font-bold border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-xl placeholder:text-slate-500"
                />
              </div>

              <div className="bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-xl flex gap-1 h-11 items-center px-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-9 w-9 p-0 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all", viewMode === "table" && "bg-white/10 text-slate-900 dark:text-white shadow-sm")}
                  onClick={() => setViewMode("table")}
                  title="Table view"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-9 w-9 p-0 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all", viewMode === "cards" && "bg-white/10 text-slate-900 dark:text-white shadow-sm")}
                  onClick={() => setViewMode("cards")}
                  title="Card view"
                >
                   <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                </Button>
              </div>
            </div>
          </div>

          {/* ══════ TABLE VIEW ══════ */}
          {viewMode === "table" && (
            <div className="p-0 bg-slate-100 dark:bg-black/20">
              <DataTable<QueueRow>
                tableKey="house-queue-page"
                data={filtered}
                rowKey={(app) => app.id}
                loading={loading}
                searchable={false}
                emptyMessage={
                  statusTab !== "all"
                    ? `No applications with status "${statusTab}"`
                    : "No queued applications found."
                }
                emptyIcon={<Inbox className="h-10 w-10 text-slate-600/50" />}
                exportFileName={`house-queue-${new Date().toISOString().slice(0, 10)}`}
                pageSize={25}
                onRowDoubleClick={(app) => navigate(`/house-opp/queue/${app.id}`)}
                columns={queueColumns}
                expandable={{
                  expandableContent: renderExpandedContent,
                }}
                className="border-0 !bg-transparent dark:!bg-transparent [&_th]:bg-slate-200 dark:bg-black/40 [&_th]:border-slate-200 dark:border-white/5 [&_td]:border-slate-200 dark:border-white/5 [&_tr]:hover:bg-white/60 dark:bg-white/5 [&_tr.bg-muted]:bg-white/10"
              />
            </div>
          )}

          {/* ══════ CARD VIEW ══════ */}
          {viewMode === "cards" && (
            <div className="p-6 bg-slate-100 dark:bg-black/20">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <div className="h-16 w-16 rounded-2xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                    <Inbox className="h-8 w-8 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">No applications match your filters</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((app) => {
                    const isLoading = actionLoading === app.id;
                    const isTop3 = app.queuePosition <= 3;
                    return (
                      <div
                        key={app.id}
                        className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-5 transition-all duration-300 hover:border-primary/40 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(var(--primary),0.15)] cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/house-opp/queue/${app.id}`)}
                      >
                         <div className="flex items-start justify-between mb-5">
                           <div className="flex items-center gap-3">
                             <ApplicantAvatar name={app.employee_name} id={app.employee_id} />
                             <div className="min-w-0">
                               <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{app.employee_name}</p>
                               <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{app.employee_id}</p>
                             </div>
                           </div>
                           <span
                             className={cn(
                               "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black shadow-sm border",
                               isTop3
                                 ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                 : "bg-slate-200 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10",
                             )}
                           >
                             {isTop3 ? ["\u{1F947}", "\u{1F948}", "\u{1F949}"][app.queuePosition - 1] : `#${app.queuePosition}`}
                           </span>
                         </div>

                         <div className="mb-5 bg-slate-100 dark:bg-black/20 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                           <ScoreIndicator score={app.priority_score || 0} />
                         </div>

                         <div className="flex flex-wrap items-center justify-between text-[10px] gap-2 mb-5">
                           <StatusChip status={app.status} size="sm" />
                           <span className="text-slate-500 font-mono font-bold bg-slate-200 dark:bg-black/40 px-2 py-1 rounded-md">{new Date(app.submitted_at || app.created_at).toLocaleDateString()}</span>
                         </div>

                         <div className="flex items-center gap-2 flex-wrap mb-2">
                           {app.eligible_house_category && <CategoryBadge category={app.eligible_house_category} />}
                           {(() => {
                             const mode = app.allocation_mode || determineAllocationMode(app);
                             if (!mode) return null;
                             return (
                               <span className={cn(
                                 "inline-flex items-center text-[10px] font-bold border px-2 py-1 rounded-md",
                                 mode === "ROOM_ALLOCATION"
                                   ? "text-sky-500 bg-sky-500/10 border-sky-500/30"
                                   : "text-violet-500 bg-violet-500/10 border-violet-500/30",
                               )}>
                                 {mode === "ROOM_ALLOCATION" ? "Room" : "Whole house"}
                               </span>
                             );
                           })()}
                           {app.supporting_document && (
                             <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md gap-1">
                               <Paperclip className="h-3 w-3" /> Doc
                             </span>
                           )}
                           {app.has_disability && (
                             <span className="inline-flex items-center text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-md">
                               Disability
                             </span>
                           )}
                         </div>

                           <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-white/5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 mt-2">
                             <Button
                               size="sm"
                               variant="ghost"
                               className="h-9 flex-1 text-xs font-bold text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 border border-violet-500/30 bg-violet-500/10 rounded-xl"
                               disabled={isLoading}
                               onClick={(e) => { e.stopPropagation(); setBreakdownApp(app); }}
                             >
                               <BarChart3 className="h-3.5 w-3.5 mr-1" /> Score
                             </Button>
                           {app.status === "Submitted" && (
                             <Button
                               size="sm"
                               variant="ghost"
                               className="h-9 flex-1 text-xs font-bold text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 rounded-xl"
                               disabled={isLoading}
                               onClick={(e) => { e.stopPropagation(); void handleQuickStatus(app.id, "Under Review"); }}
                             >
                               {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                               Review
                             </Button>
                           )}
                           {app.status === "Under Review" && (
                             <Button
                               size="sm"
                               variant="ghost"
                               className="h-9 flex-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded-xl"
                               disabled={isLoading}
                               onClick={(e) => { e.stopPropagation(); void handleQuickStatus(app.id, "Verified"); }}
                             >
                               {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                               Verify
                             </Button>
                           )}
                           <Button
                             size="sm"
                             variant="ghost"
                             className="h-9 flex-1 text-xs font-bold text-slate-900 dark:text-white hover:bg-white/20 bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl"
                             onClick={(e) => { e.stopPropagation(); navigate(`/house-opp/queue/${app.id}`); }}
                           >
                             <Eye className="h-3.5 w-3.5 mr-1" /> Open
                           </Button>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════ BATCH RESULT DIALOG ═══════════════════ */}
        <Dialog open={batchResult !== null} onOpenChange={(open) => { if (!open) setBatchResult(null); }}>
          <DialogContent className="max-w-xl border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl text-slate-800 dark:text-slate-200">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-900 dark:text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                  <Zap className="h-5 w-5" />
                </div>
                Batch Allocation Results
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 font-semibold text-sm pt-1">
                {batchResult?.allocated.length} successfully allocated, {batchResult?.skipped.length} skipped
              </DialogDescription>
            </DialogHeader>
            {batchResult && (
              <div className="max-h-[400px] space-y-5 overflow-y-auto pr-2 custom-scrollbar mt-2">
                {batchResult.allocated.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                       <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                       <p className="text-sm font-black uppercase tracking-wider text-emerald-400">Allocated</p>
                    </div>
                    <div className="space-y-2">
                      {batchResult.allocated.map((r) => (
                        <div key={r.house_id} className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{r.resource ?? r.house_id}</span>
                          <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{r.allocated_to || r.application_no}</span>
                          <Badge variant="outline" className="text-xs font-bold border-emerald-500/40 bg-emerald-500/20 text-emerald-300 px-2">{r.score || "\u2014"} pts</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {batchResult.skipped.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 mt-4">
                       <AlertTriangle className="h-4 w-4 text-amber-400" />
                       <p className="text-sm font-black uppercase tracking-wider text-amber-400">Skipped</p>
                    </div>
                    <div className="space-y-2">
                      {batchResult.skipped.map((r) => (
                        <div key={r.house_id} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{r.house_id}</span>
                          <span className="text-sm font-medium text-amber-200/70">{r.allocated_to || r.application_no || "No match"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══════════════════ DOCUMENT PREVIEW DIALOG ═══════════════════ */}
        <Dialog open={docPreview !== null} onOpenChange={(open) => { if (!open) setDocPreview(null); }}>
          <DialogContent className="max-w-md border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl text-slate-800 dark:text-slate-200">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-900 dark:text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                  <FileText className="h-5 w-5" />
                </div>
                Document Preview
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                {docPreview?.supporting_document ? (
                  <span className="break-all font-mono text-xs font-medium">{docPreview.supporting_document.split("/").pop()}</span>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            {docPreview?.supporting_document && (
              <div className="py-2">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 mt-2">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{docPreview.employee_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{docPreview.employee_id}</p>
                    </div>
                  </div>
                  <Button className="w-full gap-2 h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)] rounded-xl" asChild>
                    <a href={docPreview.supporting_document} target="_blank" rel="noreferrer">
                      <Eye className="h-4 w-4" /> Open Document in New Tab
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══════════════════ SCORE BREAKDOWN DIALOG ═══════════════════ */}
        <BreakdownDialog app={breakdownApp} onClose={() => setBreakdownApp(null)} />
      </div>
    </div>
  );
}