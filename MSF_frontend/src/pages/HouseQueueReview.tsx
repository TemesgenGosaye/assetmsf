import {
  Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode,
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
} from "@/services/houseApplication";
import { listHouses, type House } from "@/services/houses";
import {
  Activity, AlertTriangle, ArrowLeft, Award, BadgeCheck, BarChart3, Building2,
  CalendarDays, CheckCircle, CheckCircle2, Clock3, Cpu, Database,
  Eye, FileCheck, FileText, Fingerprint, Hash, History, Home, Info,
  KeyRound, Layers, Loader2, MapPin, Medal, Network, Radar, RefreshCw, Scale,
  SearchCheck, Send, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, UserRound,
  Users, XCircle, Zap, Star, TrendingDown,
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
  Draft:                  { label: "Draft",              cls: "bg-muted/60 text-muted-foreground border-border/60",                             dot: "bg-slate-400" },
  Submitted:              { label: "Submitted",          cls: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",                  dot: "bg-sky-400" },
  "Under Review":         { label: "Under Review",       cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",      dot: "bg-indigo-400" },
  Verified:               { label: "Verified",           cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",  dot: "bg-emerald-400" },
  "Waiting for Allocation":{ label: "In Queue",          cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",         dot: "bg-amber-400" },
  Allocated:              { label: "Allocated",          cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40", dot: "bg-emerald-500" },
  Rejected:               { label: "Rejected",           cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",             dot: "bg-rose-400" },
  Returned:               { label: "Returned",           cls: "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30",     dot: "bg-orange-400" },
};

const LOG_DOT: Record<string, string> = {
  STATUS_CHANGED: "bg-sky-500",
  AUTO_ALLOCATED: "bg-emerald-500",
  MANUAL_OVERRIDE: "bg-violet-500",
  DEALLOCATED: "bg-rose-500",
};

const PIPELINE: { key: ApplicationStatus; label: string; icon: ReactNode; short: string }[] = [
  { key: "Submitted",              label: "Submitted",  short: "Sub",    icon: <Send className="h-4 w-4" /> },
  { key: "Under Review",           label: "Review",     short: "Rev",    icon: <SearchCheck className="h-4 w-4" /> },
  { key: "Verified",               label: "Verified",   short: "Ver",    icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "Waiting for Allocation", label: "Queued",     short: "Que",    icon: <Clock3 className="h-4 w-4" /> },
  { key: "Allocated",              label: "Allocated",  short: "Done",   icon: <KeyRound className="h-4 w-4" /> },
];

// ─── Score helpers ────────────────────────────────────────────────────────
function gradeScore(a: HouseApplication) {
  try { return Math.min(30, (Math.max(1, parseInt(String(a.job_grade), 10) || 1) / 20) * 30); } catch { return 0; }
}
function serviceScore(a: HouseApplication) { return Math.min(25, ((a.years_of_service || 0) / 30) * 25); }
function familyScore(a: HouseApplication)  { return Math.min(20, ((a.family_size || 0) / 10) * 20); }
function fifoScore(a: HouseApplication)    { return a.queue_position ? Math.max(0, 10 - (a.queue_position - 1)) : 5; }
function computeHouseMatch(h: House, a: HouseApplication): number {
  let s = 0;
  if (h.house_type === a.eligible_house_category) s += 40;
  const cap = h.capacity || 1, fam = a.family_size || 1;
  s += cap >= fam ? 30 : Math.max(0, 30 - (fam - cap) * 10);
  s += (a.preferred_location && h.location?.toLowerCase().includes(a.preferred_location.toLowerCase())) ? 20 : 10;
  if (!hasDamages(h)) s += 10;
  return Math.min(100, Math.max(0, s));
}

// ─── Ambient ─────────────────────────────────────────────────────────────
function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 dark:opacity-90" style={{
        backgroundImage:
          "radial-gradient(60% 50% at 10% 0%, hsl(var(--primary)/0.18) 0%, transparent 60%)," +
          "radial-gradient(50% 45% at 90% 5%, hsl(262 83% 58%/0.12) 0%, transparent 60%)," +
          "radial-gradient(45% 40% at 50% 105%, hsl(142 71% 45%/0.10) 0%, transparent 65%)",
      }} />
      <div className="absolute inset-0 opacity-20 dark:opacity-[0.12]" style={{
        backgroundImage: "linear-gradient(hsl(var(--border)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)) 1px,transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%,black 5%,transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%,black 5%,transparent 75%)",
      }} />
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <span className="flex items-center gap-2 text-[11px] font-bold tabular-nums tracking-widest text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

// ─── Celebration burst ────────────────────────────────────────────────────
function CelebrationBurst({ show }: { show: boolean }) {
  if (!show) return null;
  const pts = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 100 + (i % 6) * 28;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist,
      color: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "#34d399" : "#fbbf24",
      delay: (i % 6) * 0.04 };
  });
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      <style>{`@keyframes qr-burst{0%{transform:translate(-50%,-50%) scale(.3);opacity:1}80%{opacity:.8}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.5);opacity:0}}`}</style>
      {pts.map((p, i) => (
        <span key={i} className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
          style={{ backgroundColor: p.color, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`,
            animation: `qr-burst 1.2s ease-out ${p.delay}s forwards` }} />
      ))}
    </div>
  );
}

// ─── Enhanced Score Ring with percentile context ──────────────────────────
function ScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const uid = useId();
  const stroke = 14;
  const r = (size - stroke) / 2 - 4;
  const circ = 2 * Math.PI * r;
  const c = Math.min(Math.max(Number(score) || 0, 0), 100);
  const offset = circ - (c / 100) * circ;
  const color = c >= 70 ? "#34d399" : c >= 45 ? "#fbbf24" : "#94a3b8";
  const tier = c >= 70 ? { label: "HIGH", icon: <TrendingUp className="h-3 w-3" />, cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25" }
             : c >= 45 ? { label: "MED",  icon: <BarChart3 className="h-3 w-3" />,  cls: "text-amber-500 bg-amber-500/10 border-amber-500/25" }
             :           { label: "LOW",  icon: <TrendingDown className="h-3 w-3" />, cls: "text-slate-500 bg-slate-500/10 border-slate-500/25" };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-flex items-center justify-center">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ backgroundColor: color }} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="50%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id={`${uid}-glow`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeOpacity="0.5" strokeWidth={stroke} />
          {/* Tick marks at 25/50/75 */}
          {[25,50,75].map((pct) => {
            const a = ((pct/100)*2*Math.PI) - Math.PI/2;
            const x1 = size/2 + (r - stroke*0.5 - 3) * Math.cos(a);
            const y1 = size/2 + (r - stroke*0.5 - 3) * Math.sin(a);
            const x2 = size/2 + (r + stroke*0.5 + 3) * Math.cos(a);
            const y2 = size/2 + (r + stroke*0.5 + 3) * Math.sin(a);
            return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.25" strokeWidth="1.5" />;
          })}
          {/* Progress arc */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${uid}-g)`}
            strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            filter={`url(#${uid}-glow)`}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.34,1.56,.64,1)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <CountUp value={Math.round(c)} duration={1200} className="text-5xl font-black tabular-nums leading-none text-foreground" />
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Priority Score</span>
        </div>
      </div>
      {/* Tier badge */}
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest", tier.cls)}>
        {tier.icon}{tier.label} PRIORITY
      </span>
    </div>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, accent }: {
  icon: ReactNode; label: string; value: ReactNode; accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm shadow-sm">
      <div className={cn("absolute -right-4 -top-4 h-14 w-14 rounded-full blur-2xl opacity-60", accent)} />
      <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{icon}{label}</p>
      <div className="relative mt-1.5 text-2xl font-black tabular-nums leading-none text-foreground">{value}</div>
    </div>
  );
}

// ─── Criterion bar ────────────────────────────────────────────────────────
function CriterionBar({ label, points, max, color, delay = 0 }: {
  label: string; points: number; max: number; color: string; delay?: number;
}) {
  const pct = max > 0 ? Math.min(100, (points / max) * 100) : 0;
  return (
    <div className="group space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-black tabular-nums" style={{ color }}>
          {points.toFixed(1)}<span className="text-muted-foreground/60 font-medium"> / {max}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div className="absolute inset-0 rounded-full bg-muted/40" />
        <div className="relative h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
          style={{ width: pct + "%", backgroundColor: color, transitionDelay: `${delay}ms`,
            boxShadow: `0 0 6px ${color}80` }} />
      </div>
    </div>
  );
}

// ─── Enhanced StatusStepper with smooth connectors ────────────────────────
function StatusStepper({ status }: { status: ApplicationStatus }) {
  const idx = PIPELINE.findIndex((p) => p.key === status);
  const isTerminal = status === "Rejected" || status === "Returned";
  return (
    <div className="relative w-full">
      {/* Background connector track */}
      <div className="absolute left-0 right-0 top-[22px] mx-10 h-[2px] bg-border/50 rounded-full" />
      {/* Filled connector up to current step */}
      <div className="absolute left-0 top-[22px] mx-10 h-[2px] rounded-full overflow-hidden"
        style={{ right: "2.5rem" }}>
        <div className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/80 transition-all duration-700"
          style={{ width: idx >= 0 ? `${(idx / (PIPELINE.length - 1)) * 100}%` : "0%" }} />
      </div>
      <div className="relative flex items-start justify-between">
        {PIPELINE.map((step, i) => {
          const done    = idx >= 0 && i < idx && !isTerminal;
          const current = idx >= 0 && i === idx && !isTerminal;
          const future  = idx < 0 || i > idx || isTerminal;
          return (
            <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all duration-500",
                done    && "border-primary/50 bg-primary/15 text-primary shadow-md",
                current && "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/30 scale-110",
                future  && "border-border/50 bg-muted/30 text-muted-foreground/40",
              )}>
                {current && (
                  <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 motion-reduce:animate-none" />
                )}
                {done && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground shadow">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                )}
                <span className="relative">{step.icon}</span>
              </div>
              <span className={cn(
                "text-center text-[9px] font-bold uppercase leading-tight tracking-wider",
                current ? "text-primary" : done ? "text-foreground/70" : "text-muted-foreground/40",
              )}>{step.label}</span>
            </div>
          );
        })}
      </div>
      {/* Terminal state overlay */}
      {isTerminal && (
        <div className={cn(
          "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold",
          status === "Rejected" ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                                : "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
        )}>
          {status === "Rejected" ? <XCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          {status === "Rejected" ? "Application Rejected" : "Returned for Correction"}
        </div>
      )}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-muted-foreground">{icon}{label}</span>
      <span className="text-right text-[11px] font-black text-foreground">{value}</span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────
function SectionHeader({ icon, title, accent, badge }: {
  icon: ReactNode; title: string; accent: string; badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm", accent)}>
          {icon}
        </div>
        <h3 className="text-sm font-black tracking-wide text-foreground">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

// ─── Profile cell ─────────────────────────────────────────────────────────
function ProfileCell({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-xs font-black text-foreground truncate", accent)} title={String(value)}>{value || "—"}</p>
    </div>
  );
}

// ─── Enhanced Timeline node ───────────────────────────────────────────────
function TimelineNode({ icon, color, bg, label, date, done, last }: {
  icon: ReactNode; color: string; bg: string; label: string;
  date?: string | null; done: boolean; last?: boolean;
}) {
  return (
    <div className="relative flex gap-4 group">
      {!last && (
        <div className="absolute left-[18px] top-10 bottom-0 w-px">
          <div className={cn("h-full w-full transition-colors duration-700", done ? "bg-primary/25" : "bg-border/50")} />
        </div>
      )}
      <div className={cn(
        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-500",
        bg, color,
        done ? "border-current/30 shadow-md" : "opacity-35 grayscale border-border/30",
      )}>
        {done && <span className="absolute inset-0 rounded-xl bg-current opacity-10" />}
        {icon}
      </div>
      <div className={cn("pb-5 min-w-0 flex-1", !done && "opacity-35")}>
        <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
        {date && done && (
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            {fmt(date)} · {fmtTime(date)}
          </p>
        )}
      </div>
      {done && (
        <div className="shrink-0 mt-0.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-70" />
        </div>
      )}
    </div>
  );
}

// ─── Match fact chip ──────────────────────────────────────────────────────
function MatchFact({ icon, label, value, mono }: { icon: ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 shadow-sm">
      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{icon}{label}</span>
      <p className={cn("mt-1 truncate text-sm font-black text-foreground", mono && "font-mono")} title={value}>{value}</p>
    </div>
  );
}

// ─── Analysis quad ────────────────────────────────────────────────────────
function AnalysisQuad({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-3 text-center shadow-sm">
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-xl font-black tabular-nums leading-none" style={{ color }}>+{value}</span>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: color,
          transition: "width 0.8s ease-out", boxShadow: `0 0 4px ${color}80` }} />
      </div>
      <span className="text-[9px] text-muted-foreground/70 font-semibold">of {max}</span>
    </div>
  );
}

// ─── Smarter House match card ─────────────────────────────────────────────
function HouseCard({ house, match, rank, selected, onSelect, onAssign, disabled }: {
  house: House; match: number; rank: number; selected: boolean;
  onSelect: () => void; onAssign: () => void; disabled?: boolean;
}) {
  const uid = useId();
  const r = 16, stroke = 3.5, circ = 2 * Math.PI * r;
  const off = circ - (Math.min(Math.max(match, 0), 100) / 100) * circ;
  const color = match >= 70 ? "#34d399" : match >= 45 ? "#fbbf24" : "#94a3b8";
  const damages: string[] = [];
  if (house.damaged_door) damages.push("Door");
  if (house.damaged_windows) damages.push("Windows");
  if (house.damaged_walls) damages.push("Walls");
  if (house.damaged_water) damages.push("Water");
  if (house.damaged_switch || house.damaged_bulb) damages.push("Electrical");
  const vacant = house.vacant ?? Math.max(1 - (house.current_occupancy ?? 0), 0);
  const isTop = rank === 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        selected
          ? "border-primary/60 bg-primary/[0.07] shadow-[0_0_0_2px_hsl(var(--primary)/0.2),0_8px_32px_hsl(var(--primary)/0.15)]"
          : "cursor-pointer border-border/60 bg-card/50 hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/8",
        isTop && !selected && "border-amber-500/30 bg-amber-500/[0.03]",
      )}
    >
      {/* Top ribbon for best match */}
      {isTop && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-amber-400/0 via-amber-400 to-amber-400/0" />
      )}
      <div className="flex-1 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              {isTop && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />}
              <p className="font-mono text-base font-black tracking-tight text-foreground truncate">
                {house.house_number || house.house_id}
              </p>
            </div>
            {house.house_number && house.house_id && (
              <p className="text-[10px] text-muted-foreground/70 font-mono mb-0.5">ID: {house.house_id}</p>
            )}
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
              <MapPin className="h-3 w-3 shrink-0" />{house.location || "Location unknown"}
            </p>
          </div>
          {/* Mini score ring */}
          <div className="relative h-12 w-12 shrink-0">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
              <defs>
                <linearGradient id={`${uid}-mg`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={color} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--muted))" strokeOpacity="0.5" strokeWidth={stroke} />
              <circle cx="24" cy="24" r={r} fill="none" stroke={`url(#${uid}-mg)`} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                style={{ transition: "stroke-dashoffset 0.9s ease-out", filter: `drop-shadow(0 0 4px ${color}60)` }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-foreground">
              {Math.round(match)}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-foreground">
            Type {house.house_type}
          </span>
          <span className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-foreground">
            <Users className="h-2.5 w-2.5" />{house.capacity || 1} pax
          </span>
          <span className={cn(
            "rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
            vacant > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20"
                       : "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20",
          )}>
            {vacant} vacant
          </span>
          {house.allocation_category === "G" && (
            <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-500">Guest</span>
          )}
        </div>

        {/* Condition */}
        {hasDamages(house) ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 p-2.5 mb-3">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-500 mb-1">Needs Maintenance</p>
              <div className="flex flex-wrap gap-1">
                {damages.map((d) => (
                  <span key={d} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-300">{d}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-2.5 mb-3">
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Perfect Condition</p>
          </div>
        )}

        {/* Match bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Match Score</span>
            <span style={{ color }}>{match.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full transition-[width] duration-700"
              style={{ width: match + "%", backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
          </div>
        </div>
      </div>

      {/* Assign button */}
      <div className="p-3 pt-0">
        <Button
          className="h-9 w-full rounded-xl border border-border/60 bg-background/60 text-sm font-bold text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:shadow-primary/20"
          onClick={(e) => { e.stopPropagation(); onAssign(); }}
          disabled={disabled}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Assign this House
        </Button>
      </div>
    </div>
  );
}

// ─── Empty state for no available houses ─────────────────────────────────
function NoHousesEmpty({ category }: { category?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border/50 bg-muted/30">
          <Building2 className="h-9 w-9 text-muted-foreground/40" />
        </div>
        <div className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
      </div>
      <div>
        <p className="text-sm font-black text-foreground">No Vacant Houses Available</p>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-[240px] leading-relaxed">
          There are currently no available houses of type <strong className="text-foreground">{category || "—"}</strong>.
          Check back after maintenance or when a house becomes vacant.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-[10px] font-bold text-muted-foreground">
          Try adjusting eligibility
        </span>
        <span className="rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-[10px] font-bold text-muted-foreground">
          Run batch allocation
        </span>
      </div>
    </div>
  );
}

// ─── Not found state ──────────────────────────────────────────────────────
function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="relative max-w-sm w-full">
        <div className="absolute inset-0 rounded-3xl blur-3xl bg-primary/10 opacity-50" />
        <div className="relative rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-10 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-lg font-black text-foreground">Application Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">The application you're looking for doesn't exist or has been removed.</p>
          <Button variant="outline" className="mt-6 h-11 rounded-xl px-6 font-bold" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
          </Button>
        </div>
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

  const [detail, setDetail]             = useState<HouseApplication | null>(null);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [reasonOpen, setReasonOpen]     = useState(false);
  const [reasonStatus, setReasonStatus] = useState<ApplicationStatus | null>(null);
  const [reasonText, setReasonText]     = useState("");
  const [allocating, setAllocating]     = useState(false);
  const [deallocating, setDeallocating] = useState(false);
  const [calculating, setCalculating]   = useState(false);
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [allocationLogs, setAllocationLogs] = useState<AllocationLog[]>([]);
  const [availableHouses, setAvailableHouses] = useState<House[]>([]);
  const [batchAllocating, setBatchAllocating] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    allocated: BatchAllocateResult[]; skipped: BatchAllocateResult[]; total_houses: number;
  } | null>(null);
  const [scoringHouses, setScoringHouses] = useState<Map<string, number>>(new Map());
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<number | null>(null);
  useEffect(() => () => { if (celebrateTimer.current) clearTimeout(celebrateTimer.current); }, []);

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

  const fireCelebration = () => {
    setCelebrating(true);
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 1800);
  };

  const handleAutoAllocate = async (houseId: string) => {
    if (!id) return;
    try {
      setAllocating(true);
      const u = await autoAllocateHouse(houseId, id);
      setDetail(u); fireCelebration();
      toast.success("House allocated successfully!");
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

  const setStatus = async (status: ApplicationStatus, reason?: string) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const u = await updateApplicationStatus(id, status, reason);
      setDetail(u); toast.success(`Status updated to ${status}`);
      setReasonOpen(false); setReasonStatus(null); setReasonText("");
      void fetchDetail();
    } catch (err: any) { toast.error(err?.message || "Failed to update status"); }
    finally { setSubmitting(false); }
  };

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
  const topHouse  = sortedHouses[0];
  const topMatch  = topHouse ? (scoringHouses.get(topHouse.id) ?? 0) : 0;

  const scoreParts = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "Job Grade",  points: gradeScore(detail),   max: 30, color: "#3b82f6" },
      { label: "Service",    points: serviceScore(detail),  max: 25, color: "#8b5cf6" },
      { label: "Family",     points: familyScore(detail),   max: 20, color: "#10b981" },
      { label: "Disability", points: detail.has_disability ? 15 : 0, max: 15, color: "#f59e0b" },
      { label: "FIFO",       points: fifoScore(detail),     max: 10, color: "#f43f5e" },
    ];
  }, [detail]);
  const scoreTotal = scoreParts.reduce((s, p) => s + p.points, 0);

  const timelineEvents = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "Application Submitted", date: detail.submitted_at,
        done: ["Submitted","Under Review","Verified","Waiting for Allocation","Allocated","Returned","Rejected"].includes(detail.status),
        icon: <Send className="h-4 w-4" />, color: "text-sky-500", bg: "bg-sky-500/15" },
      { label: "Under Review", date: detail.submitted_at,
        done: ["Under Review","Verified","Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <SearchCheck className="h-4 w-4" />, color: "text-indigo-500", bg: "bg-indigo-500/15" },
      { label: "Verified & Approved", date: detail.reviewed_at,
        done: ["Verified","Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <ShieldCheck className="h-4 w-4" />, color: "text-emerald-500", bg: "bg-emerald-500/15" },
      { label: "In Allocation Queue", date: detail.reviewed_at,
        done: ["Waiting for Allocation","Allocated"].includes(detail.status),
        icon: <Clock3 className="h-4 w-4" />, color: "text-amber-500", bg: "bg-amber-500/15" },
      { label: detail.status === "Rejected" ? "Rejected" : detail.status === "Returned" ? "Returned" : "House Allocated",
        date: detail.allocated_at || (["Rejected","Returned"].includes(detail.status) ? detail.reviewed_at : null),
        done: ["Allocated","Rejected","Returned"].includes(detail.status),
        icon: detail.status === "Rejected" ? <XCircle className="h-4 w-4" />
            : detail.status === "Returned" ? <RefreshCw className="h-4 w-4" />
            : <KeyRound className="h-4 w-4" />,
        color: detail.status === "Allocated" ? "text-primary" : "text-rose-500",
        bg: detail.status === "Allocated" ? "bg-primary/15" : "bg-rose-500/15" },
    ];
  }, [detail]);

  if (loading) return <PageSkeleton />;
  if (!detail)  return <NotFoundState onBack={() => navigate("/house-opp/queue")} />;

  const wd   = daysSince(detail.submitted_at);
  const st   = STATUS_CFG[detail.status] ?? STATUS_CFG.Draft;
  const initials = (detail.employee_name || detail.requester_name || "?")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const serif = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" } as const;
  const canAllocate = detail.status === "Waiting for Allocation" || detail.status === "Verified";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative selection:bg-primary/20">
      <Ambient />
      <CelebrationBurst show={celebrating} />

      <div className="relative z-10 mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 pb-24">

        {/* ══════════════ COMMAND HERO ══════════════ */}
        <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/60 shadow-2xl backdrop-blur-3xl">
          {/* Gradient layer */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage:
              "radial-gradient(70% 120% at 0% 0%, hsl(var(--primary)/0.18) 0%, transparent 55%)," +
              "radial-gradient(55% 100% at 100% 0%, hsl(262 83% 58%/0.12) 0%, transparent 55%)",
          }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)/0.07) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--primary)/0.07) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "linear-gradient(to bottom,black,transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom,black,transparent 85%)",
          }} />

          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              {/* Left: identity */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border/60 shadow-lg shrink-0">
                    <img src="/msf_logo.jpg" alt="MSF" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-screen opacity-90" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                        <Radar className="h-3 w-3" /> Allocation Command
                      </span>
                      <LiveClock />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
                      <span className="text-muted-foreground font-semibold text-lg mr-2">Review for</span>
                      <span style={{ ...serif, fontStyle: "italic", color: "hsl(var(--primary))" }}>
                        {detail.employee_name || detail.requester_name}
                      </span>
                    </h1>
                  </div>
                </div>
                <Breadcrumbs items={[
                  { label: "House Allocation", to: "/house-opp" },
                  { label: "Queue", to: "/house-opp/queue" },
                  { label: detail.employee_name || "Review" },
                ]} />
                {/* Status pills */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 font-mono text-[11px] font-bold text-foreground">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    {detail.application_no || detail.id}
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black", st.cls)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                    {st.label}
                  </span>
                  {detail.eligible_house_category && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-300">
                      <Award className="h-3.5 w-3.5" /> Type {detail.eligible_house_category}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground">
                    <Fingerprint className="h-3.5 w-3.5" />{detail.employee_id || "—"}
                  </span>
                  {detail.has_disability && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400" /> Disability Flag
                    </span>
                  )}
                </div>
              </div>

              {/* Right: score + kpi + actions */}
              <div className="flex flex-wrap items-center gap-5 xl:flex-nowrap">
                <div className="rounded-2xl border border-border/60 bg-background/40 p-4 shadow-inner backdrop-blur-md">
                  <ScoreRing score={detail.priority_score || 0} />
                </div>
                <div className="grid grid-cols-2 gap-3 min-w-[180px]">
                  <StatTile icon={<Medal className="h-3.5 w-3.5 text-amber-500" />} label="Queue Rank"
                    value={detail.queue_position ? <CountUp value={detail.queue_position} duration={900} /> : "—"} accent="bg-amber-500/20" />
                  <StatTile icon={<Clock3 className="h-3.5 w-3.5 text-sky-500" />} label="Days Waiting"
                    value={<CountUp value={wd} duration={900} />} accent="bg-sky-500/20" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => void handleRecalculate()} disabled={calculating}
                    className="h-10 gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 font-bold transition-all">
                    {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Recalculate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/house-opp/queue")}
                    className="h-10 gap-2 rounded-xl border-border bg-background/40 font-bold text-foreground hover:bg-muted transition-all">
                    <ArrowLeft className="h-4 w-4" /> Back to Queue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ ALLOCATED BANNER ══════════════ */}
        {detail.status === "Allocated" && detail.allocated_house_id && (
          <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/8 to-transparent p-5 md:p-6 shadow-xl backdrop-blur-2xl">
            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-emerald-500/15 blur-[80px] pointer-events-none" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-500">
                  <KeyRound className="h-7 w-7" />
                  <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/20 motion-reduce:animate-none" />
                </div>
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-xl font-black text-emerald-900 dark:text-emerald-50">Allocated to House</p>
                    <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-300">{detail.allocated_house_id}</span>
                  </div>
                  <p className="text-sm font-medium text-emerald-800/70 dark:text-emerald-200/70 mt-0.5">
                    {fmt(detail.allocated_at)} at {fmtTime(detail.allocated_at)}
                    {detail.allocated_by_name && <> · by <strong className="text-emerald-700 dark:text-emerald-300">{detail.allocated_by_name}</strong></>}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => void handleDeallocate()} disabled={deallocating}
                className="h-11 rounded-xl border-rose-500/40 bg-rose-500/10 px-6 font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition-all shrink-0">
                {deallocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Reverse Allocation
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════ 3-COLUMN MAIN GRID ══════════════ */}
        <div className="grid gap-5 xl:grid-cols-12">

          {/* ─────────── COL 1: APPLICANT PROFILE ─────────── */}
          <div className="space-y-4 xl:col-span-3">

            {/* Identity card */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/50 shadow-lg backdrop-blur-2xl">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/20 via-primary/8 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="relative flex flex-col items-center p-6 pt-16 text-center">
                <Avatar className="h-20 w-20 border-4 border-card shadow-xl ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary/15 text-xl font-black text-primary">{initials}</AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-lg font-black tracking-tight text-foreground" style={serif}>
                  {detail.employee_name || detail.requester_name}
                </h2>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{detail.job_position || "—"}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-bold text-foreground">
                    ID · {detail.employee_id || detail.requester}
                  </span>
                  {detail.national_id && (
                    <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-bold text-foreground">
                      NID · {detail.national_id}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-2">
                  <ProfileCell label="Gender"   value={detail.gender || "—"} />
                  <ProfileCell label="Marital"  value={detail.marital_status || "—"} />
                  <ProfileCell label="Job Type" value={detail.job_type || "—"} />
                  <ProfileCell label="Grade"    value={detail.job_grade || "—"} accent="text-primary" />
                  <ProfileCell label="Service"  value={`${detail.years_of_service ?? 0} yrs`} />
                  <ProfileCell label="Family"   value={`${detail.family_size || 1} ppl`} accent="text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Eligibility */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<BadgeCheck className="h-4.5 w-4.5 text-violet-500" />}
                title="Eligibility" accent="bg-violet-500/10 border-violet-500/20 text-violet-500" />
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Eligible For</p>
                    <p className="mt-1 text-2xl font-black text-violet-600 dark:text-violet-300">{detail.eligible_house_category || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Requested</p>
                    <p className="mt-1 text-2xl font-black text-foreground">{detail.requested_house_category || "—"}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                    <MapPin className="h-3 w-3" /> Preferred Location
                  </p>
                  <p className="text-sm font-black text-foreground">{detail.preferred_location || "Any location"}</p>
                </div>
              </div>
            </div>

            {/* Score decomposition */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<Scale className="h-4.5 w-4.5 text-primary" />} title="Score Breakdown"
                accent="bg-primary/10 border-primary/20 text-primary"
                badge={
                  <Badge variant="outline" className="border-primary/25 bg-primary/10 text-xs font-black text-primary px-2.5">
                    <CountUp value={scoreTotal} duration={900} decimals={1} /> pts
                  </Badge>
                } />
              <div className="space-y-3.5">
                {scoreParts.map((p, i) => <CriterionBar key={p.label} {...p} delay={i * 100} />)}
              </div>
              <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Server score: <strong className="text-foreground">{detail.priority_score?.toFixed(1) ?? "0"}</strong> pts.
                  Panel shows live weighted criteria decomposition.
                </p>
              </div>
            </div>

            {/* Applicant note + doc */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<FileText className="h-4.5 w-4.5 text-sky-500" />} title="Applicant Note"
                accent="bg-sky-500/10 border-sky-500/20 text-sky-500" />
              <blockquote className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs italic leading-relaxed text-foreground/80 shadow-inner">
                {detail.reason_for_request ? `"${detail.reason_for_request}"` : "No special notes provided."}
              </blockquote>
              {detail.supporting_document ? (
                <Button variant="outline" className="mt-3 w-full h-10 rounded-xl border-border bg-background/50 font-bold text-foreground hover:bg-muted text-sm" asChild>
                  <a href={detail.supporting_document} target="_blank" rel="noreferrer">
                    <Eye className="mr-2 h-4 w-4 text-emerald-500" /> View Supporting Document
                  </a>
                </Button>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border/50 bg-background/20 py-3 text-center text-xs text-muted-foreground">
                  No document attached
                </div>
              )}
            </div>
          </div>

          {/* ─────────── COL 2: WORKFLOW ENGINE ─────────── */}
          <div className="space-y-4 xl:col-span-3">

            {/* Workflow pipeline */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<Layers className="h-4.5 w-4.5 text-primary" />} title="Workflow Pipeline"
                accent="bg-primary/10 border-primary/20 text-primary" />
              <StatusStepper status={detail.status} />

              <Separator className="my-5 bg-border/40" />

              {/* ── CLEAR CONTEXT-AWARE ACTIONS ── */}
              <div className="space-y-3">

                {/* ── SUBMITTED / UNDER REVIEW ── */}
                {(detail.status === "Submitted" || detail.status === "Under Review") && (
                  <div className="space-y-3">
                    {/* Current step callout */}
                    <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500 text-xs font-black">
                        {detail.status === "Submitted" ? "1" : "2"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                          {detail.status === "Submitted" ? "Ready for Review" : "Currently Under Review"}
                        </p>
                        <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 leading-relaxed">
                          {detail.status === "Submitted"
                            ? "Review the applicant's details and supporting documents, then verify or return."
                            : "Finish reviewing and move the application forward or send it back."}
                        </p>
                      </div>
                    </div>

                    {/* Primary action */}
                    <Button className="h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/25 transition-all text-sm"
                      onClick={() => void setStatus("Verified")} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      ✓ Verify &amp; Approve Application
                    </Button>

                    {/* Secondary actions row */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="h-10 rounded-xl border border-amber-500/40 bg-amber-500/10 font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all text-xs"
                        onClick={() => { setReasonStatus("Returned"); setReasonOpen(true); }} disabled={submitting}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Return for Fix
                      </Button>
                      <Button className="h-10 rounded-xl border border-rose-500/40 bg-rose-500/10 font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-all text-xs"
                        onClick={() => { setReasonStatus("Rejected"); setReasonOpen(true); }} disabled={submitting}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>

                    {/* What happens next hint */}
                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                      After verifying → applicant enters the <strong className="text-foreground">Allocation Queue</strong>
                    </p>
                  </div>
                )}

                {/* ── RETURNED ── */}
                {detail.status === "Returned" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500 text-xs font-black">!</div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-orange-700 dark:text-orange-300">Returned for Correction</p>
                        {detail.returned_reason ? (
                          <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80 mt-1 leading-relaxed italic">
                            "{detail.returned_reason}"
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting applicant's correction.</p>
                        )}
                      </div>
                    </div>
                    <Button className="h-12 w-full rounded-xl border border-sky-500/40 bg-sky-500/10 font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-all text-sm"
                      onClick={() => void setStatus("Submitted")} disabled={submitting}>
                      <Send className="mr-2 h-4 w-4" /> Re-Submit to Queue
                    </Button>
                  </div>
                )}

                {/* ── VERIFIED ── */}
                {detail.status === "Verified" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500 text-xs font-black">3</div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">Verified — Ready to Queue</p>
                        <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                          Application is approved. Move it to the allocation queue or directly assign a house from the Match panel →
                        </p>
                      </div>
                    </div>
                    <Button className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-sm"
                      onClick={() => void setStatus("Waiting for Allocation")} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                      Move to Allocation Queue
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Or use the <strong className="text-foreground">AI Match panel →</strong> to directly assign a house
                    </p>
                  </div>
                )}

                {/* ── WAITING FOR ALLOCATION ── */}
                {detail.status === "Waiting for Allocation" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 text-xs font-black">4</div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-amber-700 dark:text-amber-300">In Allocation Queue</p>
                        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                          Select a house from the <strong>AI Match panel →</strong> on the right and click Assign, or run Auto-Allocate.
                        </p>
                      </div>
                    </div>
                    {detail.queue_position && (
                      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                        <span className="text-xs font-semibold text-muted-foreground">Queue position</span>
                        <span className="font-mono text-lg font-black text-primary">#{detail.queue_position}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── REJECTED ── */}
                {detail.status === "Rejected" && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                      <p className="text-sm font-black text-rose-700 dark:text-rose-300">Application Rejected</p>
                    </div>
                    {detail.rejection_reason && (
                      <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 leading-relaxed italic">
                        "{detail.rejection_reason}"
                      </p>
                    )}
                  </div>
                )}

                {/* ── ALLOCATED ── (handled by banner above, just a note) */}
                {detail.status === "Allocated" && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">Allocation Complete</p>
                      <p className="text-[11px] text-emerald-600/70 mt-0.5">
                        House <strong className="font-mono">{detail.allocated_house_id}</strong> has been assigned.
                        Use "Reverse Allocation" above if needed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System intelligence */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<Cpu className="h-4.5 w-4.5 text-violet-500" />} title="System Intelligence"
                accent="bg-violet-500/10 border-violet-500/20 text-violet-500" />
              <div>
                <InfoRow icon={<FileCheck className="h-4 w-4 text-sky-500" />}   label="App No."    value={<span className="font-mono">{detail.application_no || detail.id}</span>} />
                <InfoRow icon={<Activity className="h-4 w-4 text-emerald-500" />} label="Status"    value={st.label} />
                <InfoRow icon={<Medal className="h-4 w-4 text-amber-500" />}     label="Queue Pos." value={detail.queue_position ? `#${detail.queue_position}` : "Not queued"} />
                <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-400" />} label="Submitted" value={fmt(detail.submitted_at)} />
                {detail.reviewed_at && (
                  <InfoRow icon={<CalendarDays className="h-4 w-4 text-emerald-500" />} label="Reviewed"
                    value={`${fmt(detail.reviewed_at)}${detail.reviewed_by_name ? ` · ${detail.reviewed_by_name}` : ""}`} />
                )}
                {detail.allocated_at && (
                  <InfoRow icon={<KeyRound className="h-4 w-4 text-primary" />} label="Allocated"
                    value={`${fmt(detail.allocated_at)}${detail.allocated_by_name ? ` · ${detail.allocated_by_name}` : ""}`} />
                )}
                <InfoRow icon={<Database className="h-4 w-4 text-slate-400" />} label="Created" value={fmt(detail.created_at)} />
              </div>
            </div>

            {/* Lifecycle timeline */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
              <SectionHeader icon={<History className="h-4.5 w-4.5 text-slate-500" />} title="Lifecycle Timeline"
                accent="bg-slate-500/10 border-slate-500/20 text-slate-500" />
              <div className="space-y-0.5">
                {timelineEvents.map((ev, i) => (
                  <TimelineNode key={i} {...ev} last={i === timelineEvents.length - 1} />
                ))}
              </div>

              {allocationLogs.length > 0 && (
                <>
                  <Separator className="my-4 bg-border/40" />
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Allocation Logs ({allocationLogs.length})
                  </p>
                  <ScrollArea className="max-h-52 -mr-2 pr-2">
                    <div className="space-y-1">
                      {allocationLogs.slice().reverse().map((log) => (
                        <div key={log.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted/30 transition-colors">
                          <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", LOG_DOT[log.action] || "bg-muted-foreground")} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-foreground">{log.action.replace(/_/g, " ")}</p>
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
          </div>

          {/* ─────────── COL 3: MATCH ARENA ─────────── */}
          <div className="space-y-4 xl:col-span-6">

            {/* ══ HOW THIS PANEL WORKS ══ */}
            <div className="rounded-[1.75rem] border border-border/60 bg-card/40 backdrop-blur-xl overflow-hidden shadow-sm">
              {/* Header bar */}
              <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-5 py-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Info className="h-4 w-4" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-foreground">How the AI Match Panel Works</p>
                <span className="ml-auto rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                  Guide
                </span>
              </div>

              <div className="p-5 space-y-5">
                {/* Where is it */}
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-500 font-black text-sm">1</div>
                  <div>
                    <p className="text-sm font-black text-foreground">Where this appears</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      This panel is the <strong className="text-foreground">right column</strong> of the review page — visible only when the
                      application status is <strong className="text-foreground">Verified</strong> or <strong className="text-foreground">Waiting for Allocation</strong>.
                      It compares every vacant house of the applicant's eligible type and ranks them by compatibility.
                    </p>
                  </div>
                </div>

                {/* How match % is calculated */}
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-500 font-black text-sm">2</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">How the Match % is calculated</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed mb-3">
                      Each house scores up to <strong className="text-foreground">100 points</strong> across four criteria:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Category match",  pts: 40, color: "#34d399", desc: "House type matches applicant eligibility" },
                        { label: "Capacity fit",    pts: 30, color: "#3b82f6", desc: "House capacity ≥ family size" },
                        { label: "Location match",  pts: 20, color: "#f59e0b", desc: "Location matches preference" },
                        { label: "Condition",       pts: 10, color: "#a855f7", desc: "No reported damage" },
                      ].map((c) => (
                        <div key={c.label} className="rounded-xl border border-border/40 bg-background/50 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{c.label}</span>
                            <span className="text-xs font-black tabular-nums" style={{ color: c.color }}>+{c.pts}</span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60 mb-1.5">
                            <div className="h-full rounded-full" style={{ width: `${(c.pts / 100) * 100}%`, backgroundColor: c.color }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-snug">{c.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score colour legend */}
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 font-black text-sm">3</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">Reading the match score colour</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { range: "70 – 100", label: "Strong match",   color: "#34d399", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
                        { range: "45 – 69",  label: "Partial match",  color: "#fbbf24", cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300" },
                        { range: "0 – 44",   label: "Weak match",     color: "#94a3b8", cls: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300" },
                      ].map((s) => (
                        <div key={s.range} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", s.cls)}>
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-[11px] font-black">{s.range}</span>
                          <span className="text-[10px] font-semibold opacity-80">— {s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* How to allocate */}
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500 font-black text-sm">4</div>
                  <div>
                    <p className="text-sm font-black text-foreground">How to allocate a house</p>
                    <ol className="mt-1.5 space-y-1.5 text-xs text-muted-foreground leading-relaxed list-none">
                      <li className="flex items-start gap-2">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-black">A</span>
                        <span><strong className="text-foreground">AI Spotlight</strong> — click <em className="text-foreground font-semibold">Allocate Recommended</em> to instantly assign the best-ranked house.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-black">B</span>
                        <span><strong className="text-foreground">Manual pick</strong> — scroll the house grid below, click any card to select it, then click <em className="text-foreground font-semibold">Assign this House</em>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-black">C</span>
                        <span><strong className="text-foreground">Batch auto-allocate</strong> — click <em className="text-foreground font-semibold">Run Batch</em> to process all waiting applicants automatically.</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            {/* AI House Match Spotlight */}
            {canAllocate && topHouse && (
              <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent p-5 md:p-6 shadow-xl backdrop-blur-2xl">
                <div className="absolute -right-[20%] -top-[40%] h-[150%] w-[80%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border/40 mb-5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-md">
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <span className="absolute inset-0 -z-10 animate-pulse rounded-2xl bg-primary/20 blur-md motion-reduce:animate-none" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-wide text-foreground" style={serif}>AI House Match</h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Network className="h-3.5 w-3.5" />
                          Best of {sortedHouses.length} houses · <span className="font-mono font-bold text-foreground">
                            {topHouse.house_number || topHouse.house_id}
                            {topHouse.house_number && topHouse.house_id && (
                              <span className="text-muted-foreground ml-1">({topHouse.house_id})</span>
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-primary/25 bg-primary/10 px-5 py-2.5 text-center shadow-sm">
                        <CountUp value={Math.round(topMatch)} duration={1000}
                          className="block text-3xl font-black tabular-nums leading-none text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-primary/60">Match %</span>
                      </div>
                    </div>
                  </div>

                  {/* House identity row — ID + Number + key facts */}
                  <div className="mb-4 rounded-2xl border border-border/50 bg-background/50 p-4 shadow-sm">
                    <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">House Identity</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      {/* House Number — primary label */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">House No.</p>
                        <p className="font-mono text-lg font-black text-foreground leading-none">
                          {topHouse.house_number || topHouse.house_id || "—"}
                        </p>
                        {topHouse.house_number && topHouse.house_id && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">ID: {topHouse.house_id}</p>
                        )}
                      </div>
                      {/* Location */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Location</p>
                        <p className="text-sm font-black text-foreground">{topHouse.location || "Unknown"}</p>
                      </div>
                      {/* Type */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Type</p>
                        <span className="inline-flex items-center rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-sm font-black text-violet-600 dark:text-violet-300">
                          {topHouse.house_type}
                        </span>
                      </div>
                      {/* Capacity */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Capacity</p>
                        <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-emerald-500" />
                          {topHouse.capacity || 1} pax
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Analysis quads */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4 md:grid-cols-4">
                    <AnalysisQuad label="Category" color="#34d399"
                      value={topHouse.house_type === detail.eligible_house_category ? 40 : 0} max={40} />
                    <AnalysisQuad label="Capacity" color="#3b82f6"
                      value={(topHouse.capacity||1) >= (detail.family_size||1) ? 30 : Math.max(0, 30-((detail.family_size||1)-(topHouse.capacity||1))*10)} max={30} />
                    <AnalysisQuad label="Location" color="#f59e0b"
                      value={detail.preferred_location && topHouse.location?.toLowerCase().includes(detail.preferred_location.toLowerCase()) ? 20 : 10} max={20} />
                    <AnalysisQuad label="Condition" color="#a855f7" value={hasDamages(topHouse) ? 0 : 10} max={10} />
                  </div>

                  {/* Why reasoning */}
                  <div className="mb-5 rounded-xl border border-border/40 bg-background/40 p-4 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Why This House</p>
                    {[
                      topHouse.house_type === detail.eligible_house_category
                        ? { ok: true,  text: "Exact eligibility category match" }
                        : { ok: false, text: `Type ${topHouse.house_type} differs from eligible ${detail.eligible_house_category}` },
                      (topHouse.capacity||1) >= (detail.family_size||1)
                        ? { ok: true,  text: "Capacity fits household size comfortably" }
                        : { ok: false, text: "Capacity is below household size" },
                      detail.preferred_location && topHouse.location?.toLowerCase().includes(detail.preferred_location.toLowerCase())
                        ? { ok: true,  text: "Matches preferred location" }
                        : { ok: false, text: "Offered at an alternate location" },
                      !hasDamages(topHouse)
                        ? { ok: true,  text: "House is in perfect condition" }
                        : { ok: false, text: "Requires maintenance — verify before approval" },
                    ].map((r) => (
                      <div key={r.text} className="flex items-center gap-2.5 text-xs">
                        {r.ok
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className={r.ok ? "text-foreground/80 font-medium" : "text-muted-foreground font-medium"}>{r.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button className="flex-1 h-12 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 text-sm transition-all"
                      onClick={() => { setSelectedHouse(topHouse); setConfirmOpen(true); }} disabled={allocating}>
                      {allocating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                      Allocate Recommended
                    </Button>
                    <Button variant="outline" className="h-12 rounded-xl border-border bg-background/50 font-bold text-foreground hover:bg-muted transition-all"
                      onClick={() => void handleBatchAllocate()} disabled={batchAllocating}>
                      {batchAllocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                      <span className="ml-2 hidden sm:inline">Run Batch</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch result panel */}
            {batchResult && (
              <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-2xl">
                <div className="flex items-center gap-3 pb-4 border-b border-border/40 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 shadow-sm">
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-base font-black text-foreground">Batch Complete</h3>
                  <div className="ml-auto flex gap-2">
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-black">
                      {batchResult.allocated.length} allocated
                    </Badge>
                    {batchResult.skipped.length > 0 && (
                      <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-500 font-black">
                        {batchResult.skipped.length} skipped
                      </Badge>
                    )}
                  </div>
                </div>
                <ScrollArea className="max-h-60 -mr-2 pr-2">
                  <div className="space-y-2">
                    {batchResult.allocated.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-emerald-800 dark:text-emerald-200">{r.application_no || "—"}</p>
                          {r.allocated_to && <p className="text-[10px] text-emerald-600/70">{r.allocated_to}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-black text-emerald-600">→ {r.house_number || r.house_id}</p>
                          {r.score && <p className="text-[10px] text-emerald-600/60">{r.score} pts</p>}
                        </div>
                      </div>
                    ))}
                    {batchResult.skipped.map((r, i) => (
                      <div key={`s${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-2.5">
                        <p className="truncate text-sm font-bold text-muted-foreground">{r.application_no || r.house_id || "—"}</p>
                        <p className="text-[11px] font-bold text-muted-foreground/60 shrink-0">
                          {r.skip_reason || "skipped"}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Available houses grid */}
            {detail.status !== "Allocated" && (
              <div className="flex flex-col rounded-[1.75rem] border border-border/70 bg-card/50 shadow-sm backdrop-blur-2xl overflow-hidden"
                style={{ minHeight: sortedHouses.length > 0 ? "520px" : "auto" }}>
                <div className="flex items-center justify-between gap-3 p-5 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-500 shadow-sm">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-foreground">Available Houses</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Type {detail.eligible_house_category} · Ranked by match score
                      </p>
                    </div>
                  </div>
                  {sortedHouses.length > 0 && (
                    <Badge className="border-border/50 bg-background/50 text-muted-foreground shadow-sm">
                      <TrendingUp className="mr-1.5 h-3 w-3 text-primary" />
                      {sortedHouses.length} available
                    </Badge>
                  )}
                </div>

                {sortedHouses.length > 0 ? (
                  <ScrollArea className="flex-1 p-5">
                    <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
                      {sortedHouses.map((house, idx) => (
                        <HouseCard
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
                  </ScrollArea>
                ) : (
                  <NoHousesEmpty category={detail.eligible_house_category} />
                )}
              </div>
            )}
          </div>
        </div>{/* /grid */}
      </div>{/* /container */}

      {/* ── Confirm Allocation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-border bg-background/95 text-foreground backdrop-blur-2xl rounded-[2rem] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black" style={serif}>Confirm Allocation</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Allocating <strong className="text-foreground border-b border-primary">House {selectedHouse ? houseRef(selectedHouse) : "…"}</strong> to{" "}
              <strong className="text-foreground">{detail.employee_name || detail.requester_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {selectedHouse && (
            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-4 text-center">
                  <UserRound className="h-5 w-5 text-sky-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Applicant Score</span>
                  <span className="text-2xl font-black text-foreground">{detail.priority_score?.toFixed(1)}</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-primary/25 bg-primary/8 p-4 text-center">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Match Score</span>
                  <span className="text-2xl font-black text-primary">{(scoringHouses.get(selectedHouse.id) ?? 0).toFixed(1)}%</span>
                </div>
              </div>
              {hasDamages(selectedHouse) && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 mt-px" />
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">
                    <strong>Maintenance Required:</strong> Ensure the applicant is aware of the current house condition.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={allocating}
              className="h-11 rounded-xl border-border px-5 font-bold text-foreground hover:bg-muted">Cancel</Button>
            <Button onClick={() => { if (selectedHouse) { void handleAutoAllocate(selectedHouse.id); setConfirmOpen(false); } }}
              disabled={allocating}
              className="h-11 rounded-xl bg-primary px-7 font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90">
              {allocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reason / Reject Dialog ── */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="border-border bg-background/95 text-foreground backdrop-blur-2xl rounded-[2rem] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black" style={serif}>
              {reasonStatus === "Returned" ? "Return Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {reasonStatus === "Returned"
                ? "Provide a reason so the applicant knows what to correct."
                : "Provide a clear reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label className="font-bold text-sm text-foreground">
              {reasonStatus === "Returned" ? "Return Reason" : "Rejection Reason"}
            </Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
              placeholder="Enter reason..."
              className="resize-none rounded-xl border-border/60 bg-muted/20 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting}
              className="h-11 rounded-xl border-border px-5 font-bold hover:bg-muted">Cancel</Button>
            <Button
              onClick={() => {
                if (!reasonStatus) return;
                if (!reasonText.trim()) { toast.error("A reason is required"); return; }
                void setStatus(reasonStatus, reasonText.trim());
              }}
              disabled={submitting}
              className={cn(
                "h-11 rounded-xl px-7 font-bold shadow-md",
                reasonStatus === "Rejected"
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20",
              )}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {reasonStatus === "Returned" ? "Return" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


