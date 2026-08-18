import {
  useCallback, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";
import {
  getApplication, updateApplicationStatus, autoAllocateHouse,
  deallocateHouse, listAllocationLogs, recalculateApplicationScore,
  batchAllocateAll,
  determineAllocationMode, allocationModeLabel,
  type BatchAllocateResult, type ApplicationStatus,
  type HouseApplication, type AllocationLog,
  type ScoreBreakdown, type CriterionContribution,
} from "@/services/houseApplication";
import { listHouses, type House } from "@/services/houses";
import {
  Activity, AlertTriangle, ArrowLeft, Award, BadgeCheck, Building2,
  CalendarDays, CheckCircle2, Clock3, Cpu, CircleDot,
  Eye, FileText, Fingerprint, Hash, History,
  KeyRound, Loader2, MapPin, Medal, Printer, RefreshCw, Scale,
  SearchCheck, Send, ShieldCheck, Sparkles, Target, Trash2, TrendingUp,
  Users, XCircle, Zap, Star, UserRound, Settings, BarChart3, TriangleAlert,
} from "lucide-react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fmt(v?: string | null) {
  if (!v) return "\u2014";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function daysSince(v?: string | null) {
  return v ? Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000) : 0;
}
function houseDisplay(h: { house_id?: string; house_number?: string; id: string }) {
  return h.house_number || h.house_id || h.id;
}
function hasDamages(h: House) {
  return !!(h.damaged_door || h.damaged_windows || h.damaged_walls || h.damaged_switch || h.damaged_bulb || h.damaged_water);
}
function damageList(h: House): string[] {
  const d: string[] = [];
  if (h.damaged_door) d.push("Door");
  if (h.damaged_windows) d.push("Windows");
  if (h.damaged_walls) d.push("Walls");
  if (h.damaged_switch || h.damaged_bulb) d.push("Electrical");
  if (h.damaged_water) d.push("Water");
  return d;
}
function formatRaw(raw: unknown): string {
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (raw === null || raw === undefined || raw === "") return "\u2014";
  return String(raw);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  Draft:                    { label: "Draft",     cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",         dot: "bg-slate-400" },
  Submitted:                { label: "Submitted", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",               dot: "bg-sky-400" },
  "Under Review":           { label: "Under Review", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", dot: "bg-indigo-400" },
  Verified:                 { label: "Verified",  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  "Waiting for Allocation": { label: "In Queue",  cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",       dot: "bg-amber-400" },
  Allocated:                { label: "Allocated", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  Rejected:                 { label: "Rejected",  cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",           dot: "bg-rose-400" },
  Returned:                 { label: "Returned",  cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",    dot: "bg-orange-400" },
};

const LOG_DOT: Record<string, string> = {
  STATUS_CHANGED:  "bg-sky-500",
  AUTO_ALLOCATED:  "bg-emerald-500",
  MANUAL_OVERRIDE: "bg-violet-500",
  DEALLOCATED:     "bg-rose-500",
};

const PIPELINE: { key: ApplicationStatus; label: string; icon: ReactNode }[] = [
  { key: "Submitted",              label: "Submitted", icon: <Send className="h-3.5 w-3.5" /> },
  { key: "Under Review",           label: "Review",    icon: <SearchCheck className="h-3.5 w-3.5" /> },
  { key: "Verified",               label: "Verified",  icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: "Waiting for Allocation", label: "Queued",    icon: <Clock3 className="h-3.5 w-3.5" /> },
  { key: "Allocated",              label: "Allocated", icon: <KeyRound className="h-3.5 w-3.5" /> },
];

type BreakdownRow = {
  key: string; label: string; raw: string; weight: number;
  normalised: number; contribution: number; color: string;
};

const CRITERIA_META: Record<string, { label: string; color: string }> = {
  job_grade:        { label: "Job Grade",        color: "#3b82f6" },
  years_of_service: { label: "Years of Service", color: "#8b5cf6" },
  family_size:      { label: "Family Size",      color: "#10b981" },
  disability:       { label: "Disability",       color: "#f59e0b" },
  fifo:             { label: "Waiting Time",     color: "#f43f5e" },
  marital_status:   { label: "Marital Status",   color: "#06b6d4" },
  employment_type:  { label: "Employment Type",  color: "#a855f7" },
  medical_priority: { label: "Medical Priority", color: "#ec4899" },
};

function parseBreakdownRows(bd: ScoreBreakdown | null | undefined): BreakdownRow[] {
  if (!bd) return [];
  return (Object.keys(CRITERIA_META) as (keyof typeof CRITERIA_META)[])
    .map((key) => {
      const c = bd[key] as CriterionContribution | undefined;
      const meta = CRITERIA_META[key];
      if (!c || typeof c !== "object" || c.normalised === undefined) return null;
      return {
        key, label: meta.label, raw: formatRaw(c.raw),
        weight: Number(c.weight) || 0, normalised: Number(c.normalised) || 0,
        contribution: Number(c.contribution) || 0, color: meta.color,
      };
    })
    .filter((r): r is BreakdownRow => r !== null);
}

function computeHouseMatch(h: House, a: HouseApplication): number {
  let s = 0;
  if (h.house_type === a.eligible_house_category) s += 40;
  const cap = h.capacity || 1, fam = a.family_size || 1;
  s += cap >= fam ? 30 : Math.max(0, 30 - (fam - cap) * 10);
  s += (a.preferred_location && h.location?.toLowerCase().includes(a.preferred_location.toLowerCase())) ? 20 : 10;
  if (!hasDamages(h)) s += 10;
  return Math.min(100, Math.max(0, s));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATUS CHIP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatusChip({ status, size }: { status: ApplicationStatus; size?: "sm" | "md" }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.Draft;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border font-semibold",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
      cfg.cls,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SCORE RING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  const stroke = 6;
  const r = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const c = Math.min(Math.max(Number(score) || 0, 0), 100);
  const offset = circ - (c / 100) * circ;
  const color = c >= 70 ? "#10b981" : c >= 45 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeOpacity="0.5" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g-${uid})`}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={Math.round(c)} duration={1000} className="text-2xl font-black tabular-nums leading-none text-foreground" />
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-0.5">score</span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION COLOR THEMES (for the big unified table)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SectionTheme = {
  headerBg: string;
  headerText: string;
  headerBorder: string;
  rowAlt: string;
  accent: string;
};

const THEMES = {
  system:   { headerBg: "bg-slate-800 dark:bg-slate-900",    headerText: "text-slate-100",  headerBorder: "border-slate-700", rowAlt: "bg-slate-50/50 dark:bg-slate-900/50", accent: "text-slate-600 dark:text-slate-400" },
  profile:  { headerBg: "bg-blue-600 dark:bg-blue-700",      headerText: "text-blue-50",    headerBorder: "border-blue-500",  rowAlt: "bg-blue-50/40 dark:bg-blue-950/30",  accent: "text-blue-600 dark:text-blue-400" },
  app:      { headerBg: "bg-indigo-600 dark:bg-indigo-700",  headerText: "text-indigo-50",  headerBorder: "border-indigo-500", rowAlt: "bg-indigo-50/40 dark:bg-indigo-950/30", accent: "text-indigo-600 dark:text-indigo-400" },
  score:    { headerBg: "bg-emerald-600 dark:bg-emerald-700",headerText: "text-emerald-50", headerBorder: "border-emerald-500",rowAlt: "bg-emerald-50/40 dark:bg-emerald-950/30", accent: "text-emerald-600 dark:text-emerald-400" },
  elig:     { headerBg: "bg-violet-600 dark:bg-violet-700",  headerText: "text-violet-50",  headerBorder: "border-violet-500", rowAlt: "bg-violet-50/40 dark:bg-violet-950/30", accent: "text-violet-600 dark:text-violet-400" },
  housing:  { headerBg: "bg-amber-600 dark:bg-amber-700",    headerText: "text-amber-50",   headerBorder: "border-amber-500",  rowAlt: "bg-amber-50/40 dark:bg-amber-950/30",  accent: "text-amber-600 dark:text-amber-400" },
  activity: { headerBg: "bg-cyan-600 dark:bg-cyan-700",      headerText: "text-cyan-50",    headerBorder: "border-cyan-500",   rowAlt: "bg-cyan-50/40 dark:bg-cyan-950/30",   accent: "text-cyan-600 dark:text-cyan-400" },
  scoreDetail: { headerBg: "bg-teal-600 dark:bg-teal-700",   headerText: "text-teal-50",    headerBorder: "border-teal-500",   rowAlt: "bg-teal-50/40 dark:bg-teal-950/30",   accent: "text-teal-600 dark:text-teal-400" },
} satisfies Record<string, SectionTheme>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UNIFIED TABLE SECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TableSection({ theme, title, subtitle, icon, cols, children }: {
  theme: SectionTheme;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  cols: number;
  children: ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={cols} className="p-0">
          <div className={cn("flex items-center gap-2.5 px-4 py-2.5", theme.headerBg, theme.headerText)}>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/15">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
              {subtitle && <span className="ml-2 text-[10px] font-normal opacity-70">{subtitle}</span>}
            </div>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function FieldCell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-2.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="text-xs font-semibold text-foreground">{children}</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOT FOUND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-10 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/30">
          <FileText className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Application Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The application doesn't exist or has been removed.</p>
        <Button variant="outline" className="mt-6 h-10 rounded-xl px-6 font-semibold" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function HouseQueueReview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail]               = useState<HouseApplication | null>(null);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [reasonOpen, setReasonOpen]       = useState(false);
  const [reasonStatus, setReasonStatus]   = useState<ApplicationStatus | null>(null);
  const [reasonText, setReasonText]       = useState("");
  const [allocating, setAllocating]       = useState(false);
  const [deallocating, setDeallocating]   = useState(false);
  const [calculating, setCalculating]     = useState(false);
  const [confirmOpen, setConfirmOpen]     = useState(false);
  const [invoiceOpen, setInvoiceOpen]     = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [allocationLogs, setAllocationLogs] = useState<AllocationLog[]>([]);
  const [availableHouses, setAvailableHouses] = useState<House[]>([]);
  const [batchAllocating, setBatchAllocating] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    allocated: BatchAllocateResult[]; skipped: BatchAllocateResult[]; total_houses: number;
  } | null>(null);
  const [scoringHouses, setScoringHouses] = useState<Map<string, number>>(new Map());

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [app, logs, houses] = await Promise.all([
        getApplication(id), listAllocationLogs(), listHouses(),
      ]);
      setDetail(app);
      setAllocationLogs(logs.filter((l) => l.application === id));
      if (app.eligible_house_category) {
        const active = houses.filter(
          (h) => h.house_type === app.eligible_house_category && h.status === "Active" && h.is_available,
        );
        setAvailableHouses(active);
        const scores = new Map<string, number>();
        active.forEach((h) => scores.set(h.id, computeHouseMatch(h, app)));
        setScoringHouses(scores);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load application");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  const handleAutoAllocate = async (houseId: string) => {
    if (!id || !detail) return;
    try {
      setAllocating(true);
      const mode = detail.allocation_mode || determineAllocationMode(detail);
      const house = availableHouses.find((h) => h.id === houseId);
      const roomLabel = mode === "ROOM_ALLOCATION" ? (house?.available_rooms?.[0] ?? undefined) : undefined;
      const u = await autoAllocateHouse(houseId, id, roomLabel);
      setDetail(u);
      toast.success(mode === "ROOM_ALLOCATION" ? "Room allocated successfully" : "House allocated successfully");
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Allocation failed"); }
    finally { setAllocating(false); }
  };

  const handleDeallocate = async () => {
    if (!id) return;
    try {
      setDeallocating(true);
      const u = await deallocateHouse(id, "Manual deallocation");
      setDetail(u); toast.success("Deallocated successfully");
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Failed to deallocate"); }
    finally { setDeallocating(false); }
  };

  const handleRecalculate = async () => {
    if (!id) return;
    try {
      setCalculating(true);
      const u = await recalculateApplicationScore(id);
      setDetail(u); toast.success("Score recalculated");
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Failed to recalculate"); }
    finally { setCalculating(false); }
  };

  const setStatus = useCallback(async (status: ApplicationStatus, reason?: string) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const u = await updateApplicationStatus(id, status, reason);
      setDetail(u); toast.success(`Status updated to ${status}`);
      setReasonOpen(false); setReasonStatus(null); setReasonText("");
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Failed to update status"); }
    finally { setSubmitting(false); }
  }, [id, fetchDetail]);

  const handleBatchAllocate = async () => {
    try {
      setBatchAllocating(true);
      const r = await batchAllocateAll();
      setBatchResult(r);
      toast.success(`Batch complete \u2014 ${r.allocated.length} allocated, ${r.skipped.length} skipped`);
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Batch allocation failed"); }
    finally { setBatchAllocating(false); }
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const sortedHouses = useMemo(
    () => [...availableHouses].sort((a, b) => (scoringHouses.get(b.id) ?? 0) - (scoringHouses.get(a.id) ?? 0)),
    [availableHouses, scoringHouses],
  );
  const topHouse = sortedHouses[0];
  const topMatch = topHouse ? (scoringHouses.get(topHouse.id) ?? 0) : 0;
  const breakdownRows = useMemo(() => parseBreakdownRows(detail?.score_breakdown), [detail]);
  const engineReasons = useMemo(() => detail?.score_breakdown?.recommendation_reasons ?? [], [detail]);
  const topsisCloseness = detail?.score_breakdown?.topsis_closeness ?? null;
  const scoreTotal = Number(detail?.priority_score) || 0;
  const canAllocate = detail?.status === "Waiting for Allocation" || detail?.status === "Verified";
  const appMode = detail ? (detail.allocation_mode || determineAllocationMode(detail)) : "";
  const isRoomMode = appMode === "ROOM_ALLOCATION";
  const wd = detail ? daysSince(detail.submitted_at) : 0;
  const initials = (detail?.employee_name || detail?.requester_name || "?")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const primaryAction = useMemo(() => {
    if (!detail) return null;
    switch (detail.status) {
      case "Submitted":
      case "Under Review":
        return { label: "Verify & Approve", icon: ShieldCheck, run: () => void setStatus("Verified"), disabled: submitting };
      case "Verified":
        return { label: "Move to Queue", icon: Target, run: () => void setStatus("Waiting for Allocation"), disabled: submitting };
      case "Waiting for Allocation":
        return { label: "Allocate Best Match", icon: Target, run: () => { setSelectedHouse(topHouse); setConfirmOpen(true); }, disabled: !topHouse || allocating };
      default: return null;
    }
  }, [detail, topHouse, submitting, allocating, setStatus]);

  const matchReasons = topHouse && detail ? [
    topHouse.house_type === detail.eligible_house_category
      ? { ok: true,  text: "Exact eligibility category match" }
      : { ok: false, text: `Type ${topHouse.house_type} differs from eligible ${detail.eligible_house_category}` },
    (topHouse.capacity || 1) >= (detail.family_size || 1)
      ? { ok: true,  text: "Capacity covers family size" }
      : { ok: false, text: "Capacity is below household size" },
    detail.preferred_location && topHouse.location?.toLowerCase().includes(detail.preferred_location.toLowerCase())
      ? { ok: true,  text: "Matches preferred location" }
      : { ok: false, text: "Alternate location offered" },
    !hasDamages(topHouse)
      ? { ok: true,  text: "House is in good condition" }
      : { ok: false, text: "Requires maintenance before occupancy" },
  ] : [];

  const eligibilityRules = detail ? [
    { rule: "Job Grade Eligibility", ok: !!detail.eligible_house_category, detail: detail.eligible_house_category ? `Grade ${detail.job_grade} \u2192 Type ${detail.eligible_house_category}` : "Not eligible" },
    { rule: "Allocation Mode", ok: true, detail: allocationModeLabel(appMode) },
    { rule: "Capacity Check", ok: (detail.family_size || 1) <= (topHouse?.capacity || 999), detail: topHouse ? `Family ${detail.family_size || 1} \u2264 Capacity ${topHouse.capacity || 1}` : "No house selected" },
    { rule: "Disability Priority", ok: detail.has_disability, detail: detail.has_disability ? "Active \u2014 weighted in scoring" : "Not declared", isFlag: true },
    { rule: "Queue Position", ok: !!detail.queue_position, detail: detail.queue_position ? `#${detail.queue_position}` : "Pending" },
  ] : [];

  if (loading) return <PageSkeleton />;
  if (!detail) return <NotFoundState onBack={() => navigate("/house-opp/queue")} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">

        {/* ═══ PAGE HEADER ═══ */}
        <header className="mb-5">
          <div className="mb-3">
            <Breadcrumbs items={[
              { label: "House Allocation", to: "/house-opp" },
              { label: "Queue", to: "/house-opp/queue" },
              { label: detail.employee_name || "Review" },
            ]} />
          </div>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                  {detail.employee_name || detail.requester_name}
                </h1>
                <StatusChip status={detail.status} />
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Hash className="h-3 w-3" />{detail.application_no || detail.id}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Fingerprint className="h-3 w-3" />{detail.employee_id || "\u2014"}
                </span>
                {detail.eligible_house_category && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                    <Award className="h-3 w-3" /> Eligible: {detail.eligible_house_category}
                  </span>
                )}
                {detail.has_disability && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" /> Disability
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
              <Button variant="outline" size="sm" className="h-9 rounded-lg px-4 text-xs font-semibold" onClick={() => navigate("/house-opp/queue")}>
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg px-4 text-xs font-semibold" onClick={() => void handleRecalculate()} disabled={calculating}>
                {calculating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-2 h-3.5 w-3.5" />}
                Recalculate
              </Button>
              {primaryAction && (
                <Button size="sm" className="h-9 rounded-lg px-5 text-xs font-semibold shadow-sm" onClick={primaryAction.run} disabled={primaryAction.disabled}>
                  {submitting || allocating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <primaryAction.icon className="mr-2 h-3.5 w-3.5" />}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* ═══ ALLOCATED BANNER ═══ */}
        {detail.status === "Allocated" && detail.allocated_house_id && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Allocated to{" "}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {detail.allocated_house_id}{detail.allocated_room_label ? ` \u2014 Room ${detail.allocated_room_label}` : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(detail.allocated_at)} \u00b7 {fmtTime(detail.allocated_at)}
                  {detail.allocated_by_name && <> \u00b7 by <strong>{detail.allocated_by_name}</strong></>}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void handleDeallocate()} disabled={deallocating}
              className="h-8 shrink-0 rounded-lg border-rose-500/30 bg-rose-500/8 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15">
              {deallocating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1.5 h-3 w-3" />}
              Reverse Allocation
            </Button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ONE BIG UNIFIED TABLE
        ═══════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">

          {/* ── WORKFLOW STEPPER ── */}
          <div className="border-b border-border/60 px-6 py-5">
            <div className="relative">
              <div className="absolute left-[8%] right-[8%] top-1/2 h-0.5 -translate-y-1/2 bg-border/60" />
              {(() => {
                const idx = PIPELINE.findIndex((p) => p.key === detail.status);
                const isTerminal = detail.status === "Rejected" || detail.status === "Returned";
                const progress = idx >= 0 ? (idx / (PIPELINE.length - 1)) * 100 : 0;
                return (
                  <>
                    <div className="absolute left-[8%] top-1/2 h-0.5 -translate-y-1/2 bg-primary/60 transition-all duration-700"
                      style={{ width: isTerminal ? "0%" : `${progress * 0.84}%` }} />
                    <div className="relative flex items-center justify-between">
                      {PIPELINE.map((step, i) => {
                        const done = idx >= 0 && i < idx && !isTerminal;
                        const current = idx >= 0 && i === idx && !isTerminal;
                        return (
                          <div key={step.key} className="flex flex-col items-center gap-1.5">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card transition-all",
                              done    && "border-primary/40 bg-primary/10 text-primary",
                              current && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25",
                              !done && !current && "border-border/60 text-muted-foreground/40",
                            )}>{step.icon}</div>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider",
                              current ? "text-primary" : done ? "text-foreground/60" : "text-muted-foreground/40",
                            )}>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
            {(detail.status === "Rejected" || detail.status === "Returned") && (
              <div className={cn(
                "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
                detail.status === "Rejected" ? "border-rose-500/25 bg-rose-500/8 text-rose-600 dark:text-rose-400"
                                              : "border-orange-500/25 bg-orange-500/8 text-orange-600 dark:text-orange-400",
              )}>
                {detail.status === "Rejected" ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0" />}
                {detail.status === "Rejected" ? "Application rejected \u2014 no further action possible." : "Returned for correction \u2014 awaiting re-submission."}
              </div>
            )}
          </div>

          {/* ═══ BIG TABLE ═══ */}
          <table className="w-full text-sm border-collapse">

            {/* ─── SECTION 1: SYSTEM INFORMATION ─── */}
            <TableSection theme={THEMES.system} title="System Information" subtitle="Engine configuration and metadata" icon={<Settings className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
                    <FieldCell label="Scoring Engine"><span className="font-bold">MCDA + TOPSIS</span></FieldCell>
                    <FieldCell label="Allocation Mode">{allocationModeLabel(appMode)}</FieldCell>
                    <FieldCell label="Eligible Category">{detail.eligible_house_category || "\u2014"}</FieldCell>
                    <FieldCell label="Days Waiting"><span className="font-bold">{wd}</span></FieldCell>
                    <FieldCell label="TOPSIS Confidence">{topsisCloseness != null ? `${Math.round(topsisCloseness * 100)}%` : "\u2014"}</FieldCell>
                    <FieldCell label="Cascade Logic"><span className="font-bold text-emerald-600 dark:text-emerald-400">Enabled</span></FieldCell>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 divide-x divide-border/40">
                    <FieldCell label="Queue Position">{detail.queue_position ? <span className="font-bold text-primary">#{detail.queue_position}</span> : "\u2014"}</FieldCell>
                    <FieldCell label="Score Config"><span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span></FieldCell>
                    <FieldCell label="House Types">Staff, A, B, C, D, E</FieldCell>
                    <FieldCell label="Room Capacity">R1\u2192R2\u2192R3</FieldCell>
                    <FieldCell label="Available Houses">{sortedHouses.length} vacant</FieldCell>
                    <FieldCell label="Scoring Weights">Grade 30% | Service 25% | Family 20%</FieldCell>
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 2: APPLICANT PROFILE ─── */}
            <TableSection theme={THEMES.profile} title="Applicant Profile" subtitle="Employee information and demographics" icon={<UserRound className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
                    <FieldCell label="Full Name">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-border/60">
                          <AvatarFallback className="bg-primary/10 text-[9px] font-black text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="truncate font-bold">{detail.employee_name || detail.requester_name || "\u2014"}</span>
                      </div>
                    </FieldCell>
                    <FieldCell label="Employee ID"><span className="font-mono font-bold">{detail.employee_id || "\u2014"}</span></FieldCell>
                    <FieldCell label="National ID"><span className="font-mono">{detail.national_id || "\u2014"}</span></FieldCell>
                    <FieldCell label="Gender">{detail.gender || "\u2014"}</FieldCell>
                    <FieldCell label="Job Position">{detail.job_position || "\u2014"}</FieldCell>
                    <FieldCell label="Job Grade"><span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">{detail.job_grade || "\u2014"}</span></FieldCell>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
                    <FieldCell label="Job Type">{detail.job_type || "\u2014"}</FieldCell>
                    <FieldCell label="Marital Status">{detail.marital_status || "\u2014"}</FieldCell>
                    <FieldCell label="Years of Service"><span className="font-bold">{detail.years_of_service ?? 0} years</span></FieldCell>
                    <FieldCell label="Family Size">{detail.family_size || 1} people</FieldCell>
                    <FieldCell label="Children">{String(detail.number_of_children ?? 0)}</FieldCell>
                    <FieldCell label="Disability">
                      {detail.has_disability
                        ? <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"><Star className="h-2.5 w-2.5 fill-amber-400" /> Yes</span>
                        : <span className="text-muted-foreground">No</span>}
                    </FieldCell>
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 3: APPLICATION DETAILS ─── */}
            <TableSection theme={THEMES.app} title="Application Details" subtitle="Request metadata, lifecycle dates, and documents" icon={<FileText className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
                    <FieldCell label="Application No."><span className="font-mono font-bold">{detail.application_no || detail.id}</span></FieldCell>
                    <FieldCell label="Status"><StatusChip status={detail.status} size="sm" /></FieldCell>
                    <FieldCell label="Allocation Mode">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                        isRoomMode ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                   : "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
                      )}>{allocationModeLabel(appMode)}</span>
                    </FieldCell>
                    <FieldCell label="Requested Category">{detail.requested_house_category || "\u2014"}</FieldCell>
                    <FieldCell label="Eligible Category">
                      {detail.eligible_house_category
                        ? <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-2.5 w-2.5" /> {detail.eligible_house_category}</span>
                        : "\u2014"}
                    </FieldCell>
                    <FieldCell label="Preferred Location">{detail.preferred_location || "Any"}</FieldCell>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40">
                    <FieldCell label="Submitted">{fmt(detail.submitted_at)} {fmtTime(detail.submitted_at)}</FieldCell>
                    <FieldCell label="Reviewed">{detail.reviewed_at ? `${fmt(detail.reviewed_at)}${detail.reviewed_by_name ? ` \u00b7 ${detail.reviewed_by_name}` : ""}` : "\u2014"}</FieldCell>
                    <FieldCell label="Allocated">{detail.allocated_at ? `${fmt(detail.allocated_at)}${detail.allocated_by_name ? ` \u00b7 ${detail.allocated_by_name}` : ""}` : "\u2014"}</FieldCell>
                    <FieldCell label="Reason for Request">
                      <span className="italic text-muted-foreground text-[11px]">{detail.reason_for_request || "No reason provided"}</span>
                    </FieldCell>
                  </div>
                </td>
              </tr>
              {detail.supporting_document && (
                <tr className="border-b border-border/40">
                  <td className="p-0" colSpan={6}>
                    <div className="px-4 py-2.5">
                      <Button variant="outline" className="h-8 rounded-lg text-xs font-semibold" asChild>
                        <a href={detail.supporting_document} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5 text-emerald-500" /> View Supporting Document
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </TableSection>

            {/* ─── SECTION 4: ELIGIBILITY ANALYSIS ─── */}
            <TableSection theme={THEMES.elig} title="Eligibility Analysis" subtitle="Rules applied and validation results" icon={<ShieldCheck className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="divide-y divide-border/30">
                    {eligibilityRules.map((rule, i) => (
                      <div key={rule.rule} className={cn("grid grid-cols-12 items-center px-4 py-2.5", i % 2 === 1 && THEMES.elig.rowAlt)}>
                        <div className="col-span-3 text-xs font-semibold text-foreground">{rule.rule}</div>
                        <div className="col-span-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                            rule.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : rule.isFlag && rule.ok ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "border-border/60 bg-muted/20 text-muted-foreground",
                          )}>
                            {rule.ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <CircleDot className="h-2.5 w-2.5" />}
                            {rule.ok ? "Active" : "N/A"}
                          </span>
                        </div>
                        <div className="col-span-7 text-xs text-muted-foreground">{rule.detail}</div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 5: PRIORITY SCORE ─── */}
            <TableSection theme={THEMES.score} title="Priority Score & Weighted Criteria" subtitle="MCDA scoring breakdown with TOPSIS ranking" icon={<Scale className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="flex items-center gap-6 px-5 py-4">
                    <ScoreRing score={scoreTotal} />
                    <div className="grid grid-cols-3 gap-3 flex-1">
                      <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total Score</p>
                        <p className="text-lg font-black tabular-nums text-foreground"><CountUp value={scoreTotal} duration={800} decimals={2} /> <span className="text-xs text-muted-foreground font-normal">/ 100</span></p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Days Waiting</p>
                        <p className="text-lg font-black tabular-nums text-sky-600 dark:text-sky-400"><CountUp value={wd} duration={800} /></p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">TOPSIS</p>
                        <p className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                          {topsisCloseness != null ? `${Math.round(topsisCloseness * 100)}%` : "\u2014"}
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 6: SCORE BREAKDOWN ─── */}
            <TableSection theme={THEMES.scoreDetail} title="Score Breakdown" subtitle="Criterion-level contribution analysis" icon={<BarChart3 className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  {breakdownRows.length > 0 ? (
                    <div className="divide-y divide-border/30">
                      {breakdownRows.map((row, i) => {
                        const pct = Math.min(100, Math.max(0, row.normalised * 100));
                        return (
                          <div key={row.key} className={cn("grid grid-cols-12 items-center px-4 py-2.5 gap-3", i % 2 === 1 && THEMES.scoreDetail.rowAlt)}>
                            <div className="col-span-3 flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                              <span className="text-xs font-semibold text-foreground">{row.label}</span>
                            </div>
                            <div className="col-span-2 text-xs text-muted-foreground">{row.raw}</div>
                            <div className="col-span-4">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                  <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                                    style={{ width: `${pct}%`, backgroundColor: row.color }} />
                                </div>
                                <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-right text-xs font-bold tabular-nums">
                              +{row.contribution.toFixed(2)} <span className="text-muted-foreground font-normal">/ {row.weight}</span>
                            </div>
                            <div className="col-span-1" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No score computed yet \u2014 run <strong>Recalculate</strong>.
                    </div>
                  )}
                  {engineReasons.length > 0 && (
                    <div className="border-t border-border/40 px-4 py-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        <Cpu className="h-3 w-3" /> Engine Recommendations
                      </p>
                      <div className="space-y-1">
                        {engineReasons.map((r) => (
                          <div key={r} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/80">
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 7: HOUSING OPTIONS ─── */}
            <TableSection theme={THEMES.housing} title="Housing Options" subtitle="Available houses ranked by match score" icon={<Building2 className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="p-4">
                    {detail.status === "Allocated" ? (
                      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <p className="text-xs text-muted-foreground">Allocated. Use <strong>Reverse Allocation</strong> to free the house.</p>
                      </div>
                    ) : canAllocate && topHouse ? (
                      <div className="space-y-3">
                        {/* Recommended */}
                        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">Recommended: <span className="font-mono">{houseDisplay(topHouse)}</span>{isRoomMode && topHouse.available_rooms?.length ? ` \u2014 Room ${topHouse.available_rooms[0]}` : ""}</p>
                                <p className="text-[10px] text-muted-foreground">{topHouse.location || "\u2014"} \u00b7 Type {topHouse.house_type} \u00b7 {topHouse.room_vacant_count ?? 0} rooms vacant</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-black tabular-nums text-primary">{topMatch.toFixed(0)}%</span>
                              <Button size="sm" className="h-8 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                                onClick={() => { setSelectedHouse(topHouse); setConfirmOpen(true); }} disabled={allocating}>
                                {allocating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                                Allocate
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2.5 grid gap-1.5 border-t border-border/50 pt-2.5 sm:grid-cols-2">
                            {matchReasons.map((r) => (
                              <div key={r.text} className="flex items-start gap-1.5 text-[11px]">
                                {r.ok ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
                                <span className={r.ok ? "text-foreground/80" : "text-muted-foreground"}>{r.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* All houses mini-table */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{sortedHouses.length} houses available</span>
                          <Button variant="outline" size="sm" className="h-7 rounded-md px-2.5 text-[10px] font-semibold"
                            onClick={() => void handleBatchAllocate()} disabled={batchAllocating}>
                            {batchAllocating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />} Batch
                          </Button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="border-b border-border/60 bg-muted/40">
                                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground">House No.</th>
                                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                                <th className="px-2.5 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Rooms</th>
                                <th className="px-2.5 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Condition</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Match</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedHouses.map((house, idx) => {
                                const match = scoringHouses.get(house.id) || 0;
                                const dmg = damageList(house);
                                const isTop = idx === 0;
                                return (
                                  <tr key={house.id} className={cn("border-b border-border/30 last:border-0 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors",
                                    selectedHouse?.id === house.id && "bg-amber-50/80 dark:bg-amber-950/30")}>
                                    <td className="px-2.5 py-2">
                                      <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold",
                                        isTop ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" : "bg-muted/40 text-muted-foreground")}>
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-2 font-mono font-bold text-foreground">
                                      {houseDisplay(house)}
                                      {isTop && <span className="ml-1.5 inline-flex items-center text-[8px] text-amber-600 font-bold"><Star className="h-2 w-2 fill-amber-400 mr-0.5" />Best</span>}
                                    </td>
                                    <td className="px-2.5 py-2 text-muted-foreground">{house.house_type}</td>
                                    <td className="px-2.5 py-2 text-muted-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{house.location || "\u2014"}</td>
                                    <td className="px-2.5 py-2 text-center"><span className="font-bold">{house.room_vacant_count ?? 0}</span><span className="text-muted-foreground">/{house.room_count}</span></td>
                                    <td className="px-2.5 py-2 text-center">
                                      {dmg.length > 0
                                        ? <span className="inline-flex items-center gap-0.5 text-rose-500 text-[10px]"><AlertTriangle className="h-2.5 w-2.5" />{dmg.length}</span>
                                        : <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" />OK</span>}
                                    </td>
                                    <td className={cn("px-2.5 py-2 text-right font-black tabular-nums",
                                      match >= 70 ? "text-emerald-600 dark:text-emerald-400" : match >= 45 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                      {match.toFixed(0)}%
                                    </td>
                                    <td className="px-2.5 py-2 text-right">
                                      <Button size="sm" className="h-6 rounded px-2 text-[9px] font-semibold"
                                        onClick={(e) => { e.stopPropagation(); setSelectedHouse(house); setConfirmOpen(true); }} disabled={allocating}>
                                        Assign
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Batch results */}
                        {batchResult && (
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 mt-2">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Batch: {batchResult.allocated.length} allocated, {batchResult.skipped.length} skipped
                            </p>
                            <ScrollArea className="max-h-40">
                              <div className="space-y-1 pr-2">
                                {batchResult.allocated.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
                                    <span className="min-w-0 truncate text-[11px] font-semibold text-foreground">{r.application_no || "\u2014"}</span>
                                    <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">\u2192 {r.resource ?? r.house_number ?? r.house_id}</span>
                                  </div>
                                ))}
                                {batchResult.skipped.map((r, i) => (
                                  <div key={`s${i}`} className="flex items-center justify-between gap-2 rounded border border-border/30 bg-background/40 px-2.5 py-1.5">
                                    <span className="min-w-0 truncate text-[11px] font-semibold text-muted-foreground">{r.application_no || r.house_id || "\u2014"}</span>
                                    <span className="shrink-0 text-[10px] text-muted-foreground/60">{r.skip_reason || "skipped"}</span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    ) : canAllocate ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <Building2 className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-xs font-bold text-foreground">No Vacant Houses</p>
                        <p className="text-[11px] text-muted-foreground max-w-[240px]">No houses of type <strong>{detail.eligible_house_category || "\u2014"}</strong> available.</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Housing options unlock once <strong>Verified</strong> and queued.</p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 8: ACTIVITY TIMELINE ─── */}
            <TableSection theme={THEMES.activity} title="Activity Timeline" subtitle="Application lifecycle events and allocation logs" icon={<History className="h-3 w-3" />} cols={6}>
              <tr className="border-b border-border/40">
                <td className="p-0" colSpan={6}>
                  <div className="px-4 py-4">
                    {/* Pipeline events */}
                    <div className="relative">
                      {(() => {
                        const events = [
                          { label: "Submitted", date: detail.submitted_at,
                            done: ["Submitted","Under Review","Verified","Waiting for Allocation","Allocated","Returned","Rejected"].includes(detail.status),
                            icon: <Send className="h-3 w-3" />, color: "text-sky-500", bg: "bg-sky-500/10" },
                          { label: "Under Review", date: detail.submitted_at,
                            done: ["Under Review","Verified","Waiting for Allocation","Allocated"].includes(detail.status),
                            icon: <SearchCheck className="h-3 w-3" />, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                          { label: "Verified", date: detail.reviewed_at,
                            done: ["Verified","Waiting for Allocation","Allocated"].includes(detail.status),
                            icon: <ShieldCheck className="h-3 w-3" />, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                          { label: "In Queue", date: detail.reviewed_at,
                            done: ["Waiting for Allocation","Allocated"].includes(detail.status),
                            icon: <Clock3 className="h-3 w-3" />, color: "text-amber-500", bg: "bg-amber-500/10" },
                          { label: detail.status === "Rejected" ? "Rejected" : detail.status === "Returned" ? "Returned" : "Allocated",
                            date: detail.allocated_at || (["Rejected","Returned"].includes(detail.status) ? detail.reviewed_at : null),
                            done: ["Allocated","Rejected","Returned"].includes(detail.status),
                            icon: detail.status === "Rejected" ? <XCircle className="h-3 w-3" /> : detail.status === "Returned" ? <RefreshCw className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />,
                            color: detail.status === "Allocated" ? "text-primary" : "text-rose-500",
                            bg: detail.status === "Allocated" ? "bg-primary/10" : "bg-rose-500/10" },
                        ];
                        return events.map((ev, i) => (
                          <div key={i} className="relative flex gap-3">
                            {i < events.length - 1 && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/50" />}
                            <div className={cn("relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all",
                              ev.bg, ev.color, ev.done ? "opacity-100" : "opacity-30 border-border/30")}>
                              {ev.icon}
                            </div>
                            <div className={cn("pb-3 min-w-0 flex-1 pt-0.5", !ev.done && "opacity-35")}>
                              <p className="text-[11px] font-semibold text-foreground">{ev.label}</p>
                              {ev.date && ev.done && <p className="mt-0.5 text-[10px] text-muted-foreground">{fmt(ev.date)} \u00b7 {fmtTime(ev.date)}</p>}
                            </div>
                            {ev.done && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500 mt-1" />}
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Allocation logs */}
                    {allocationLogs.length > 0 && (
                      <div className="mt-3 border-t border-border/40 pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Allocation Logs ({allocationLogs.length})
                        </p>
                        <ScrollArea className="max-h-48">
                          <div className="space-y-1 pr-2">
                            {allocationLogs.slice().reverse().map((log) => (
                              <div key={log.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/20">
                                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", LOG_DOT[log.action] || "bg-muted-foreground")} />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-foreground">{log.action.replace(/_/g, " ")}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {fmt(log.created_at)} \u00b7 {fmtTime(log.created_at)}
                                    {log.performed_by_name && <> \u00b7 {log.performed_by_name}</>}
                                    {log.house_id && <> \u00b7 <span className="font-mono">{log.house_id}{log.room_label ? ` \u2014 Room ${log.room_label}` : ""}</span></>}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </TableSection>

            {/* ─── SECTION 9: ACTIONS ─── */}
            <TableSection theme={{ headerBg: "bg-foreground/90 dark:bg-foreground/10", headerText: "text-background dark:text-foreground", headerBorder: "border-foreground/20", rowAlt: "", accent: "" }} title="Actions" subtitle="Available operations for this application" icon={<Activity className="h-3 w-3" />} cols={6}>
              <tr>
                <td className="p-0" colSpan={6}>
                  <div className="p-4">
                    {(detail.status === "Submitted" || detail.status === "Under Review") && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
                          <p className="text-xs font-bold text-foreground">{detail.status === "Submitted" ? "Ready for Review" : "Under Review"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Check details before approving.</p>
                        </div>
                        <Button className="h-9 rounded-lg bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 text-xs"
                          onClick={() => void setStatus("Verified")} disabled={submitting}>
                          {submitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />}
                          Verify & Approve
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button className="h-9 rounded-lg border border-amber-500/30 bg-amber-500/8 font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 text-[11px]"
                            onClick={() => { setReasonStatus("Returned"); setReasonOpen(true); }} disabled={submitting}>
                            <RefreshCw className="mr-1 h-3 w-3" /> Return
                          </Button>
                          <Button className="h-9 rounded-lg border border-rose-500/30 bg-rose-500/8 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 text-[11px]"
                            onClick={() => { setReasonStatus("Rejected"); setReasonOpen(true); }} disabled={submitting}>
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                    {detail.status === "Returned" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                          <p className="text-xs font-bold text-orange-700 dark:text-orange-300">Returned for Correction</p>
                          {detail.returned_reason && <p className="mt-1 text-[11px] italic text-muted-foreground">"{detail.returned_reason}"</p>}
                        </div>
                        <Button className="h-9 rounded-lg border border-sky-500/30 bg-sky-500/8 font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 text-xs"
                          onClick={() => void setStatus("Submitted")} disabled={submitting}>
                          <Send className="mr-2 h-3.5 w-3.5" /> Re-Submit to Queue
                        </Button>
                      </div>
                    )}
                    {detail.status === "Verified" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Verified \u2014 Ready to Queue</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Move to allocation queue.</p>
                        </div>
                        <Button className="h-9 rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 text-xs"
                          onClick={() => void setStatus("Waiting for Allocation")} disabled={submitting}>
                          {submitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Target className="mr-2 h-3.5 w-3.5" />}
                          Move to Allocation Queue
                        </Button>
                      </div>
                    )}
                    {detail.status === "Waiting for Allocation" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">In Allocation Queue</p>
                          {detail.queue_position && <p className="mt-1 text-[11px] text-muted-foreground">Position <span className="font-bold text-primary">#{detail.queue_position}</span></p>}
                        </div>
                        <Button className="h-9 rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 text-xs"
                          onClick={() => { setSelectedHouse(topHouse); setConfirmOpen(true); }} disabled={!topHouse || allocating}>
                          {allocating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Target className="mr-2 h-3.5 w-3.5" />}
                          Allocate Best Match
                        </Button>
                      </div>
                    )}
                    {detail.status === "Rejected" && (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 inline-flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-rose-500" />
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Application Rejected</span>
                        {detail.rejection_reason && <span className="text-[11px] italic text-muted-foreground ml-2">"{detail.rejection_reason}"</span>}
                      </div>
                    )}
                    {detail.status === "Allocated" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <div>
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Allocation Complete</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                              {detail.allocated_house_id}{detail.allocated_room_label ? ` \u2014 Room ${detail.allocated_room_label}` : ""}
                            </p>
                          </div>
                        </div>
                        <Button className="h-9 rounded-lg border border-sky-500/30 bg-sky-500/8 font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 text-xs"
                          onClick={() => setInvoiceOpen(true)}>
                          <Printer className="mr-2 h-3.5 w-3.5" /> Print Invoice
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </TableSection>

          </table>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Confirm Allocation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Allocation</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Assign <strong className="text-foreground">House {selectedHouse ? houseDisplay(selectedHouse) : "\u2026"}</strong>
              {isRoomMode && selectedHouse?.available_rooms?.length ? <> \u00b7 <strong className="text-foreground">Room {selectedHouse.available_rooms[0]}</strong></> : ""}{" "}
              to <strong className="text-foreground">{detail.employee_name || detail.requester_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {selectedHouse && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Priority Score</span>
                  <span className="text-xl font-black text-foreground">{detail.priority_score?.toFixed(1)}</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-primary/20 bg-primary/8 p-3 text-center">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Match Score</span>
                  <span className="text-xl font-black text-primary">{(scoringHouses.get(selectedHouse.id) ?? 0).toFixed(1)}%</span>
                </div>
              </div>
              {hasDamages(selectedHouse) && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/8 p-3">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">Requires maintenance: {damageList(selectedHouse).join(", ")}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={allocating} className="h-9 rounded-lg px-4 text-xs font-semibold">Cancel</Button>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setInvoiceOpen(true); }} disabled={allocating}
              className="h-9 rounded-lg border-sky-500/30 bg-sky-500/8 px-4 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15">
              <Printer className="mr-1.5 h-3 w-3" /> Invoice
            </Button>
            <Button onClick={() => { if (selectedHouse) { void handleAutoAllocate(selectedHouse.id); setConfirmOpen(false); } }} disabled={allocating}
              className="h-9 rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              {allocating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3 w-3" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason Dialog */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{reasonStatus === "Returned" ? "Return Application" : "Reject Application"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {reasonStatus === "Returned" ? "Provide a reason so the applicant knows what to correct." : "Provide a clear reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="font-semibold text-sm">{reasonStatus === "Returned" ? "Return Reason" : "Rejection Reason"}</Label>
            <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={4} placeholder="Enter reason..."
              className="resize-none rounded-lg border-border/60 bg-muted/20 text-sm placeholder:text-muted-foreground" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting} className="h-9 rounded-lg px-4 text-xs font-semibold">Cancel</Button>
            <Button onClick={() => {
              if (!reasonStatus) return;
              if (!reasonText.trim()) { toast.error("A reason is required"); return; }
              void setStatus(reasonStatus, reasonText.trim());
            }} disabled={submitting} className={cn("h-9 rounded-lg px-5 text-xs font-semibold shadow-sm",
              reasonStatus === "Rejected" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white")}>
              {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {reasonStatus === "Returned" ? "Return" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">House Allocation Invoice</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Official housing allocation document for {detail.employee_name || detail.requester_name}
            </DialogDescription>
          </DialogHeader>
          <div id="invoice-content" className="space-y-5 py-4">
            <div className="border-2 border-foreground/20 rounded-lg p-5 bg-background/50">
              <div className="grid grid-cols-3 gap-4 items-start">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full border-2 border-foreground/30 flex items-center justify-center bg-muted/30">
                    <Building2 className="h-7 w-7 text-foreground/60" />
                  </div>
                  <div className="text-xs"><p className="font-semibold text-foreground/70">Metahara Sugar Factory</p></div>
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-foreground">METEHARA SUGAR FACTORY</h2>
                  <p className="text-sm text-foreground/60 mt-1">Housing Allocation Record</p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <p className="text-foreground/70">Date: <span className="font-mono">{fmt(new Date().toISOString())}</span></p>
                  <p className="text-foreground/70">No: <span className="font-mono">{detail.application_no}</span></p>
                </div>
              </div>
            </div>
            <div className="border border-foreground/20 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 border-b border-foreground/20">
                <h3 className="font-bold text-sm">Employee Information</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {[["Full Name", detail.employee_name || detail.requester_name], ["Employee ID", detail.employee_id],
                  ["National ID", detail.national_id], ["Job Position", detail.job_position],
                  ["Job Grade", detail.job_grade], ["Service Years", String(detail.years_of_service ?? 0)],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-dashed border-foreground/10 pb-1">
                    <span className="text-foreground/70">{l}:</span>
                    <span className="font-semibold">{v || "\u2014"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-foreground/20 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 border-b border-foreground/20">
                <h3 className="font-bold text-sm">Allocated House Details</h3>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-foreground/60 mb-1">House Number</p><div className="border-b-2 border-foreground/30 pb-1"><p className="font-mono text-lg font-black">{selectedHouse ? houseDisplay(selectedHouse) : detail.allocated_house || "\u2014"}</p></div></div>
                <div><p className="text-xs text-foreground/60 mb-1">House Type</p><div className="border-b-2 border-foreground/30 pb-1"><p className="text-lg font-black">{selectedHouse ? selectedHouse.house_type : (detail.eligible_house_category || "\u2014")}</p></div></div>
                <div><p className="text-xs text-foreground/60 mb-1">Location</p><div className="border-b-2 border-foreground/30 pb-1"><p className="font-semibold">{selectedHouse ? selectedHouse.location : (detail.preferred_location || "\u2014")}</p></div></div>
              </div>
            </div>
            <div className="border border-foreground/20 rounded-lg p-4 bg-muted/10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2"><p className="text-xs font-semibold text-foreground/70">Prepared by</p>
                  {[1,2,3].map(n=><div key={n} className="flex items-center gap-2"><span className="text-xs text-foreground/50">{n}.</span><div className="flex-1 border-b border-dashed border-foreground/20 min-h-[1.2rem]" /></div>)}
                </div>
                <div className="space-y-2"><p className="text-xs font-semibold text-foreground/70">Approved by</p>
                  {[1,2,3].map(n=><div key={n} className="flex items-center gap-2"><span className="text-xs text-foreground/50">{n}.</span><div className="flex-1 border-b border-dashed border-foreground/20 min-h-[1.2rem]" /></div>)}
                </div>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="grid grid-cols-3 gap-4 text-xs text-foreground/50">
                <div><p className="font-semibold">Priority Score</p><p className="font-mono text-foreground">{detail.priority_score?.toFixed(2) || "\u2014"}</p></div>
                <div><p className="font-semibold">Queue Position</p><p className="font-mono text-foreground">#{detail.queue_position || "\u2014"}</p></div>
                <div><p className="font-semibold">Allocation Date</p><p className="font-mono text-foreground">{fmt(new Date().toISOString())}</p></div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInvoiceOpen(false)} className="h-9 rounded-lg px-4 text-xs font-semibold">Close</Button>
            <Button onClick={() => {
              const el = document.getElementById("invoice-content");
              if (!el) return;
              const w = window.open("", "_blank");
              if (!w) { toast.error("Allow popups to print"); return; }
              w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice</title>
<style>@media print{@page{margin:1.5cm;}}body{font-family:system-ui;line-height:1.5;color:#000;background:#fff;padding:20px;max-width:900px;margin:0 auto;}table,td,th{border:1px solid #ddd;border-collapse:collapse;padding:8px;}h2,h3{margin:0 0 8px;}.text-center{text-align:center;}.font-bold{font-weight:700;}.font-mono{font-family:monospace;}</style></head><body>
${el.innerHTML}
<div style="margin-top:30px;text-align:center;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:10px;">
<p>MSF Housing Allocation System \u2014 ${new Date().toLocaleString()}</p></div></body></html>`);
              w.document.close(); setTimeout(() => w.print(), 250);
            }} className="h-9 rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              <Printer className="mr-2 h-3.5 w-3.5" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
