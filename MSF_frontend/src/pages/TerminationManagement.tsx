import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, CalendarDays,
  CheckCircle2, Clock3, FileText, Hash, KeyRound, Loader2,
  RefreshCw, Search, Shield, UserRound, XCircle, Zap,
  Eye, Ban, Settings,
} from "lucide-react";

import { printClearanceSlip, downloadClearanceSlipPdf } from "@/lib/clearanceSlipPdf";
import ClearanceSlipModal from "@/components/houses/ClearanceSlipModal";
import PageHeader from "../components/layout/PageHeader";
import Breadcrumbs from "../components/layout/Breadcrumbs";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";

import {
  listTerminations, getTermination, createTermination,
  approveTermination, processTermination, getTerminationStats,
  listAllocatedEmployees, listTerminationCases, listActiveHouses,
  verifyTerminationCode, resolveInspectionIssues,
  type TerminationTransaction, type TerminationCase,
  type TerminationStats, type AllocatedEmployee,
  TERMINATION_STATUS_COLORS, TERMINATION_CATEGORY_COLORS,
} from "../services/houseApplication";

// ─── helpers ───────────────────────────────────────────────────────────

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

function StatusChip({ status, colors }: { status: string; colors: Record<string, string> }) {
  const cls = colors[status] || "bg-gray-100 text-gray-600 border-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main component ────────────────────────────────────────────────────

export default function TerminationManagement() {

  // ── state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"transactions" | "cases" | "new">("transactions");
  const [loading, setLoading] = useState(true);

  const [terminations, setTerminations] = useState<TerminationTransaction[]>([]);
  const [cases, setCases] = useState<TerminationCase[]>([]);
  const [stats, setStats] = useState<TerminationStats | null>(null);
  const [employees, setEmployees] = useState<AllocatedEmployee[]>([]);
  const [houses, setHouses] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [selectedTermination, setSelectedTermination] = useState<TerminationTransaction | null>(null);
  const [slipTarget, setSlipTarget] = useState<TerminationTransaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);

  // ── new termination form ──────────────────────────────────────────
  const [newForm, setNewForm] = useState({
    allocation_id: "",
    case_id: "",
    effective_date: "",
    reason: "",
    target_house_id: "",
    remarks: "",
  });
  const [newLoading, setNewLoading] = useState(false);
  const [newErrors, setNewErrors] = useState<string[]>([]);

  // ── approval form ─────────────────────────────────────────────────
  const [approveForm, setApproveForm] = useState({ decision: "Approved" as "Approved" | "Rejected", notes: "" });
  const [approveLoading, setApproveLoading] = useState(false);
  const [generatedAuthCode, setGeneratedAuthCode] = useState("");

  // ── verify code form ──────────────────────────────────────────────
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // ── process form ──────────────────────────────────────────────────
  const [processCode, setProcessCode] = useState("");
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState("");

  // ── resolve issues form ───────────────────────────────────────────
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveForce, setResolveForce] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);

  // ── data loading ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [terms, cs, st, emps, hs] = await Promise.all([
        listTerminations(),
        listTerminationCases(),
        getTerminationStats(),
        listAllocatedEmployees(),
        listActiveHouses(),
      ]);
      setTerminations(terms);
      setCases(cs);
      setStats(st);
      setEmployees(emps);
      setHouses(hs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── filtered list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...terminations];
    if (filterStatus !== "all") list = list.filter(t => t.status === filterStatus);
    if (filterCategory !== "all") list = list.filter(t => t.case_category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.termination_no.toLowerCase().includes(q) ||
        t.employee_name.toLowerCase().includes(q) ||
        t.employee_id.toLowerCase().includes(q) ||
        t.house_number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [terminations, filterStatus, filterCategory, search]);

  // ── selected employee allocation ──────────────────────────────────
  const selectedEmployee = useMemo(() => {
    if (!newForm.allocation_id) return null;
    return employees.find(e => e.allocation_id === newForm.allocation_id) || null;
  }, [newForm.allocation_id, employees]);

  const selectedCase = useMemo(() => {
    if (!newForm.case_id) return null;
    return cases.find(c => c.id === newForm.case_id) || null;
  }, [newForm.case_id, cases]);

  // ── needs target house ────────────────────────────────────────────
  const needsTargetHouse = selectedCase?.category === "Transfer";

  // ── available target houses ───────────────────────────────────────
  const targetHouses = useMemo(() => {
    if (!selectedEmployee) return [];
    return houses.filter(h =>
      h.house_id !== selectedEmployee.house_id && h.status === "Active"
    );
  }, [houses, selectedEmployee]);

  // ── create termination ────────────────────────────────────────────
  const handleCreate = async () => {
    const errs: string[] = [];
    if (!newForm.allocation_id) errs.push("Select an allocated employee");
    if (!newForm.case_id) errs.push("Select a termination case");
    if (!newForm.effective_date) errs.push("Effective date is required");
    if (!newForm.reason.trim()) errs.push("Termination reason is required");
    if (needsTargetHouse && !newForm.target_house_id) errs.push("Target house is required for transfers");
    if (errs.length) { setNewErrors(errs); return; }

    setNewLoading(true);
    setNewErrors([]);
    try {
      const result = await createTermination({
        allocation_id: newForm.allocation_id,
        case_id: newForm.case_id,
        effective_date: newForm.effective_date,
        reason: newForm.reason,
        target_house_id: newForm.target_house_id || undefined,
        remarks: newForm.remarks || undefined,
      });
      if (result.error) {
        setNewErrors([result.error]);
      } else {
        setShowNewDialog(false);
        setNewForm({ allocation_id: "", case_id: "", effective_date: "", reason: "", target_house_id: "", remarks: "" });
        await loadAll();
        if (result.warnings.length) {
          alert("Warnings:\n" + result.warnings.join("\n"));
        }
      }
    } finally {
      setNewLoading(false);
    }
  };

  // ── approve/reject ────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!selectedTermination) return;
    setApproveLoading(true);
    try {
      const result = await approveTermination(selectedTermination.id, approveForm.decision, approveForm.notes);
      if (result.transaction) {
        setShowApproveDialog(false);
        setApproveForm({ decision: "Approved", notes: "" });
        if (result.authorization_code) {
          setGeneratedAuthCode(result.authorization_code);
          setSelectedTermination(result.transaction);
          setShowVerifyDialog(true);
        }
        await loadAll();
      }
    } finally {
      setApproveLoading(false);
    }
  };

  // ── verify authorization code ─────────────────────────────────────
  const handleVerifyCode = async () => {
    if (!selectedTermination) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const result = await verifyTerminationCode(selectedTermination.id, verifyCode);
      if (result.success && result.transaction) {
        setSelectedTermination(result.transaction);
        setShowVerifyDialog(false);
        setVerifyCode("");
        setGeneratedAuthCode("");
        await loadAll();
      } else {
        setVerifyError(result.error || "Verification failed");
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── resolve inspection issues ─────────────────────────────────────
  const handleResolveIssues = async () => {
    if (!selectedTermination) return;
    setResolveLoading(true);
    try {
      const result = await resolveInspectionIssues(
        selectedTermination.id,
        resolveNotes,
        resolveForce,
      );
      if (result) {
        setSelectedTermination(result);
        setShowResolveDialog(false);
        setResolveNotes("");
        setResolveForce(false);
        await loadAll();
      }
    } finally {
      setResolveLoading(false);
    }
  };

  // ── process (final termination) ───────────────────────────────────
  const handleProcess = async () => {
    if (!selectedTermination) return;
    setProcessLoading(true);
    setProcessError("");
    try {
      const result = await processTermination(selectedTermination.id, processCode);
      if (result) {
        setShowProcessDialog(false);
        setProcessCode("");
        await loadAll();
      } else {
        setProcessError("Processing failed. Verify the authorization code.");
      }
    } finally {
      setProcessLoading(false);
    }
  };

  // ── helper: open process dialog ───────────────────────────────────
  const openProcessDialog = (t: TerminationTransaction) => {
    setSelectedTermination(t);
    setProcessCode("");
    setProcessError("");
    setShowProcessDialog(true);
  };

  // ── helper: open verify dialog ────────────────────────────────────
  const openVerifyDialog = (t: TerminationTransaction) => {
    setSelectedTermination(t);
    setVerifyCode("");
    setVerifyError("");
    setShowVerifyDialog(true);
  };

  // ── helper: open resolve dialog ───────────────────────────────────
  const openResolveDialog = (t: TerminationTransaction) => {
    setSelectedTermination(t);
    setResolveNotes("");
    setResolveForce(false);
    setShowResolveDialog(true);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={AlertTriangle} title="Termination Management" description="Manage housing allocation terminations, transfers, and retirements" />
      <Breadcrumbs items={[
        { label: "Housing" },
        { label: "Termination Management" },
      ]} />

      {/* ── STATS ROW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={stats?.total || 0} icon={FileText} color="bg-slate-600" />
        <StatCard label="Pending" value={stats?.pending || 0} icon={Clock3} color="bg-yellow-500" />
        <StatCard label="Approved" value={stats?.approved || 0} icon={CheckCircle2} color="bg-blue-500" />
        <StatCard label="In Progress" value={stats?.in_progress || 0} icon={ArrowRight} color="bg-purple-500" />
        <StatCard label="Completed" value={stats?.completed || 0} icon={BadgeCheck} color="bg-emerald-500" />
        <StatCard label="Rejected" value={stats?.rejected || 0} icon={XCircle} color="bg-red-500" />
      </div>

      {/* ── CASE BREAKDOWN ─────────────────────────────────────────── */}
      {stats && stats.by_case.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Termination by Case</p>
            <div className="flex flex-wrap gap-2">
              {stats.by_case.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5">
                  <span className="text-xs font-semibold">{c.case__code}</span>
                  <span className="text-xs text-muted-foreground">{c.case__name}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{c.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="flex items-center justify-between border-b px-4 pt-3">
              <TabsList>
                <TabsTrigger value="transactions" className="text-xs">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Transactions
                </TabsTrigger>
                <TabsTrigger value="cases" className="text-xs">
                  <Settings className="mr-1.5 h-3.5 w-3.5" /> Case Configuration
                </TabsTrigger>
                <TabsTrigger value="new" className="text-xs">
                  <Zap className="mr-1.5 h-3.5 w-3.5" /> New Termination
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ═══════════ TRANSACTIONS TAB ═══════════════════════════ */}
            <TabsContent value="transactions" className="p-4">
              {/* filters */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by termination #, employee, house..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[160px] text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                    <SelectItem value="Retirement">Retirement</SelectItem>
                    <SelectItem value="Release">Release</SelectItem>
                    <SelectItem value="Voluntary">Voluntary</SelectItem>
                    <SelectItem value="Disciplinary">Disciplinary</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => loadAll()} className="text-xs">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                </Button>
              </div>

              {/* table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Term. #</TableHead>
                      <TableHead className="text-xs font-semibold">Employee</TableHead>
                      <TableHead className="text-xs font-semibold">House</TableHead>
                      <TableHead className="text-xs font-semibold">Case</TableHead>
                      <TableHead className="text-xs font-semibold">Category</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Approval</TableHead>
                      <TableHead className="text-xs font-semibold">Eff. Date</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                          No termination transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((t) => (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-mono font-semibold">{t.termination_no}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium">{t.employee_name}</p>
                              <p className="text-muted-foreground">{t.employee_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium">{t.house_number}</p>
                              <p className="text-muted-foreground">{t.house_type}{t.room_label ? ` · ${t.room_label}` : ""}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{t.case_code}</TableCell>
                          <TableCell>
                            <StatusChip status={t.case_category} colors={TERMINATION_CATEGORY_COLORS} />
                          </TableCell>
                          <TableCell>
                            <StatusChip status={t.status} colors={TERMINATION_STATUS_COLORS} />
                          </TableCell>
                          <TableCell>
                            <StatusChip status={t.approval_status} colors={TERMINATION_STATUS_COLORS} />
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(t.effective_date)}</TableCell>
                          <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => { setSelectedTermination(t); setShowDetail(true); }}
                                  title="View Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {t.status === "Completed" && (
                                  <Button
                                    variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => setSlipTarget(t)}
                                    title="View Clearance Slip"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              {t.status === "Pending" && (
                                <>
                                  {t.issues_resolved === false && t.inspection_status !== "Not Required" && t.inspection_status !== "Waived" && (
                                    <Button
                                      variant="ghost" size="sm" className="h-7 text-xs text-amber-600"
                                      onClick={() => openResolveDialog(t)}
                                      title="Resolve Inspection Issues"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost" size="sm" className="h-7 text-xs"
                                    onClick={() => { setSelectedTermination(t); setShowApproveDialog(true); }}
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {t.status === "Approved" && !t.code_verified && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs text-blue-600"
                                  onClick={() => openVerifyDialog(t)}
                                  title="Verify Authorization Code"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {t.status === "Approved" && t.code_verified && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => openProcessDialog(t)}
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ═══════════ CASE CONFIGURATION TAB ═════════════════════ */}
            <TabsContent value="cases" className="p-4">
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Database-driven termination case definitions. These cases determine valid termination reasons, 
                  required inspections, approvals, and employment verification rules.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Code</TableHead>
                      <TableHead className="text-xs font-semibold">Name</TableHead>
                      <TableHead className="text-xs font-semibold">Category</TableHead>
                      <TableHead className="text-xs font-semibold">Inspection</TableHead>
                      <TableHead className="text-xs font-semibold">Approval</TableHead>
                      <TableHead className="text-xs font-semibold">Verify Employment</TableHead>
                      <TableHead className="text-xs font-semibold">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                          No termination cases configured. Cases must be created in the database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cases.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-mono font-semibold">{c.code}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium">{c.name}</p>
                              {c.description && <p className="text-muted-foreground truncate max-w-[300px]">{c.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={c.category} colors={TERMINATION_CATEGORY_COLORS} />
                          </TableCell>
                          <TableCell className="text-xs">{c.requires_inspection}</TableCell>
                          <TableCell className="text-xs">{c.requires_approval ? "Yes" : "No"}</TableCell>
                          <TableCell className="text-xs">{c.auto_verify_employment ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            {c.is_active ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Ban className="h-4 w-4 text-red-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ═══════════ NEW TERMINATION TAB ════════════════════════ */}
            <TabsContent value="new" className="p-6">
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">Important: Termination is Not a Simple Delete</p>
                      <p className="mt-1 text-amber-700 dark:text-amber-300">
                        Every termination must follow a valid case workflow. The system validates allocation existence, 
                        employee identity, employment status, house availability, and required approvals before processing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Employee Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Allocated Employee *</Label>
                  <Select
                    value={newForm.allocation_id}
                    onValueChange={(v) => setNewForm(f => ({ ...f, allocation_id: v, target_house_id: "" }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select an allocated employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.length === 0 ? (
                        <SelectItem value="none" disabled>No allocated employees found</SelectItem>
                      ) : (
                        employees.map(e => (
                          <SelectItem key={e.allocation_id} value={e.allocation_id}>
                            {e.employee_name} ({e.employee_id}) — {e.house_number}{e.room_label ? ` Room ${e.room_label}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {selectedEmployee && (
                    <div className="rounded-md border bg-muted/30 p-3 mt-2">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{selectedEmployee.employee_name}</span></div>
                        <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">{selectedEmployee.employee_id}</span></div>
                        <div><span className="text-muted-foreground">Position:</span> <span className="font-medium">{selectedEmployee.job_position}</span></div>
                        <div><span className="text-muted-foreground">Grade:</span> <span className="font-medium">{selectedEmployee.job_grade}</span></div>
                        <div><span className="text-muted-foreground">House:</span> <span className="font-medium">{selectedEmployee.house_number} ({selectedEmployee.house_type})</span></div>
                        <div><span className="text-muted-foreground">Room:</span> <span className="font-medium">{selectedEmployee.room_label || "Whole House"}</span></div>
                        <div><span className="text-muted-foreground">Allocated:</span> <span className="font-medium">{fmtDate(selectedEmployee.allocated_at)}</span></div>
                        <div><span className="text-muted-foreground">Application:</span> <span className="font-mono">{selectedEmployee.application_no}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Termination Case */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Termination Case *</Label>
                  <Select
                    value={newForm.case_id}
                    onValueChange={(v) => setNewForm(f => ({ ...f, case_id: v }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select a termination case..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.filter(c => c.is_active).length === 0 ? (
                        <SelectItem value="none" disabled>No active termination cases</SelectItem>
                      ) : (
                        cases.filter(c => c.is_active).map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            [{c.code}] {c.name} ({c.category})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {selectedCase && (
                    <div className="rounded-md border bg-muted/30 p-3 mt-2">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Code:</span> <span className="font-mono font-semibold">{selectedCase.code}</span></div>
                        <div><span className="text-muted-foreground">Category:</span> <StatusChip status={selectedCase.category} colors={TERMINATION_CATEGORY_COLORS} /></div>
                        <div><span className="text-muted-foreground">Inspection:</span> <span className="font-medium">{selectedCase.requires_inspection}</span></div>
                        <div><span className="text-muted-foreground">Approval Required:</span> <span className="font-medium">{selectedCase.requires_approval ? "Yes" : "No"}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-medium">{selectedCase.description || "—"}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target House (for transfers) */}
                {needsTargetHouse && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Target House (Transfer) *</Label>
                    <Select
                      value={newForm.target_house_id}
                      onValueChange={(v) => setNewForm(f => ({ ...f, target_house_id: v }))}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select target house..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targetHouses.length === 0 ? (
                          <SelectItem value="none" disabled>No available target houses</SelectItem>
                        ) : (
                          targetHouses.map(h => (
                            <SelectItem key={h.house_id} value={h.house_id}>
                              {h.house_number} ({h.house_type}) — {h.location || h.location}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      The previous allocation will be terminated and a new allocation will be created for the target house.
                    </p>
                  </div>
                )}

                {/* Effective Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Effective Date *</Label>
                  <Input
                    type="date"
                    value={newForm.effective_date}
                    onChange={(e) => setNewForm(f => ({ ...f, effective_date: e.target.value }))}
                    className="text-xs"
                  />
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Termination Reason *</Label>
                  <Textarea
                    placeholder="Provide a detailed reason for this termination..."
                    value={newForm.reason}
                    onChange={(e) => setNewForm(f => ({ ...f, reason: e.target.value }))}
                    className="text-xs min-h-[80px]"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Additional Remarks</Label>
                  <Textarea
                    placeholder="Optional additional notes..."
                    value={newForm.remarks}
                    onChange={(e) => setNewForm(f => ({ ...f, remarks: e.target.value }))}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Errors */}
                {newErrors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    {newErrors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700 flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 shrink-0" /> {err}
                      </p>
                    ))}
                  </div>
                )}

                {/* Submit */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewForm({ allocation_id: "", case_id: "", effective_date: "", reason: "", target_house_id: "", remarks: "" });
                      setNewErrors([]);
                    }}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={newLoading}
                    className="text-xs"
                  >
                    {newLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Create Termination Transaction
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ═══════════ DETAIL DIALOG ═════════════════════════════════════ */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Termination Transaction — {selectedTermination?.termination_no}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            {selectedTermination && (
              <div className="space-y-4 p-1">
                {/* Status Row */}
                <div className="flex flex-wrap gap-2">
                  <StatusChip status={selectedTermination.status} colors={TERMINATION_STATUS_COLORS} />
                  <StatusChip status={selectedTermination.approval_status} colors={TERMINATION_STATUS_COLORS} />
                  <StatusChip status={selectedTermination.handover_status} colors={TERMINATION_STATUS_COLORS} />
                  <StatusChip status={selectedTermination.inspection_status} colors={TERMINATION_STATUS_COLORS} />
                </div>

                {/* Employee Info */}
                <Section title="Employee Information" color="bg-blue-600">
                  <InfoRow label="Employee" value={`${selectedTermination.employee_name} (${selectedTermination.employee_id})`} />
                  <InfoRow label="Application" value={selectedTermination.application_no} />
                  <InfoRow label="Allocation" value={selectedTermination.allocation_no} />
                </Section>

                {/* House Info */}
                <Section title="Current House" color="bg-indigo-600">
                  <InfoRow label="House Number" value={selectedTermination.house_number} />
                  <InfoRow label="Category" value={selectedTermination.house_type} />
                  <InfoRow label="Room" value={selectedTermination.room_label || "Whole House"} />
                  <InfoRow label="Resource" value={selectedTermination.house_resource} />
                </Section>

                {/* Termination Details */}
                <Section title="Termination Details" color="bg-amber-600">
                  <InfoRow label="Case" value={`${selectedTermination.case_code} — ${selectedTermination.case_name}`} />
                  <InfoRow label="Category" value={selectedTermination.case_category} />
                  <InfoRow label="Reason" value={selectedTermination.termination_reason} />
                  <InfoRow label="Effective Date" value={fmtDate(selectedTermination.effective_date)} />
                  <InfoRow label="Requested Date" value={fmtDate(selectedTermination.requested_date)} />
                  <InfoRow label="Release Date" value={fmtDate(selectedTermination.house_release_date)} />
                  <InfoRow label="Remarks" value={selectedTermination.remarks || "—"} />
                </Section>

                {/* Transfer Target */}
                {selectedTermination.case_category === "Transfer" && selectedTermination.target_house_number && (
                  <Section title="Transfer Target" color="bg-purple-600">
                    <InfoRow label="Target House" value={selectedTermination.target_house_number} />
                  </Section>
                )}

                {/* Approval */}
                <Section title="Approval" color="bg-teal-600">
                  <InfoRow label="Approval Status" value={selectedTermination.approval_status} />
                  <InfoRow label="Approved By" value={selectedTermination.approved_by_name || "—"} />
                  <InfoRow label="Approval Date" value={fmtDateTime(selectedTermination.approval_date)} />
                  <InfoRow label="Notes" value={selectedTermination.approval_notes || "—"} />
                </Section>

                {/* Handover */}
                <Section title="Handover & Inspection" color="bg-cyan-600">
                  <InfoRow label="Handover Status" value={selectedTermination.handover_status} />
                  <InfoRow label="Inspection Status" value={selectedTermination.inspection_status} />
                  <InfoRow label="Issues Resolved" value={selectedTermination.issues_resolved ? "Yes" : "No"} />
                  <InfoRow label="Handover Completed" value={selectedTermination.handover_completed ? "Yes" : "No"} />
                  <InfoRow label="Damage Costs" value={`ETB ${selectedTermination.damage_costs.toLocaleString()}`} />
                  <InfoRow label="Outstanding Issues" value={selectedTermination.outstanding_issues || "—"} />
                </Section>

                {/* Inspection Baseline */}
                {selectedTermination.inspection_baseline && Object.keys(selectedTermination.inspection_baseline).length > 0 && (
                  <Section title="Inspection Baseline Snapshot" color="bg-rose-600">
                    {selectedTermination.inspection_baseline.has_any_damage !== undefined && (
                      <InfoRow
                        label="Damage at Baseline"
                        value={selectedTermination.inspection_baseline.has_any_damage ? "Yes — damage detected" : "No damage"}
                      />
                    )}
                    {selectedTermination.inspection_baseline.open_maintenance_count !== undefined && (
                      <InfoRow label="Open Maintenance (at snapshot)" value={String(selectedTermination.inspection_baseline.open_maintenance_count)} />
                    )}
                    {selectedTermination.inspection_baseline.latest_inspection?.findings && (
                      <InfoRow label="Latest Inspection Findings" value={selectedTermination.inspection_baseline.latest_inspection.findings} />
                    )}
                    {selectedTermination.inspection_baseline.latest_inspection?.damage_costs !== undefined && (
                      <InfoRow label="Inspection Damage Costs" value={`ETB ${selectedTermination.inspection_baseline.latest_inspection.damage_costs}`} />
                    )}
                    <InfoRow label="Snapshot Time" value={fmtDateTime(selectedTermination.inspection_baseline.snapshot_at)} />
                  </Section>
                )}

                {/* Inspection Discrepancies */}
                {selectedTermination.inspection_discrepancies && selectedTermination.inspection_discrepancies.length > 0 && (
                  <Section title="Inspection Discrepancies" color="bg-red-600">
                    {selectedTermination.inspection_discrepancies.map((d: any, i: number) => (
                      <div key={i} className="flex items-start px-3 py-2 text-xs">
                        <span className={`w-16 shrink-0 font-semibold ${
                          d.severity === "critical" ? "text-red-600" :
                          d.severity === "warning" ? "text-amber-600" : "text-muted-foreground"
                        }`}>
                          {d.severity?.toUpperCase()}
                        </span>
                        <span className="flex-1 break-words">{d.description}</span>
                      </div>
                    ))}
                  </Section>
                )}

                {/* Authorization Code */}
                <Section title="Authorization & Security" color="bg-violet-600">
                  <InfoRow label="Authorization Code" value={selectedTermination.authorization_code || "Not generated"} />
                  <InfoRow label="Code Generated By" value={selectedTermination.code_generated_by_name || "—"} />
                  <InfoRow label="Code Generated At" value={fmtDateTime(selectedTermination.code_generated_at)} />
                  <InfoRow label="Code Verified" value={selectedTermination.code_verified ? "Yes" : "No"} />
                  <InfoRow label="Code Verified By" value={selectedTermination.code_verified_by_name || "—"} />
                  <InfoRow label="Code Verified At" value={fmtDateTime(selectedTermination.code_verified_at)} />
                </Section>

                {/* Metadata */}
                <Section title="Record Information" color="bg-slate-600">
                  <InfoRow label="Created By" value={selectedTermination.created_by_name || "—"} />
                  <InfoRow label="Created" value={fmtDateTime(selectedTermination.created_at)} />
                  <InfoRow label="Updated" value={fmtDateTime(selectedTermination.updated_at)} />
                </Section>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)} className="text-xs">Close</Button>
            {selectedTermination?.status === "Completed" && (
              <Button onClick={() => { setShowDetail(false); setSlipTarget(selectedTermination); }} className="text-xs bg-green-600 hover:bg-green-700">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Clearance Slip
              </Button>
            )}
            {selectedTermination?.status === "Pending" && (
              <>
                {selectedTermination?.issues_resolved === false && selectedTermination?.inspection_status !== "Not Required" && selectedTermination?.inspection_status !== "Waived" && (
                  <Button variant="outline" onClick={() => { setShowDetail(false); openResolveDialog(selectedTermination); }} className="text-xs text-amber-600 border-amber-300">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve Inspection Issues
                  </Button>
                )}
                <Button onClick={() => { setShowDetail(false); setShowApproveDialog(true); }} className="text-xs">
                  <Shield className="mr-1.5 h-3.5 w-3.5" /> Approve / Reject
                </Button>
              </>
            )}
            {selectedTermination?.status === "Approved" && !selectedTermination?.code_verified && (
              <Button onClick={() => { setShowDetail(false); openVerifyDialog(selectedTermination); }} className="text-xs bg-blue-600 hover:bg-blue-700">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Verify Authorization Code
              </Button>
            )}
            {selectedTermination?.status === "Approved" && selectedTermination?.code_verified && (
              <Button onClick={() => { setShowDetail(false); openProcessDialog(selectedTermination); }} className="text-xs bg-green-600 hover:bg-green-700">
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Process Termination
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ APPROVE/REJECT DIALOG ═══════════════════════════ */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {approveForm.decision === "Approved" ? "Approve" : "Reject"} Termination — {selectedTermination?.termination_no}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Decision *</Label>
              <Select
                value={approveForm.decision}
                onValueChange={(v) => setApproveForm(f => ({ ...f, decision: v as "Approved" | "Rejected" }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approve</SelectItem>
                  <SelectItem value="Rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notes</Label>
              <Textarea
                placeholder="Approval/rejection notes..."
                value={approveForm.notes}
                onChange={(e) => setApproveForm(f => ({ ...f, notes: e.target.value }))}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleApprove} disabled={approveLoading} className="text-xs">
              {approveLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {approveForm.decision === "Approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ VERIFY AUTHORIZATION CODE DIALOG ════════════════ */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-600" />
              Verify Authorization Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-blue-50 p-3 dark:bg-blue-950/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Enter the termination authorization code that was generated during approval.
                This code is required before the termination can be processed.
              </p>
            </div>
            {generatedAuthCode && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/20">
                <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Generated Authorization Code:</p>
                <p className="text-xs font-mono break-all text-green-800 dark:text-green-200">{generatedAuthCode}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                  Copy this code and paste it below to verify. This code will not be shown again.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Authorization Code *</Label>
              <Input
                placeholder="TERM-AUTH-..."
                value={verifyCode}
                onChange={(e) => { setVerifyCode(e.target.value); setVerifyError(""); }}
                className="text-xs font-mono"
              />
              {verifyError && (
                <p className="text-xs text-red-600">{verifyError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleVerifyCode} disabled={verifyLoading || !verifyCode.trim()} className="text-xs bg-blue-600 hover:bg-blue-700">
              {verifyLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Verify Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ RESOLVE INSPECTION ISSUES DIALOG ════════════════ */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
              Resolve Inspection Issues
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 p-1">
              <div className="rounded-md border bg-amber-50 p-3 dark:bg-amber-950/20">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Before termination can be approved, all critical inspection discrepancies must be resolved.
                  Review the current discrepancies below and confirm resolution.
                </p>
              </div>

              {/* Current discrepancies */}
              {selectedTermination?.inspection_discrepancies && selectedTermination.inspection_discrepancies.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Current Discrepancies</Label>
                  {selectedTermination.inspection_discrepancies.map((d: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 rounded border p-2 text-xs">
                      <span className={`shrink-0 font-semibold ${
                        d.severity === "critical" ? "text-red-600" :
                        d.severity === "warning" ? "text-amber-600" : "text-muted-foreground"
                      }`}>
                        [{d.severity?.toUpperCase()}]
                      </span>
                      <span className="flex-1">{d.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {(!selectedTermination?.inspection_discrepancies || selectedTermination.inspection_discrepancies.length === 0) && (
                <div className="rounded-md border bg-green-50 p-3 dark:bg-green-950/20">
                  <p className="text-xs text-green-700 dark:text-green-300">No discrepancies found. All issues are clear.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Resolution Notes</Label>
                <Textarea
                  placeholder="Describe how the issues were resolved..."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="text-xs"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="force-resolve"
                  checked={resolveForce}
                  onChange={(e) => setResolveForce(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="force-resolve" className="text-xs text-muted-foreground">
                  Force resolve (admin override — skip critical discrepancy check)
                </Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleResolveIssues} disabled={resolveLoading} className="text-xs bg-amber-600 hover:bg-amber-700">
              {resolveLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ PROCESS DIALOG ═══════════════════════════════════ */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" />
              Process Termination — {selectedTermination?.termination_no}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-amber-50 p-3 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">This action will:</p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5">
                    <li>Close the active allocation ({selectedTermination?.allocation_no})</li>
                    <li>Release house {selectedTermination?.house_number}{selectedTermination?.room_label ? ` Room ${selectedTermination.room_label}` : ""}</li>
                    <li>Update house occupancy and availability</li>
                    {selectedTermination?.case_category === "Transfer" && (
                      <li className="font-semibold">Create new allocation for the target house</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Authorization Code *</Label>
              <Input
                placeholder="Paste the verified authorization code..."
                value={processCode}
                onChange={(e) => { setProcessCode(e.target.value); setProcessError(""); }}
                className="text-xs font-mono"
              />
              {processError && (
                <p className="text-xs text-red-600">{processError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)} className="text-xs">Cancel</Button>
            <Button
              onClick={handleProcess}
              disabled={processLoading || !processCode.trim()}
              className="text-xs bg-green-600 hover:bg-green-700"
            >
              {processLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              <Zap className="mr-1.5 h-3.5 w-3.5" /> Confirm & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clearance Slip modal ──────────────────────────────────── */}
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

// ─── sub-components ────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className={`${color} px-3 py-1.5`}>
        <p className="text-xs font-semibold text-white">{title}</p>
      </div>
      <div className="divide-y bg-background">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start px-3 py-2 text-xs">
      <span className="w-40 shrink-0 text-muted-foreground font-medium">{label}</span>
      <span className="flex-1 break-words">{value}</span>
    </div>
  );
}
