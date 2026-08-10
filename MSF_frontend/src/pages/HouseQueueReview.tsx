import {
  useCallback, useEffect, useId, useMemo, useState, type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";
import {
  getApplication, updateApplicationStatus, autoAllocateHouse,
  deallocateHouse, listAllocationLogs, recalculateApplicationScore,
  batchAllocateAll,
  type BatchAllocateResult, type ApplicationStatus,
  type HouseApplication, type AllocationLog,
  type ScoreBreakdown, type CriterionContribution,
} from "@/services/houseApplication";
import { listHouses, type House } from "@/services/houses";
import {
  Activity, AlertTriangle, ArrowLeft, Award, BadgeCheck, Building2,
  CalendarDays, CheckCircle2, Clock3, Cpu, Database,
  Eye, FileCheck, FileText, Fingerprint, Hash, History,
  KeyRound, Loader2, MapPin, Medal, Printer, RefreshCw, Scale,
  SearchCheck, Send, ShieldCheck, Sparkles, Target, Trash2, TrendingUp,
  Users, XCircle, Zap, Star, UserRound,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmt(v?: string | null) {
  if (!v) return "—";
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
function houseRef(h: { house_id?: string; house_number?: string; id: string }) {
  return h.house_id || h.house_number || h.id;
}
function hasDamages(h: House) {
  return !!(h.damaged_door || h.damaged_windows || h.damaged_walls || h.damaged_switch || h.damaged_bulb || h.damaged_water);
}

// ─── Status config ────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  Draft:                   { label: "Draft",     cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",             dot: "bg-slate-400" },
  Submitted:               { label: "Submitted", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",                     dot: "bg-sky-400" },
  "Under Review":          { label: "Under Review", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",     dot: "bg-indigo-400" },
  Verified:                { label: "Verified",  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",    dot: "bg-emerald-400" },
  "Waiting for Allocation":{ label: "In Queue",  cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",            dot: "bg-amber-400" },
  Allocated:               { label: "Allocated", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",    dot: "bg-emerald-500" },
  Rejected:                { label: "Rejected",  cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",                dot: "bg-rose-400" },
  Returned:                { label: "Returned",  cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",        dot: "bg-orange-400" },
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

// ─── Score helpers ────────────────────────────────────────────────────────
type BreakdownRow = {
  key: string;
  label: string;
  raw: string;
  weight: number;
  normalised: number;
  contribution: number;
  color: string;
};

const CRITERIA_META: Record<string, { label: string; color: string }> = {
  job_grade:        { label: "Job Grade",        color: "#3b82f6" },
  years_of_service: { label: "Years of Service", color: "#8b5cf6" },
  family_size:      { label: "Family Size",      color: "#10b981" },
  disability:       { label: "Disability",       color: "#f59e0b" },
  fifo:             { label: "Waiting Time (FIFO)", color: "#f43f5e" },
  marital_status:   { label: "Marital Status",   color: "#06b6d4" },
  employment_type:  { label: "Employment Type",  color: "#a855f7" },
  medical_priority: { label: "Medical Priority", color: "#ec4899" },
};

function formatRaw(raw: unknown): string {
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (raw === null || raw === undefined || raw === "") return "—";
  return String(raw);
}

function parseBreakdownRows(bd: ScoreBreakdown | null | undefined): BreakdownRow[] {
  if (!bd) return [];
  return (Object.keys(CRITERIA_META) as (keyof typeof CRITERIA_META)[])
    .map((key) => {
      const c = bd[key] as CriterionContribution | undefined;
      const meta = CRITERIA_META[key];
      if (!c || typeof c !== "object" || c.normalised === undefined) return null;
      return {
        key,
        label: meta.label,
        raw: formatRaw(c.raw),
        weight: Number(c.weight) || 0,
        normalised: Number(c.normalised) || 0,
        contribution: Number(c.contribution) || 0,
        color: meta.color,
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

// ─── Card primitives ──────────────────────────────────────────────────────
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, right }: {
  icon: ReactNode; title: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="flex-1 text-sm font-bold text-foreground">{title}</h3>
      {right}
    </div>
  );
}

function StatusChip({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.Draft;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────
function ScoreRing({ score, size = 116 }: { score: number; size?: number }) {
  const uid = useId();
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const c = Math.min(Math.max(Number(score) || 0, 0), 100);
  const offset = circ - (c / 100) * circ;
  const color = c >= 70 ? "#10b981" : c >= 45 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeOpacity="0.5" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${uid}-g)`}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={Math.round(c)} duration={1000} className="text-3xl font-black tabular-nums leading-none text-foreground" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-0.5">score</span>
      </div>
    </div>
  );
}

// ─── Stat block ───────────────────────────────────────────────────────────
function Stat({ icon, label, value, tone = "text-foreground" }: {
  icon: ReactNode; label: string; value: ReactNode; tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={cn("text-base font-black leading-tight tabular-nums", tone)}>{value}</div>
      </div>
    </div>
  );
}

// ─── Criterion bar ────────────────────────────────────────────────────────
function BreakdownBar({ row }: { row: BreakdownRow }) {
  const pct = Math.min(100, Math.max(0, row.normalised * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="truncate text-xs font-semibold text-foreground">{row.label}</span>
          <span className="hidden shrink-0 truncate text-[10px] text-muted-foreground/70 md:inline">({row.raw})</span>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums">
          +{row.contribution.toFixed(2)}
          <span className="text-muted-foreground/50 font-normal"> / {row.weight}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: pct + "%", backgroundColor: row.color }} />
        </div>
        <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          {Math.round(row.normalised * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── Status stepper ───────────────────────────────────────────────────────
function StatusStepper({ status }: { status: ApplicationStatus }) {
  const idx = PIPELINE.findIndex((p) => p.key === status);
  const isTerminal = status === "Rejected" || status === "Returned";
  const progress = idx >= 0 ? (idx / (PIPELINE.length - 1)) * 100 : 0;
  return (
    <div>
      <div className="relative">
        <div className="absolute left-[8%] right-[8%] top-1/2 h-0.5 -translate-y-1/2 bg-border/60" />
        <div className="absolute left-[8%] top-1/2 h-0.5 -translate-y-1/2 bg-primary/60 transition-all duration-700"
          style={{ width: isTerminal ? "0%" : `${progress * 0.84}%` }} />
        <div className="relative flex items-center justify-between">
          {PIPELINE.map((step, i) => {
            const done    = idx >= 0 && i < idx && !isTerminal;
            const current = idx >= 0 && i === idx && !isTerminal;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-card transition-all",
                  done    && "border-primary/40 bg-primary/10 text-primary",
                  current && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25",
                  !done && !current && "border-border/60 text-muted-foreground/40",
                )}>
                  {step.icon}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  current ? "text-primary" : done ? "text-foreground/60" : "text-muted-foreground/40",
                )}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {isTerminal && (
        <div className={cn(
          "mt-5 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold",
          status === "Rejected" ? "border-rose-500/25 bg-rose-500/8 text-rose-600 dark:text-rose-400"
                                : "border-orange-500/25 bg-orange-500/8 text-orange-600 dark:text-orange-400",
        )}>
          {status === "Rejected" ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0" />}
          {status === "Rejected" ? "Application rejected — no further action is possible." : "Returned for correction — awaiting re-submission."}
        </div>
      )}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">{icon}{label}</span>
      <span className="text-right text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ─── Timeline node ────────────────────────────────────────────────────────
function TimelineNode({ icon, color, bg, label, date, done, last }: {
  icon: ReactNode; color: string; bg: string; label: string;
  date?: string | null; done: boolean; last?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {!last && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />}
      <div className={cn(
        "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
        bg, color,
        done ? "opacity-100" : "opacity-30 border-border/30",
      )}>
        {icon}
      </div>
      <div className={cn("pb-4 min-w-0 flex-1 pt-0.5", !done && "opacity-35")}>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {date && done && <p className="mt-0.5 text-[10px] text-muted-foreground">{fmt(date)} · {fmtTime(date)}</p>}
      </div>
      {done && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500 mt-1.5" />}
    </div>
  );
}

// ─── House option row ─────────────────────────────────────────────────────
function HouseRow({ house, match, rank, selected, onSelect, onAssign, disabled }: {
  house: House; match: number; rank: number; selected: boolean;
  onSelect: () => void; onAssign: () => void; disabled?: boolean;
}) {
  const isBest = rank === 1;
  const damages: string[] = [];
  if (house.damaged_door)    damages.push("Door");
  if (house.damaged_windows) damages.push("Windows");
  if (house.damaged_walls)   damages.push("Walls");
  if (house.damaged_water)   damages.push("Water");
  if (house.damaged_switch || house.damaged_bulb) damages.push("Electrical");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={cn(
        "group flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        selected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.02]",
        isBest && !selected && "border-amber-500/25",
      )}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold",
        isBest ? "border-amber-500/30 bg-amber-500/10 text-amber-600" : "border-border/70 bg-muted/40 text-muted-foreground",
      )}>
        {rank}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-bold text-foreground truncate">{house.house_number || house.house_id}</p>
          {isBest && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[9px] font-bold text-amber-600">
              <Star className="mr-0.5 h-2.5 w-2.5 fill-amber-400 text-amber-400" /> Best match
            </Badge>
          )}
          {selected && (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[9px] font-bold text-primary">
              Selected
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{house.location || "Unknown"}</span>
          <span>Type {house.house_type}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{house.capacity || 1} pax</span>
          {damages.length > 0 ? (
            <span className="flex items-center gap-1 text-rose-500"><AlertTriangle className="h-3 w-3" />{damages.join(", ")}</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />Good condition</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-lg font-black tabular-nums leading-none", match >= 70 ? "text-emerald-600 dark:text-emerald-400" : match >= 45 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {match.toFixed(0)}%
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">match</p>
      </div>

      <Button
        size="sm"
        className="h-9 shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        onClick={(e) => { e.stopPropagation(); onAssign(); }}
        disabled={disabled}
      >
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Assign
      </Button>
    </div>
  );
}

// ─── Not found ────────────────────────────────────────────────────────────
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
    if (!id) return;
    try {
      setAllocating(true);
      const u = await autoAllocateHouse(houseId, id);
      setDetail(u);
      toast.success("House allocated successfully");
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
      toast.success(`Batch complete — ${r.allocated.length} allocated, ${r.skipped.length} skipped`);
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Batch allocation failed"); }
    finally { setBatchAllocating(false); }
  };

  const sortedHouses = useMemo(
    () => [...availableHouses].sort((a, b) => (scoringHouses.get(b.id) ?? 0) - (scoringHouses.get(a.id) ?? 0)),
    [availableHouses, scoringHouses],
  );
  const topHouse = sortedHouses[0];
  const topMatch = topHouse ? (scoringHouses.get(topHouse.id) ?? 0) : 0;

  const primaryAction = useMemo(() => {
    if (!detail) return null;
    switch (detail.status) {
      case "Submitted":
      case "Under Review":
        return { label: "Verify & Approve", icon: ShieldCheck, run: () => void setStatus("Verified"), disabled: submitting };
      case "Verified":
        return { label: "Move to Allocation Queue", icon: Target, run: () => void setStatus("Waiting for Allocation"), disabled: submitting };
      case "Waiting for Allocation":
        return {
          label: "Allocate Best Match",
          icon: Target,
          run: () => { setSelectedHouse(topHouse); setConfirmOpen(true); },
          disabled: !topHouse || allocating,
        };
      default:
        return null;
    }
  }, [detail, topHouse, submitting, allocating, setStatus]);

  const breakdownRows = useMemo(() => parseBreakdownRows(detail?.score_breakdown), [detail]);
  const engineReasons = useMemo(() => detail?.score_breakdown?.recommendation_reasons ?? [], [detail]);
  const topsisCloseness = detail?.score_breakdown?.topsis_closeness ?? null;

  const timelineEvents = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "Submitted", date: detail.submitted_at,
        done: ["Submitted","Under Review","Verified","Waiting for Allocation","Allocated","Returned","Rejected"].includes(detail.status),
        icon: <Send className="h-3.5 w-3.5" />, color: "text-sky-500", bg: "bg-sky-500/10" },
      { label: "Under Review", date: detail.submitted_at,
        done: ["Under Review","Verified","Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <SearchCheck className="h-3.5 w-3.5" />, color: "text-indigo-500", bg: "bg-indigo-500/10" },
      { label: "Verified", date: detail.reviewed_at,
        done: ["Verified","Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <ShieldCheck className="h-3.5 w-3.5" />, color: "text-emerald-500", bg: "bg-emerald-500/10" },
      { label: "In Queue", date: detail.reviewed_at,
        done: ["Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <Clock3 className="h-3.5 w-3.5" />, color: "text-amber-500", bg: "bg-amber-500/10" },
      { label: detail.status === "Rejected" ? "Rejected" : detail.status === "Returned" ? "Returned" : "Allocated",
        date: detail.allocated_at || (["Rejected","Returned"].includes(detail.status) ? detail.reviewed_at : null),
        done: ["Allocated","Rejected","Returned"].includes(detail.status),
        icon: detail.status === "Rejected" ? <XCircle className="h-3.5 w-3.5" />
            : detail.status === "Returned" ? <RefreshCw className="h-3.5 w-3.5" />
            : <KeyRound className="h-3.5 w-3.5" />,
        color: detail.status === "Allocated" ? "text-primary" : "text-rose-500",
        bg:    detail.status === "Allocated" ? "bg-primary/10" : "bg-rose-500/10" },
    ];
  }, [detail]);

  if (loading) return <PageSkeleton />;
  if (!detail)  return <NotFoundState onBack={() => navigate("/house-opp/queue")} />;

  const wd = daysSince(detail.submitted_at);
  const initials = (detail.employee_name || detail.requester_name || "?")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const canAllocate = detail.status === "Waiting for Allocation" || detail.status === "Verified";
  const scoreTotal = Number(detail.priority_score) || 0;
  const matchReasons = topHouse ? [
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">

        {/* ═══ HEADER ═══ */}
        <header className="mb-6">
          <div className="mb-4">
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
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Hash className="h-3 w-3" />{detail.application_no || detail.id}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Fingerprint className="h-3 w-3" />{detail.employee_id || "—"}
                </span>
                {detail.eligible_house_category && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                    <Award className="h-3 w-3" /> Eligible: Type {detail.eligible_house_category}
                  </span>
                )}
                {detail.has_disability && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Disability flagged
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
              <Button variant="outline" size="sm" className="h-10 rounded-lg px-4 text-xs font-semibold"
                onClick={() => navigate("/house-opp/queue")}>
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Queue
              </Button>
              <Button variant="outline" size="sm" className="h-10 rounded-lg px-4 text-xs font-semibold"
                onClick={() => void handleRecalculate()} disabled={calculating}>
                {calculating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-2 h-3.5 w-3.5" />}
                Recalculate Score
              </Button>
              {primaryAction && (
                <Button size="sm" className="h-10 rounded-lg px-5 text-xs font-semibold shadow-sm"
                  onClick={primaryAction.run} disabled={primaryAction.disabled}>
                  {submitting || allocating
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <primaryAction.icon className="mr-2 h-3.5 w-3.5" />}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* ═══ ALLOCATED BANNER ═══ */}
        {detail.status === "Allocated" && detail.allocated_house_id && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Allocated to House <span className="font-mono text-emerald-600 dark:text-emerald-400">{detail.allocated_house_id}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(detail.allocated_at)} · {fmtTime(detail.allocated_at)}
                  {detail.allocated_by_name && <> · by <strong>{detail.allocated_by_name}</strong></>}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void handleDeallocate()} disabled={deallocating}
              className="h-9 shrink-0 rounded-lg border-rose-500/30 bg-rose-500/8 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15">
              {deallocating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Reverse Allocation
            </Button>
          </div>
        )}

        {/* ═══ WORKFLOW STEFFER ═══ */}
        <Card className="mb-6 px-5 py-6 md:px-8">
          <StatusStepper status={detail.status} />
        </Card>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid gap-5 lg:grid-cols-12">

          {/* ── MAIN WORKSPACE ── */}
          <main className="space-y-5 lg:col-span-8">

            {/* Priority score + XAI */}
            <Card>
              <CardHeader
                icon={<Scale className="h-4 w-4" />}
                title="Priority Score"
                right={
                  <Badge variant="outline" className="border-border/60 bg-background/60 text-xs font-bold text-foreground">
                    <CountUp value={scoreTotal} duration={800} decimals={2} /> / 100
                  </Badge>
                }
              />
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-6">
                  <ScoreRing score={scoreTotal} />
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                    <Stat icon={<Medal className="h-4 w-4" />} label="Queue Rank"
                      value={detail.queue_position ? <CountUp value={detail.queue_position} duration={800} /> : "—"}
                      tone="text-amber-600 dark:text-amber-400" />
                    <Stat icon={<Clock3 className="h-4 w-4" />} label="Days Waiting"
                      value={<CountUp value={wd} duration={800} />}
                      tone="text-sky-600 dark:text-sky-400" />
                    <Stat icon={<Activity className="h-4 w-4" />} label="TOPSIS Confidence"
                      value={topsisCloseness != null ? `${Math.round(topsisCloseness * 100)}%` : "—"}
                      tone="text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>

                <Separator className="my-5 bg-border/60" />

                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Score breakdown — weighted criteria
                </p>

                {breakdownRows.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {breakdownRows.map((row) => <BreakdownBar key={row.key} row={row} />)}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 py-5 text-center text-xs text-muted-foreground">
                    No score computed yet — run <strong>Recalculate Score</strong>.
                  </div>
                )}

                {(engineReasons.length > 0 || topsisCloseness != null) && (
                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <Cpu className="h-3 w-3" /> Engine recommendation
                    </p>
                    <ul className="space-y-1">
                      {engineReasons.map((r) => (
                        <li key={r} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/80">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            {/* Housing options */}
            <Card>
              <CardHeader
                icon={<Building2 className="h-4 w-4" />}
                title="Housing Options"
                right={
                  sortedHouses.length > 0 ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      {sortedHouses.length} available · type {detail.eligible_house_category}
                    </span>
                  ) : null
                }
              />
              <div className="p-5">
                {detail.status === "Allocated" ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <p className="text-xs text-muted-foreground">
                      This application has been allocated. Use <strong>Reverse Allocation</strong> above to make the house available again.
                    </p>
                  </div>
                ) : canAllocate && topHouse ? (
                  <div className="space-y-5">
                    {/* Recommended panel */}
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Recommended house</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {topHouse.house_number || topHouse.house_id} · {topHouse.location || "Unknown"} · Type {topHouse.house_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-black tabular-nums leading-none text-primary">{topMatch.toFixed(0)}%</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">match</p>
                          </div>
                          <Button
                            className="h-9 rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                            onClick={() => { setSelectedHouse(topHouse); setConfirmOpen(true); }}
                            disabled={allocating}
                          >
                            {allocating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                            Allocate
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 border-t border-border/50 pt-4 sm:grid-cols-2">
                        {matchReasons.map((r) => (
                          <div key={r.text} className="flex items-start gap-2 text-xs">
                            {r.ok
                              ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                            <span className={r.ok ? "text-foreground/80" : "text-muted-foreground"}>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* All options */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        All available houses · ranked by match
                      </p>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs font-semibold"
                        onClick={() => void handleBatchAllocate()} disabled={batchAllocating}>
                        {batchAllocating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
                        Batch Run
                      </Button>
                    </div>
                    <div className="space-y-2.5">
                      {sortedHouses.map((house, idx) => (
                        <HouseRow
                          key={house.id}
                          house={house}
                          match={scoringHouses.get(house.id) || 0}
                          rank={idx + 1}
                          selected={selectedHouse?.id === house.id}
                          onSelect={() => setSelectedHouse(house)}
                          onAssign={() => { setSelectedHouse(house); setConfirmOpen(true); }}
                          disabled={allocating && selectedHouse?.id === house.id}
                        />
                      ))}
                    </div>

                    {/* Batch results */}
                    {batchResult && (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Batch results · {batchResult.allocated.length} allocated · {batchResult.skipped.length} skipped
                        </p>
                        <ScrollArea className="max-h-56">
                          <div className="space-y-2 pr-2">
                            {batchResult.allocated.map((r, i) => (
                              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                                <p className="min-w-0 truncate text-xs font-semibold text-foreground">{r.application_no || "—"}</p>
                                <p className="shrink-0 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">→ {r.house_number || r.house_id}</p>
                              </div>
                            ))}
                            {batchResult.skipped.map((r, i) => (
                              <div key={`s${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                                <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">{r.application_no || r.house_id || "—"}</p>
                                <p className="shrink-0 text-[11px] text-muted-foreground/60">{r.skip_reason || "skipped"}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : canAllocate ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
                      <Building2 className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">No Vacant Houses</p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
                        No available houses of type <strong>{detail.eligible_house_category || "—"}</strong> at this time.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Housing options unlock once this application is <strong>Verified</strong> and moved to the allocation queue.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </main>

          {/* ── SIDEBAR ── */}
          <aside className="space-y-5 lg:col-span-4">

            {/* Applicant */}
            <Card>
              <div className="flex items-center gap-4 border-b border-border/60 p-5">
                <Avatar className="h-12 w-12 border border-border/60 ring-1 ring-primary/15">
                  <AvatarFallback className="bg-primary/10 text-sm font-black text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-foreground">{detail.employee_name || detail.requester_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.job_position || "—"} {detail.employee_id ? `· ${detail.employee_id}` : ""}
                  </p>
                </div>
                <StatusChip status={detail.status} />
              </div>
              <div className="grid grid-cols-3 gap-px bg-border/50">
                {[
                  { label: "Gender",   value: detail.gender || "—" },
                  { label: "Marital",  value: detail.marital_status || "—" },
                  { label: "Grade",    value: detail.job_grade || "—" },
                  { label: "Job type", value: detail.job_type || "—" },
                  { label: "Service",  value: `${detail.years_of_service ?? 0}y` },
                  { label: "Family",   value: `${detail.family_size || 1} ppl` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card px-2.5 py-2.5 text-center">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-foreground" title={String(value)}>{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader icon={<Activity className="h-4 w-4" />} title="Actions" />
              <div className="space-y-3 p-5">

                {(detail.status === "Submitted" || detail.status === "Under Review") && (
                  <>
                    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
                      <p className="text-sm font-bold text-foreground">
                        {detail.status === "Submitted" ? "Ready for Review" : "Currently Under Review"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Check applicant details and supporting document before approving.
                      </p>
                    </div>
                    <Button className="h-10 w-full rounded-lg bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
                      onClick={() => void setStatus("Verified")} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Verify & Approve
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="h-9 rounded-lg border border-amber-500/30 bg-amber-500/8 font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 text-xs"
                        onClick={() => { setReasonStatus("Returned"); setReasonOpen(true); }} disabled={submitting}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Return
                      </Button>
                      <Button className="h-9 rounded-lg border border-rose-500/30 bg-rose-500/8 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 text-xs"
                        onClick={() => { setReasonStatus("Rejected"); setReasonOpen(true); }} disabled={submitting}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </>
                )}

                {detail.status === "Returned" && (
                  <>
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                      <p className="text-sm font-bold text-orange-700 dark:text-orange-300">Returned for Correction</p>
                      {detail.returned_reason && <p className="mt-1 text-xs italic text-muted-foreground">"{detail.returned_reason}"</p>}
                    </div>
                    <Button className="h-10 w-full rounded-lg border border-sky-500/30 bg-sky-500/8 font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 text-sm"
                      onClick={() => void setStatus("Submitted")} disabled={submitting}>
                      <Send className="mr-2 h-4 w-4" /> Re-Submit to Queue
                    </Button>
                  </>
                )}

                {detail.status === "Verified" && (
                  <>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Verified — Ready to Queue</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Move to the allocation queue, then assign a house from the options panel.
                      </p>
                    </div>
                    <Button className="h-10 w-full rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                      onClick={() => void setStatus("Waiting for Allocation")} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                      Move to Allocation Queue
                    </Button>
                  </>
                )}

                {detail.status === "Waiting for Allocation" && (
                  <>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">In Allocation Queue</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Select a house from the options panel and assign, or run auto-allocation.
                      </p>
                    </div>
                    {detail.queue_position && (
                      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <span className="text-xs font-medium text-muted-foreground">Queue position</span>
                        <span className="font-mono text-lg font-black text-primary">#{detail.queue_position}</span>
                      </div>
                    )}
                    <Button className="h-10 w-full rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                      onClick={() => { setSelectedHouse(topHouse); setConfirmOpen(true); }}
                      disabled={!topHouse || allocating}>
                      {allocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                      Allocate Best Match
                    </Button>
                  </>
                )}

                {detail.status === "Rejected" && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                      <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Application Rejected</p>
                    </div>
                    {detail.rejection_reason && <p className="mt-1 text-xs italic text-muted-foreground">"{detail.rejection_reason}"</p>}
                  </div>
                )}

                {detail.status === "Allocated" && (
                  <>
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Allocation Complete</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          House <strong className="font-mono">{detail.allocated_house_id}</strong> assigned.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="h-10 w-full rounded-lg border border-sky-500/30 bg-sky-500/8 font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 text-sm"
                      onClick={() => setInvoiceOpen(true)}>
                      <Printer className="mr-2 h-4 w-4" /> Print Invoice
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Application details */}
            <Card>
              <CardHeader icon={<FileText className="h-4 w-4" />} title="Application Details" />
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-center">
                    <p className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <BadgeCheck className="h-3 w-3 text-violet-500" /> Eligible
                    </p>
                    <p className="mt-1 text-xl font-black text-violet-600 dark:text-violet-400">{detail.eligible_house_category || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-center">
                    <p className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Award className="h-3 w-3" /> Requested
                    </p>
                    <p className="mt-1 text-xl font-black text-foreground">{detail.requested_house_category || "—"}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                    <MapPin className="h-3 w-3" /> Preferred Location
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{detail.preferred_location || "Any"}</p>
                </div>

                <div className="mt-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason for request</p>
                  <blockquote className="mt-1 text-xs italic leading-relaxed text-foreground/75">
                    {detail.reason_for_request ? `"${detail.reason_for_request}"` : "No notes provided."}
                  </blockquote>
                </div>

                {detail.supporting_document ? (
                  <Button variant="outline" className="mt-3 h-9 w-full rounded-lg text-xs font-semibold" asChild>
                    <a href={detail.supporting_document} target="_blank" rel="noreferrer">
                      <Eye className="mr-2 h-3.5 w-3.5 text-emerald-500" /> View Supporting Document
                    </a>
                  </Button>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-background/30 py-2.5 text-center text-xs text-muted-foreground">
                    No document attached
                  </div>
                )}

                <Separator className="my-4 bg-border/60" />
                <div className="px-1">
                  <InfoRow icon={<FileCheck className="h-3.5 w-3.5 text-sky-500" />} label="App No."
                    value={<span className="font-mono">{detail.application_no || detail.id}</span>} />
                  <InfoRow icon={<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />} label="Submitted"
                    value={fmt(detail.submitted_at)} />
                  {detail.reviewed_at && (
                    <InfoRow icon={<CalendarDays className="h-3.5 w-3.5 text-emerald-500" />} label="Reviewed"
                      value={`${fmt(detail.reviewed_at)}${detail.reviewed_by_name ? ` · ${detail.reviewed_by_name}` : ""}`} />
                  )}
                  {detail.allocated_at && (
                    <InfoRow icon={<KeyRound className="h-3.5 w-3.5 text-primary" />} label="Allocated"
                      value={`${fmt(detail.allocated_at)}${detail.allocated_by_name ? ` · ${detail.allocated_by_name}` : ""}`} />
                  )}
                  <InfoRow icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />} label="Created"
                    value={fmt(detail.created_at)} />
                </div>
              </div>
            </Card>

            {/* Activity */}
            <Card>
              <CardHeader icon={<History className="h-4 w-4" />} title="Activity" />
              <div className="p-5">
                {timelineEvents.map((ev, i) => (
                  <TimelineNode key={i} {...ev} last={i === timelineEvents.length - 1 && allocationLogs.length === 0} />
                ))}
                {allocationLogs.length > 0 && (
                  <>
                    <Separator className="my-3 bg-border/60" />
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Allocation logs ({allocationLogs.length})
                    </p>
                    <ScrollArea className="max-h-44">
                      <div className="space-y-1 pr-2">
                        {allocationLogs.slice().reverse().map((log) => (
                          <div key={log.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20">
                            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", LOG_DOT[log.action] || "bg-muted-foreground")} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-foreground">{log.action.replace(/_/g, " ")}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {fmt(log.created_at)} · {fmtTime(log.created_at)}
                                {log.performed_by_name && <> · {log.performed_by_name}</>}
                                {log.house_id && <> · <span className="font-mono">{log.house_id}</span></>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>

      {/* ── Confirm Allocation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Allocation</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Assign <strong className="text-foreground">House {selectedHouse ? houseRef(selectedHouse) : "…"}</strong> to{" "}
              <strong className="text-foreground">{detail.employee_name || detail.requester_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {selectedHouse && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-4 text-center">
                  <UserRound className="mb-1 h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority Score</span>
                  <span className="text-2xl font-black text-foreground">{detail.priority_score?.toFixed(1)}</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-primary/20 bg-primary/8 p-4 text-center">
                  <Target className="mb-1 h-5 w-5 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Match Score</span>
                  <span className="text-2xl font-black text-primary">{(scoringHouses.get(selectedHouse.id) ?? 0).toFixed(1)}%</span>
                </div>
              </div>
              {hasDamages(selectedHouse) && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                    This house requires maintenance. Ensure the applicant is informed.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={allocating}
              className="h-10 rounded-lg px-5 font-semibold">Cancel</Button>
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); setInvoiceOpen(true); }}
              disabled={allocating}
              className="h-10 rounded-lg border-sky-500/30 bg-sky-500/8 px-5 font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15">
              <Printer className="mr-2 h-4 w-4" /> Invoice
            </Button>
            <Button
              onClick={() => { if (selectedHouse) { void handleAutoAllocate(selectedHouse.id); setConfirmOpen(false); } }}
              disabled={allocating}
              className="h-10 rounded-lg bg-primary px-6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              {allocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reason Dialog ── */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {reasonStatus === "Returned" ? "Return Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {reasonStatus === "Returned"
                ? "Provide a reason so the applicant knows what to correct."
                : "Provide a clear reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="font-semibold text-sm">
              {reasonStatus === "Returned" ? "Return Reason" : "Rejection Reason"}
            </Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
              placeholder="Enter reason..."
              className="resize-none rounded-lg border-border/60 bg-muted/20 text-sm placeholder:text-muted-foreground"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting}
              className="h-10 rounded-lg px-5 font-semibold">Cancel</Button>
            <Button
              onClick={() => {
                if (!reasonStatus) return;
                if (!reasonText.trim()) { toast.error("A reason is required"); return; }
                void setStatus(reasonStatus, reasonText.trim());
              }}
              disabled={submitting}
              className={cn(
                "h-10 rounded-lg px-6 font-semibold shadow-sm",
                reasonStatus === "Rejected" ? "bg-rose-600 hover:bg-rose-700 text-white"
                                            : "bg-amber-600 hover:bg-amber-700 text-white",
              )}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {reasonStatus === "Returned" ? "Return" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Dialog ── */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="border-border bg-card text-foreground rounded-2xl max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">House Allocation Invoice</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Official housing allocation document for {detail.employee_name || detail.requester_name}
            </DialogDescription>
          </DialogHeader>

          {/* Invoice Content */}
          <div id="invoice-content" className="space-y-6 py-4">
            {/* Header Section */}
            <div className="border-2 border-foreground/20 rounded-lg p-6 bg-background/50">
              <div className="grid grid-cols-3 gap-4 items-start">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full border-2 border-foreground/30 flex items-center justify-center bg-muted/30">
                    <Building2 className="h-8 w-8 text-foreground/60" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground/70">Company/Title</p>
                  </div>
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-bold text-foreground mb-1">መተሃራ ሽኳር ፋብሪካ</h1>
                  <h2 className="text-lg font-semibold text-foreground/80">METEHARA SUGARA FACTORY</h2>
                  <p className="text-sm text-foreground/60 mt-1">የተለቀቀ ነዋሪ ኮሚሴ መረጃ</p>
                  <p className="text-xs text-foreground/50">Housing Allocation Record</p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <p className="text-foreground/70">ቀን/Date: <span className="font-mono">{fmt(new Date().toISOString())}</span></p>
                  <p className="text-foreground/70">ቁጥር/No: <span className="font-mono">{detail.application_no}</span></p>
                </div>
              </div>
            </div>

            {/* Allocation Information */}
            <div className="space-y-4">
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b border-foreground/20">
                  <h3 className="font-bold text-sm text-foreground">1. የሰለሰበ ስም</h3>
                  <p className="text-xs text-foreground/60">Employee Information</p>
                </div>
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between border-b border-dashed border-foreground/10 pb-1">
                      <span className="text-foreground/70">Full Name:</span>
                      <span className="font-semibold text-foreground">{detail.employee_name || detail.requester_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-foreground/10 pb-1">
                      <span className="text-foreground/70">Employee ID:</span>
                      <span className="font-mono font-semibold text-foreground">{detail.employee_id}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-foreground/10 pb-1">
                      <span className="text-foreground/70">National ID:</span>
                      <span className="font-mono font-semibold text-foreground">{detail.national_id}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-foreground/10 pb-1">
                      <span className="text-foreground/70">Job Position:</span>
                      <span className="font-semibold text-foreground">{detail.job_position}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b border-foreground/20">
                  <h3 className="font-bold text-sm text-foreground">2. በቤቱ ዓይነት የተሰጠ ቁጥር</h3>
                  <p className="text-xs text-foreground/60">Allocated House Details</p>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="text-sm">
                        <p className="text-xs text-foreground/60 mb-1">2.1 አልእክት ኮርስ</p>
                        <p className="text-xs text-foreground/60 mb-1">House Number</p>
                        <div className="border-b-2 border-foreground/30 pb-1">
                          <p className="font-mono text-lg font-black text-foreground">
                            {selectedHouse ? (selectedHouse.house_number || selectedHouse.house_id) : detail.allocated_house || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <p className="text-xs text-foreground/60 mb-1">2.2 የአት ኮርስ</p>
                        <p className="text-xs text-foreground/60 mb-1">House Type</p>
                        <div className="border-b-2 border-foreground/30 pb-1">
                          <p className="text-lg font-black text-foreground">
                            {selectedHouse ? selectedHouse.house_type : (detail.eligible_house_category || "—")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-sm">
                      <p className="text-xs text-foreground/60 mb-1">2.3 የወተ ኮርስ</p>
                      <p className="text-xs text-foreground/60 mb-1">Location</p>
                      <div className="border-b-2 border-foreground/30 pb-1">
                        <p className="font-semibold text-foreground">
                          {selectedHouse ? selectedHouse.location : (detail.preferred_location || "—")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="text-xs text-foreground/60 mb-1">2.4 የዕን አሰቀፍር</p>
                      <p className="text-xs text-foreground/60 mb-1">Additional Notes</p>
                      <div className="border-b-2 border-foreground/30 pb-1 min-h-[3rem]">
                        <p className="text-sm text-foreground/80 italic">
                          {detail.reason_for_request || "Standard allocation as per company housing policy."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="border border-foreground/20 rounded-lg p-4 bg-muted/10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground/70">የተዘጋጀው ስም</p>
                  <p className="text-xs text-foreground/60 mb-2">Prepared by</p>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="flex items-center gap-2">
                        <span className="text-xs text-foreground/50">{num}.</span>
                        <div className="flex-1 border-b border-dashed border-foreground/20 pb-1 min-h-[1.5rem]"></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground/70">የቀን፡ተፈካር ስምና ፊርም</p>
                  <p className="text-xs text-foreground/60 mb-2">Approved by (Name & Sign)</p>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="flex items-center gap-2">
                        <span className="text-xs text-foreground/50">{num}.</span>
                        <div className="flex-1 border-b border-dashed border-foreground/20 pb-1 min-h-[1.5rem]"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation Metadata */}
            <div className="border-t border-foreground/10 pt-4 mt-6">
              <div className="grid grid-cols-3 gap-4 text-xs text-foreground/50">
                <div>
                  <p className="font-semibold">Priority Score</p>
                  <p className="font-mono text-foreground">{detail.priority_score?.toFixed(2) || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold">Queue Position</p>
                  <p className="font-mono text-foreground">#{detail.queue_position || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold">Allocation Date</p>
                  <p className="font-mono text-foreground">{fmt(new Date().toISOString())}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInvoiceOpen(false)} className="h-10 rounded-lg px-5 font-semibold">
              Close
            </Button>
            <Button
              onClick={() => {
                const content = document.getElementById("invoice-content");
                if (!content) return;
                const w = window.open("", "_blank");
                if (!w) { toast.error("Please allow popups to print"); return; }
                w.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <title>House Allocation Invoice - ${detail.application_no}</title>
                    <style>
                      @media print {
                        @page { margin: 1.5cm; }
                      }
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        line-height: 1.5;
                        color: #000;
                        background: #fff;
                        padding: 20px;
                        max-width: 900px;
                        margin: 0 auto;
                      }
                      h1, h2 { margin: 0; line-height: 1.2; }
                      .border { border: 2px solid #333; }
                      .border-thin { border: 1px solid #666; }
                      .rounded { border-radius: 8px; }
                      .p-4 { padding: 16px; }
                      .p-6 { padding: 24px; }
                      .mb-4 { margin-bottom: 16px; }
                      .grid { display: grid; gap: 16px; }
                      .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                      .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
                      .text-center { text-align: center; }
                      .text-right { text-align: right; }
                      .font-bold { font-weight: 700; }
                      .font-semibold { font-weight: 600; }
                      .text-sm { font-size: 0.875rem; }
                      .text-xs { font-size: 0.75rem; }
                      .text-lg { font-size: 1.125rem; }
                      .text-xl { font-size: 1.25rem; }
                      .border-b-dashed { border-bottom: 1px dashed #999; padding-bottom: 4px; }
                      .border-b-solid { border-bottom: 2px solid #333; padding-bottom: 4px; }
                      .bg-light { background: #f5f5f5; }
                      .space-y-2 > * + * { margin-top: 8px; }
                      .space-y-3 > * + * { margin-top: 12px; }
                      .flex { display: flex; }
                      .flex-between { display: flex; justify-content: space-between; }
                      .gap-2 { gap: 8px; }
                      .items-center { align-items: center; }
                      .mono { font-family: "Courier New", monospace; }
                      .signature-line { border-bottom: 1px dashed #999; min-height: 1.5rem; }
                    </style>
                  </head>
                  <body>
                    ${content.innerHTML.replace(/class="[^"]*"/g, (match) => {
                      const cls = match.match(/class="([^"]*)"/)?.[1] || "";
                      const simpleMap: Record<string, string> = {
                        "border-2": "border",
                        "border": "border-thin",
                        "rounded-lg": "rounded",
                        "bg-background/50": "bg-light",
                        "bg-muted/30": "bg-light",
                        "bg-muted/10": "bg-light",
                        "font-mono": "mono",
                        "border-b": "border-b-dashed",
                        "border-b-2": "border-b-solid",
                      };
                      let result = "";
                      cls.split(" ").forEach((c) => {
                        if (simpleMap[c]) result += simpleMap[c] + " ";
                        else if (c.match(/^(p|m|text|font|grid|flex|space|gap|items)-/)) result += c + " ";
                      });
                      return result ? `class="${result.trim()}"` : "";
                    })}
                    <div style="margin-top:40px;text-align:center;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px;">
                      <p>Generated by SAMS (Student Asset Management System) on ${new Date().toLocaleString()}</p>
                      <p>This is an official document. Please retain for your records.</p>
                    </div>
                  </body>
                  </html>
                `);
                w.document.close();
                setTimeout(() => w.print(), 250);
              }}
              className="h-10 rounded-lg bg-primary px-6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              <Printer className="mr-2 h-4 w-4" /> Print Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
