import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getApplication,
  updateApplicationStatus,
  autoAllocateHouse,
  deallocateHouse,
  listAllocationLogs,
  recalculateApplicationScore,
  batchAllocateAll,
  type BatchAllocateResult,
  type ApplicationStatus,
  type HouseApplication,
  type AllocationLog,
} from "@/services/houseApplication";
import { listHouses, type House } from "@/services/houses";
import {
  ArrowLeft, ArrowRight, Award, BarChart3, CheckCircle2, Clock3,
  FileText, Home, Info, Loader2, MapPin, RefreshCw, Scale, Send, ShieldCheck,
  Sparkles, Target, Trash2, TrendingUp, UserRound, Users, XCircle, Zap,
  AlertTriangle, Eye, Medal, FileCheck, CalendarDays, Hash, Wrench, CheckCircle, Droplets, Lightbulb, Grid, History
} from "lucide-react";

// ── Helpers ─────────────
function formatD(value?: string | null) {
  if (!value) return "\u2014";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function daysSince(v?: string | null) { return v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : 0; }

// ── Components ─────────────
function ScoreGauge({ score }: { score: number }) {
  const r = 50, circ = 2 * Math.PI * r;
  const c = Math.min(Math.max(score, 0), 100);
  const offset = circ - (c / 100) * circ;
  const color = c >= 70 ? "#10b981" : c >= 40 ? "#f59e0b" : "#64748b";
  const glowId = "gaugeGlow";
  const gradId = "gaugeGrad";
  return (
    <div className="relative inline-flex items-center justify-center group">
      <svg width="140" height="140" className="-rotate-90 drop-shadow-sm transition-transform duration-500 group-hover:scale-105">
        <defs>
          <radialGradient id="gaugeBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </radialGradient>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="50%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth="8" strokeOpacity="0.4" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="url(#gaugeBg)" strokeWidth="14" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" filter={`url(#${glowId})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground drop-shadow-sm" style={{ color }}>{c.toFixed(0)}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

function MiniScoreBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
        <span className="text-muted-foreground">{label}</span>
        <span style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: pct + '%', backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────
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
  const [batchAllocating, setBatchAllocating] = useState(false);
  const [batchResult, setBatchResult] = useState<{ allocated: BatchAllocateResult[]; skipped: BatchAllocateResult[] } | null>(null);
  const [scoringHouses, setScoringHouses] = useState<Map<string, number>>(new Map());

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [app, logs, houses] = await Promise.all([
        getApplication(id),
        listAllocationLogs(),
        listHouses()
      ]);
      
      setDetail(app);
      setAllocationLogs(logs.filter((l) => l.application === id));
      
      if (app.eligible_house_category) {
        const active = houses.filter((h) => h.house_type === app.eligible_house_category && h.status === "Active");
        setAvailableHouses(active);
        const scores = new Map<string, number>();
        active.forEach((h) => { scores.set(h.house_id, computeHouseMatch(h, app)); });
        setScoringHouses(scores);
      }
    } catch (err: any) { toast.error(err?.message || "Failed to load"); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  const handleAutoAllocate = async (houseId: string) => {
    if (!id) return;
    try { setAllocating(true); const u = await autoAllocateHouse(houseId, id); setDetail(u); toast.success("Allocated!"); void fetchDetail(); }
    catch (err: any) { toast.error(err?.message || "Allocation failed"); } finally { setAllocating(false); }
  };
  const handleDeallocate = async () => {
    if (!id) return;
    try { setDeallocating(true); const u = await deallocateHouse(id, "Manual deallocation"); setDetail(u); toast.success("Deallocated"); void fetchDetail(); }
    catch (err: any) { toast.error(err?.message || "Failed"); } finally { setDeallocating(false); }
  };
  const handleRecalculate = async () => {
    if (!id) return;
    try { setCalculating(true); const u = await recalculateApplicationScore(id); setDetail(u); toast.success("Score recalculated"); void fetchDetail(); }
    catch (err: any) { toast.error(err?.message || "Failed"); } finally { setCalculating(false); }
  };
  const setStatus = async (status: ApplicationStatus, reason?: string) => {
    if (!id) return;
    try { setSubmitting(true); const u = await updateApplicationStatus(id, status, reason); setDetail(u); toast.success("Marked " + status); setReasonOpen(false); setReasonStatus(null); setReasonText(""); }
    catch (err: any) { toast.error(err?.message || "Failed"); } finally { setSubmitting(false); }
  };
  const handleBatchAllocate = async () => {
    try { setBatchAllocating(true); const r = await batchAllocateAll(); setBatchResult(r); toast.success("Allocated " + r.allocated.length + ", " + r.skipped.length + " skipped"); void fetchDetail(); }
    catch (err: any) { toast.error(err?.message || "Batch failed"); } finally { setBatchAllocating(false); }
  };

  const sortedHouses = useMemo(() =>
    [...availableHouses].sort((a, b) => (scoringHouses.get(b.house_id) ?? 0) - (scoringHouses.get(a.house_id) ?? 0)),
    [availableHouses, scoringHouses]);
  const topHouse = sortedHouses[0];

  if (loading) return <PageSkeleton />;
  if (!detail) return <div className="p-6"><Card><CardContent className="py-12 text-center text-muted-foreground font-semibold">Application not found.</CardContent></Card></div>;

  const wd = daysSince(detail.submitted_at);

  // Timeline events logic
  const timelineEvents = [
    { 
      label: "Application Submitted", 
      date: detail.submitted_at, 
      done: ["Submitted", "Under Review", "Verified", "Waiting for Allocation", "Allocated", "Returned", "Rejected"].includes(detail.status),
      icon: Send, color: "text-blue-500", bg: "bg-blue-500/10"
    },
    { 
      label: "Verified & Approved", 
      date: detail.reviewed_at, 
      done: ["Verified", "Waiting for Allocation", "Allocated"].includes(detail.status),
      icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10"
    },
    { 
      label: "In Allocation Queue", 
      date: detail.reviewed_at, 
      done: ["Waiting for Allocation", "Allocated"].includes(detail.status),
      icon: Clock3, color: "text-amber-500", bg: "bg-amber-500/10"
    },
    { 
      label: detail.status === "Rejected" ? "Rejected" : detail.status === "Returned" ? "Returned" : "House Allocated", 
      date: detail.allocated_at || (detail.status === "Rejected" || detail.status === "Returned" ? detail.reviewed_at : null), 
      done: ["Allocated", "Rejected", "Returned"].includes(detail.status),
      icon: detail.status === "Rejected" ? XCircle : detail.status === "Returned" ? RefreshCw : CheckCircle2, 
      color: detail.status === "Allocated" ? "text-primary" : "text-rose-500", 
      bg: detail.status === "Allocated" ? "bg-primary/10" : "bg-rose-500/10"
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative selection:bg-primary/20">
      
      {/* ─── AMBIENT ORBS ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 mix-blend-multiply dark:mix-blend-screen opacity-60 dark:opacity-30">
        <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1900px] space-y-6 p-4 md:p-6 pb-24">
        
        {/* ═══════════════ COMMAND CENTER HEADER ═══════════════ */}
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl shadow-sm transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-violet-500/5 opacity-50" />
          <div className="relative p-6 md:p-8 flex flex-col xl:flex-row gap-8 items-center xl:items-start justify-between">
            
            <div className="flex items-center gap-6 w-full xl:w-auto">
              <div className="flex h-20 w-20 md:h-24 md:w-24 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-border/50 shadow-md bg-background/50 backdrop-blur-md">
                <img src="/msf_logo.jpg" alt="MSF" className="h-full w-full object-cover mix-blend-multiply dark:mix-blend-screen opacity-90" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
                    Allocation Workspace
                  </h1>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black tracking-widest">{detail.application_no || detail.id}</Badge>
                </div>
                <Breadcrumbs className="opacity-80 text-muted-foreground" items={[{ label: "House Allocation", to: "/house-opp" }, { label: "Queue", to: "/house-opp/queue" }, { label: detail.employee_name || detail.requester_name }]} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center xl:justify-end gap-5 w-full xl:w-auto">
              <div className="flex flex-col items-center justify-center px-4">
                {calculating ? (
                   <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-emerald-500/20 border-t-emerald-500" />
                ) : (
                  <ScoreGauge score={detail.priority_score || 0} />
                )}
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col items-start p-4 rounded-2xl bg-background/40 border border-border/50 backdrop-blur-md min-w-[120px] shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Queue Rank</span>
                  <span className="text-3xl font-black text-foreground tabular-nums">#{detail.queue_position ?? "—"}</span>
                </div>
                <div className="flex flex-col items-start p-4 rounded-2xl bg-background/40 border border-border/50 backdrop-blur-md min-w-[120px] shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Days Waiting</span>
                  <span className="text-3xl font-black text-foreground tabular-nums">{wd}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" className="h-10 gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all font-bold tracking-wide rounded-xl shadow-sm"
                  onClick={() => void handleRecalculate()} disabled={calculating}>
                  {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Recalculate
                </Button>
                <Button variant="outline" size="sm" className="h-10 gap-2 bg-background/40 text-foreground hover:bg-muted border-border transition-all font-bold rounded-xl shadow-sm"
                  onClick={() => navigate("/house-opp/queue")}>
                  <ArrowLeft className="h-4 w-4" /> Back to Queue
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ MAIN CONTENT GRID ═══════════════ */}
        <div className="grid gap-6 xl:grid-cols-12 items-start">

          {/* ─── LEFT SIDEBAR: PROFILE & TIMELINE ─── */}
          <div className="xl:col-span-3 space-y-6 flex flex-col sticky top-6">
            
            {/* Unified ID Card */}
            <div className="rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl overflow-hidden shadow-lg relative group">
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-blue-500/20 to-emerald-500/10" />
              <div className="p-6 pt-16 relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-background border-4 border-card rounded-full shadow-xl flex items-center justify-center text-blue-500 mb-4">
                  <UserRound className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-black text-foreground">{detail.employee_name || detail.requester_name}</h2>
                <p className="text-sm font-medium text-muted-foreground">{detail.job_position || detail.job_title}</p>
                <Badge variant="outline" className="mt-3 bg-background/50 backdrop-blur-md">ID: {detail.employee_id || detail.requester}</Badge>
              </div>
              
              <div className="px-6 pb-6 space-y-4">
                <Separator className="bg-border/50" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Service</span>
                    <p className="text-sm font-black text-foreground">{detail.service_years || detail.years_of_service || 0} Years</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Family Size</span>
                    <p className="text-sm font-black text-foreground">{detail.family_size || 1}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Job Grade</span>
                    <p className="text-sm font-black text-foreground">{detail.job_grade || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Disability</span>
                    <p className="text-sm font-black text-foreground">{detail.has_disability ? "Yes" : "No"}</p>
                  </div>
                </div>

                <Separator className="bg-border/50" />
                <div className="space-y-3 pt-2">
                  <MiniScoreBar label="Job Grade Score" pct={(gradeScore(detail)/30)*100} color="#3b82f6" />
                  <MiniScoreBar label="Service Score" pct={(serviceScore(detail)/25)*100} color="#8b5cf6" />
                  <MiniScoreBar label="Family Score" pct={(familyScore(detail)/20)*100} color="#10b981" />
                  <MiniScoreBar label="Disability Score" pct={detail.has_disability ? 100 : 0} color="#f59e0b" />
                  <MiniScoreBar label="FIFO Score" pct={(fifoScore(detail)/10)*100} color="#f43f5e" />
                </div>
              </div>
            </div>

            {/* Application Audit Timeline */}
            <div className="rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-500"><History className="h-5 w-5" /></div>
                <h2 className="text-base font-bold text-foreground tracking-wide">Audit Timeline</h2>
              </div>
              <div className="relative border-l-2 border-border/50 ml-4 space-y-6 pb-2">
                {timelineEvents.map((ev, i) => (
                  <div key={i} className={cn("relative pl-6 transition-all duration-300", !ev.done && "opacity-40 grayscale")}>
                    <div className={cn("absolute -left-[17px] top-0 p-1.5 rounded-full border-4 border-card", ev.bg, ev.color)}>
                      <ev.icon className="w-4 h-4" />
                    </div>
                    <div className="pt-1">
                      <p className={cn("text-sm font-bold", ev.done ? "text-foreground" : "text-muted-foreground")}>{ev.label}</p>
                      {ev.date && ev.done && (
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wider">
                          {formatD(ev.date)} {formatTime(ev.date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ─── MIDDLE CONTENT: ACTIONS & DETAILS ─── */}
          <div className="xl:col-span-3 space-y-6 flex flex-col">
            
            {/* Workflow Actions */}
            <div className="rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5 border-b border-border/50 pb-4">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Send className="h-5 w-5" /></div>
                <h2 className="text-base font-bold text-foreground tracking-wide">Workflow Actions</h2>
              </div>
              <div className="space-y-3">
                {detail.status === "Submitted" && (
                  <>
                    <Button className="w-full h-11 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 font-bold transition-all shadow-sm"
                      onClick={() => void setStatus("Verified")} disabled={submitting}>
                      <ShieldCheck className="h-4 w-4 mr-2" /> Verify Application
                    </Button>
                    <Button className="w-full h-11 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 font-bold transition-all shadow-sm"
                      onClick={() => { setReasonStatus("Returned"); setReasonOpen(true); }} disabled={submitting}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Return for Correction
                    </Button>
                    <Button className="w-full h-11 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 font-bold transition-all shadow-sm"
                      onClick={() => { setReasonStatus("Rejected"); setReasonOpen(true); }} disabled={submitting}>
                      <XCircle className="h-4 w-4 mr-2" /> Reject Application
                    </Button>
                  </>
                )}
                {detail.status === "Verified" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">✓ Application verified — ready for allocation</p>
                  </div>
                )}
                {detail.status === "Waiting for Allocation" && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-bold">⏳ In queue — use the AI Match panel to allocate</p>
                  </div>
                )}
                {detail.status === "Allocated" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">✓ House has been allocated successfully</p>
                  </div>
                )}
                {(detail.status === "Returned" || detail.status === "Rejected") && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mb-1">{detail.status}</p>
                    {detail.rejection_reason && <p className="text-[11px] text-muted-foreground">{detail.rejection_reason}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Application Notes & Docs */}
            <div className="rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl p-6 shadow-sm flex-1">
              <div className="flex items-center gap-3 mb-5 border-b border-border/50 pb-4">
                <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-400"><FileText className="h-5 w-5" /></div>
                <h2 className="text-base font-bold text-foreground tracking-wide">Notes & Docs</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between py-2 border-b border-border/40"><span className="text-xs text-muted-foreground">Eligible For</span><span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{detail.eligible_house_category || "N/A"}</span></div>
                  <div className="flex justify-between py-2 border-b border-border/40"><span className="text-xs text-muted-foreground">Location Pref</span><span className="text-xs font-bold text-foreground">{detail.preferred_location || "Any"}</span></div>
                </div>
                
                <div className="bg-background/40 p-3.5 rounded-xl border border-border/50 shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Applicant Note</span>
                  <p className="text-xs text-foreground/80 leading-relaxed min-h-[60px] italic">
                    {detail.reason_for_request ? `"${detail.reason_for_request}"` : "No special notes provided by the applicant."}
                  </p>
                </div>
                
                {detail.supporting_document ? (
                  <Button variant="outline" className="w-full bg-background/50 border-border text-foreground hover:bg-muted transition-all rounded-xl shadow-sm" asChild>
                    <a href={detail.supporting_document} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4 text-emerald-500" /> View Document</a>
                  </Button>
                ) : (
                  <div className="text-center py-3 border border-dashed border-border/60 rounded-xl bg-background/20 text-xs text-muted-foreground">
                    No document attached
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ─── RIGHT MAIN ARENA: AI MATCH & HOUSES ─── */}
          <div className="xl:col-span-6 space-y-6">
            
            {/* ALREADY ALLOCATED STATUS */}
            {detail.status === "Allocated" && detail.allocated_house_id && (
              <div className="rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-2xl p-6 md:p-8 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 blur-[60px] rounded-full" />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-inner"><CheckCircle2 className="h-8 w-8" /></div>
                    <div>
                      <p className="text-2xl font-black text-emerald-900 dark:text-emerald-50">Allocated to House {detail.allocated_house_id}</p>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200/80 mt-1 font-medium">Approved on {formatD(detail.allocated_at)} by {detail.allocated_by_name || "System"}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-300 rounded-xl px-6 h-12 font-bold transition-all shadow-sm"
                    onClick={() => void handleDeallocate()} disabled={deallocating}>
                    {deallocating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
                    Reverse
                  </Button>
                </div>
              </div>
            )}

            {/* AI SMART MATCH RECOMMENDATION */}
            {(detail.status === "Waiting for Allocation" || detail.status === "Verified") && topHouse && (
              <div className="rounded-[2rem] border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/5 to-transparent backdrop-blur-3xl p-6 shadow-lg relative overflow-hidden group">
                <div className="absolute -top-[50%] -right-[10%] w-[150%] h-[150%] bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-[80px] group-hover:bg-primary/15 transition-all duration-1000 ease-in-out pointer-events-none" />
                
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm relative">
                        <Sparkles className="h-6 w-6 relative z-10" />
                        <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-foreground tracking-wide">Top AI Match</h2>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Recommended out of {sortedHouses.length} houses</p>
                      </div>
                    </div>
                    <div className="bg-primary/10 px-5 py-2.5 rounded-2xl border border-primary/20 shadow-sm flex items-center justify-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      <span className="text-2xl font-black text-primary tabular-nums">{scoringHouses.get(topHouse.house_id)?.toFixed(0) ?? "?"}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background/60 border border-border/50 rounded-2xl p-4 flex flex-col gap-1 backdrop-blur-md shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Home className="w-3 h-3 text-blue-500" />House ID</span>
                      <span className="text-xl font-black text-foreground">{topHouse.house_id}</span>
                    </div>
                    <div className="bg-background/60 border border-border/50 rounded-2xl p-4 flex flex-col gap-1 backdrop-blur-md shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3 text-rose-500" />Location</span>
                      <span className="text-xl font-black text-foreground truncate">{topHouse.location || "Unspecified"}</span>
                    </div>
                  </div>

                  {/* Match Analysis Breakdown */}
                  <div className="bg-card/40 border border-border/50 rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> Match Analysis
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col items-center text-center p-2 rounded-xl bg-background/50 border border-border/50">
                        <Award className="w-4 h-4 text-emerald-500 mb-1" />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Category</span>
                        <span className="text-sm font-black text-emerald-500">+{topHouse.house_type === detail.eligible_house_category ? 40 : 0}</span>
                      </div>
                      <div className="flex flex-col items-center text-center p-2 rounded-xl bg-background/50 border border-border/50">
                        <Users className="w-4 h-4 text-blue-500 mb-1" />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Capacity</span>
                        <span className="text-sm font-black text-blue-500">+{((topHouse.capacity||1) >= (detail.family_size||1)) ? 30 : Math.max(0, 30 - ((detail.family_size||1) - (topHouse.capacity||1))*10)}</span>
                      </div>
                      <div className="flex flex-col items-center text-center p-2 rounded-xl bg-background/50 border border-border/50">
                        <MapPin className="w-4 h-4 text-rose-500 mb-1" />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Location</span>
                        <span className="text-sm font-black text-rose-500">+{detail.preferred_location && topHouse.location?.toLowerCase().includes(detail.preferred_location.toLowerCase()) ? 20 : 10}</span>
                      </div>
                      <div className="flex flex-col items-center text-center p-2 rounded-xl bg-background/50 border border-border/50">
                        <Wrench className="w-4 h-4 text-amber-500 mb-1" />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Condition</span>
                        <span className="text-sm font-black text-amber-500">+{(topHouse.damaged_door || topHouse.damaged_windows || topHouse.damaged_walls || topHouse.damaged_switch || topHouse.damaged_bulb || topHouse.damaged_water) ? 0 : 10}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide text-sm shadow-md transition-all"
                      onClick={() => { setSelectedHouse(topHouse); setConfirmAllocOpen(true); }} disabled={allocating}>
                      <CheckCircle2 className="h-5 w-5 mr-2" /> Allocate Recommended
                    </Button>
                    <Button variant="outline" className="flex-none h-12 px-6 rounded-xl bg-background/50 border-border text-foreground hover:bg-muted font-bold transition-all shadow-sm"
                      onClick={() => void handleBatchAllocate()} disabled={batchAllocating}>
                      {batchAllocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* BATCH ALLOC RESULT */}
            {batchResult && (
              <div className="rounded-[2rem] border border-border bg-card/60 backdrop-blur-2xl p-6 shadow-lg">
                 <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><Zap className="h-5 w-5" /></div>
                  <h2 className="text-xl font-bold text-foreground tracking-wide">Batch Allocation Complete</h2>
                  <Badge className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-3 py-1 text-sm">{batchResult.allocated.length} Allocated</Badge>
                </div>
                <div className="grid gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                  {batchResult.allocated.map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                      <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">App: {r.application_id}</span>
                      <span className="text-sm font-bold text-emerald-600">→ House {r.house_id}</span>
                    </div>
                  ))}
                  {batchResult.skipped.map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 shadow-sm">
                      <span className="text-sm font-semibold text-rose-800 dark:text-rose-200">App: {r.application_id}</span>
                      <span className="text-xs font-medium text-rose-600">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ALL AVAILABLE HOUSES GRID */}
            {sortedHouses.length > 0 && detail.status !== "Allocated" && (
              <div className="rounded-[2rem] border border-border bg-card/40 backdrop-blur-3xl p-6 flex flex-col h-[700px] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border/50 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><Grid className="h-5 w-5" /></div>
                    <h3 className="text-xl font-black text-foreground">Available Houses Directory</h3>
                  </div>
                  <Badge className="bg-background/50 text-muted-foreground border-border shadow-sm">Sorted by Match %</Badge>
                </div>
                
                <ScrollArea className="flex-1 pr-4 -mr-4 custom-scrollbar">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sortedHouses.map((house) => {
                      const match = scoringHouses.get(house.house_id) || 0;
                      const glowColor = match >= 70 ? 'rgba(16, 185, 129, 0.15)' : match >= 40 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)';
                      
                      const damages = [];
                      if(house.damaged_door) damages.push("Door");
                      if(house.damaged_windows) damages.push("Windows");
                      if(house.damaged_walls) damages.push("Walls");
                      if(house.damaged_water) damages.push("Water");
                      if(house.damaged_switch || house.damaged_bulb) damages.push("Electric");

                      return (
                        <div key={house.id} 
                          className={cn(
                            "group cursor-pointer rounded-2xl border transition-all duration-300 p-5 relative overflow-hidden backdrop-blur-md flex flex-col",
                            selectedHouse?.id === house.id ? "bg-primary/5 border-primary/40" : "bg-background/60 border-border/60 hover:border-border hover:bg-card"
                          )}
                          style={selectedHouse?.id === house.id ? { boxShadow: `0 0 30px ${glowColor}` } : {}}
                          onClick={() => setSelectedHouse(house)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-lg font-black text-foreground flex items-center gap-2">
                                <Home className="w-4 h-4 text-muted-foreground" /> {house.house_id}
                              </p>
                              <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" />{house.location || "Location unknown"}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-2xl font-black leading-none" style={{ color: match >= 70 ? '#10b981' : match >= 40 ? '#f59e0b' : '#64748b' }}>{match.toFixed(0)}%</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mb-4 flex-wrap mt-auto">
                            <span className="px-2 py-1 rounded-md bg-muted/50 text-[10px] font-bold text-foreground border border-border/50">TYPE {house.house_type}</span>
                            <span className="px-2 py-1 rounded-md bg-muted/50 text-[10px] font-bold text-foreground border border-border/50 flex items-center gap-1"><Users className="w-3 h-3"/> {house.capacity || 1}</span>
                          </div>

                          {damages.length > 0 ? (
                            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-3 items-start">
                              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block mb-1">Needs Maintenance</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {damages.map(d => (
                                    <span key={d} className="text-[9px] bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded-sm font-semibold">{d}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Perfect Condition</span>
                            </div>
                          )}
                          
                          <Button className="w-full h-10 rounded-xl bg-background hover:bg-primary hover:text-primary-foreground text-foreground border border-border font-bold transition-all shadow-sm gap-2"
                            onClick={(e) => { e.stopPropagation(); setSelectedHouse(house); setConfirmAllocOpen(true); }} disabled={allocating && selectedHouse?.id === house.id}>
                            {allocating && selectedHouse?.id === house.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Manually Assign
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
            
          </div>
        </div>
      </div>

      {/* ─── DIALOGS ─── */}
      <Dialog open={confirmAllocOpen} onOpenChange={setConfirmAllocOpen}>
        <DialogContent className="border-border bg-background/95 backdrop-blur-2xl text-foreground rounded-[2rem]">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-black">Confirm Manual Allocation</DialogTitle>
            <DialogDescription className="text-muted-foreground text-base">
              You are manually bypassing the queue to allocate <strong className="text-foreground border-b-2 border-primary">House {selectedHouse?.house_id}</strong> to {detail.employee_name || detail.requester_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="flex justify-between items-center p-4 rounded-2xl bg-muted/50 border border-border">
               <div className="flex items-center gap-3">
                 <UserRound className="w-5 h-5 text-blue-500" />
                 <span className="text-muted-foreground font-semibold">Applicant Score</span>
               </div>
               <span className="text-lg font-black">{detail.priority_score?.toFixed(1)} pts</span>
             </div>
             <div className="flex justify-between items-center p-4 rounded-2xl bg-primary/5 border border-primary/20">
               <div className="flex items-center gap-3">
                 <Target className="w-5 h-5 text-primary" />
                 <span className="text-primary/80 font-semibold">House Match Score</span>
               </div>
               <span className="text-xl text-primary font-black">{selectedHouse ? scoringHouses.get(selectedHouse.house_id)?.toFixed(1) : 0}%</span>
             </div>
             
             {selectedHouse && (selectedHouse.damaged_door || selectedHouse.damaged_windows || selectedHouse.damaged_walls || selectedHouse.damaged_switch || selectedHouse.damaged_bulb || selectedHouse.damaged_water) && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">
                    <strong>Warning:</strong> You are allocating a house that requires maintenance. Ensure the applicant is aware of the current condition.
                  </p>
                </div>
             )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmAllocOpen(false)} className="h-12 px-6 rounded-xl border-border hover:bg-muted font-bold text-foreground">Cancel</Button>
            <Button onClick={() => { if(selectedHouse) { void handleAutoAllocate(selectedHouse.id); setConfirmAllocOpen(false); } }}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-md" disabled={allocating}>
              {allocating ? "Allocating..." : "Confirm Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason / Reject Dialog */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="border-border bg-background/95 backdrop-blur-2xl text-foreground rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {reasonStatus === "Returned" ? "Return Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {reasonStatus === "Returned"
                ? "Provide a reason so the applicant knows what to correct."
                : "Provide a reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label className="text-foreground font-semibold">
              {reasonStatus === "Returned" ? "Return reason" : "Rejection reason"}
            </Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
              placeholder="Enter reason..."
              className="bg-muted/30 border-border text-foreground placeholder:text-muted-foreground rounded-xl resize-none focus:border-primary/50 text-base p-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting}
              className="h-12 px-6 rounded-xl border-border hover:bg-muted font-bold">Cancel</Button>
            <Button
              onClick={() => {
                if (!reasonStatus) return;
                if (!reasonText.trim()) { toast.error("Reason is required"); return; }
                void setStatus(reasonStatus, reasonText.trim());
              }}
              disabled={submitting}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold">
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Score breakdown helpers ─────────────
function gradeScore(app: HouseApplication): number {
  try {
    const grade = parseInt(String(app.job_grade).trim()) || 1;
    return Math.min(30, (grade / 20) * 30);
  } catch { return 0; }
}

function serviceScore(app: HouseApplication): number {
  return Math.min(25, ((app.years_of_service || app.service_years || 0) / 30) * 25);
}

function familyScore(app: HouseApplication): number {
  return Math.min(20, ((app.family_size || 0) / 10) * 20);
}

function fifoScore(app: HouseApplication): number {
  return app.queue_position ? Math.max(0, 10 - (app.queue_position - 1)) : 5;
}

function computeHouseMatch(house: House, app: HouseApplication): number {
  let score = 0;
  if (house.house_type === app.eligible_house_category) score += 40;
  const cap = house.capacity || 1;
  const fam = app.family_size || 1;
  if (cap >= fam) score += 30;
  else score += Math.max(0, 30 - (fam - cap) * 10);
  if (app.preferred_location && house.location && house.location.toLowerCase().includes(app.preferred_location.toLowerCase())) score += 20;
  else score += 10;
  const damaged = house.damaged_door || house.damaged_windows || house.damaged_walls ||
    house.damaged_switch || house.damaged_bulb || house.damaged_water;
  if (!damaged) score += 10;
  return Math.min(100, Math.max(0, score));
}
