import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveData } from "@/hooks/useLiveData";
import { toast } from "sonner";
import {
  Users2, Edit, Trash2, Upload, Download, FileText, Loader2, Plus,
  UserCheck, UserX, Clock, HeartHandshake, ShieldCheck,
  Maximize2, Minimize2, MapPin, Building, AlertCircle, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import MetricCard from "@/components/ui/metric-card";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { EmployeeActionsDropdown } from "@/components/employees/EmployeeActionsDropdown";
import { PrintModal } from '@/components/common/PrintModal';
import { employeePrintHTML } from '@/lib/printUtils';
import { logActivity } from "@/services/activity";
import { trackActivity } from "@/services/notifications";
import { listDepartments } from "@/services/departments";
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  bulkImportEmployees, type Employee, type EmployeeFormData,
} from "@/services/employees";
import { invalidateCache } from "@/lib/data-cache";
import { API_BASE_URL } from "@/services/djangoAuth";

type DeptOption = { id: string; name: string };

const EMPTY_FORM: EmployeeFormData = {
  employee_id: "", full_name: "", national_id: "", job_position: "", job_grade: "", job_type: "Permanent",
  department: null, hire_date: null, family_size: 0, marital_status: "Single", has_disability: false, status: "Active", cv_file: null,
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Active"   ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400" :
    status === "On Leave" ? "bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400" :
                            "bg-rose-500/10 text-rose-700 border-rose-400/30 dark:text-rose-400";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

// ── Superuser password dialog ──────────────────────────────────────────────
function SuperuserDialog({ open, onClose, onConfirm, title, description, confirmLabel }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; confirmLabel: string;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) { setPassword(""); setError(null); setLoading(false); setShow(false); } }, [open]);
  const verify = async () => {
    if (!password) { setError("Password is required."); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("django_access_token");
      if (!token) { setError("Not logged in."); setLoading(false); return; }
      const res = await fetch(`${API_BASE_URL}/auth/verify-superuser/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json?.success && json?.data?.valid) { setLoading(false); onConfirm(); }
      else { setError(json?.message || "Incorrect password or insufficient privileges."); setLoading(false); }
    } catch { setError("Could not reach server."); setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><ShieldCheck className="h-4 w-4" /></span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Admin Password</Label>
            <div className="relative">
              <Input type={show ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(null); }}
                onKeyDown={e => e.key === "Enter" && verify()} placeholder="Enter your admin password" disabled={loading} autoFocus />
              <button type="button" onClick={() => setShow(p => !p)} className="absolute inset-y-0 right-2.5 text-xs text-muted-foreground hover:text-foreground px-1">{show ? "Hide" : "Show"}</button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={verify} disabled={loading || !password}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [role] = useState<string>(() => {
    try { const r = localStorage.getItem("auth_user"); return r ? (JSON.parse(r).role ?? "").toLowerCase() : ""; } catch { return ""; }
  });

  // ── Live data (stale-while-revalidate — no blocking spinner) ───────────
  // Invalidate stale cache on mount so fields always load fresh
  useEffect(() => {
    invalidateCache("employees:list");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: employeeData, loading, refresh: refreshEmployees } = useLiveData<Employee[]>(
    "employees:list",
    () => listEmployees(),
    [],
  );
  const employees = employeeData ?? [];

  // Filters
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add/Edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const bulkRef = useRef<HTMLInputElement>(null);

  // Selection
  const [selectedRows, setSelectedRows] = useState<Employee[]>([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState('');

  // Superuser dialog
  const [suDialog, setSuDialog] = useState({ open: false, title: "", description: "", confirmLabel: "", onConfirm: () => {} });
  const requireSu = (title: string, description: string, confirmLabel: string) =>
    new Promise<boolean>(resolve => setSuDialog({ open: true, title, description, confirmLabel, onConfirm: () => { setSuDialog(p => ({ ...p, open: false })); resolve(true); } }));

  // ── Bootstrap departments ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const depts = await listDepartments();
        setDepartments(depts.map((d: any) => ({ id: String(d.id), name: d.name })));
      } catch {
        try {
          const { djangoRequest } = await import("@/services/djangoAuth");
          const res = await djangoRequest<any[]>("/departments/");
          if (res.success) setDepartments((res.data || []).map((d: any) => ({ id: String(d.id), name: d.name })));
        } catch { setDepartments([]); }
      }
    })();
  }, []);

  // ── Filtered data ──────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    employees.filter(e => {
      const matchDept = deptFilter === "all" || (e.department ?? "") === deptFilter;
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      return matchDept && matchStatus;
    }),
  [employees, deptFilter, statusFilter]);

  const metrics = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.status === "Active").length,
    onLeave: employees.filter(e => e.status === "On Leave").length,
    terminated: employees.filter(e => e.status === "Terminated").length,
    disabled: employees.filter(e => e.has_disability).length,
  }), [employees]);

  const isAdmin = role === "admin";

  // ── Column definitions ─────────────────────────────────────────────────
  const columns = useMemo((): ColDef<Employee>[] => [
    {
      key: "employee_id", header: "ID", sortable: true, width: "w-28", pinned: true,
      value: e => e.employee_id,
      cell: e => (
        <span className="font-mono text-xs font-semibold text-primary tracking-widest">
          {e.employee_id || "—"}
        </span>
      ),
    },
    {
      key: "full_name", header: "Full Name", sortable: true, width: "min-w-[180px]",
      value: e => e.full_name,
      cell: e => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {e.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <p className="font-medium truncate">{e.full_name}</p>
        </div>
      ),
    },
    {
      key: "national_id", header: "National ID", sortable: true, width: "w-40",
      value: e => e.national_id,
      cell: e => (
        <span className="font-mono text-xs font-medium tracking-wide">
          {e.national_id || <span className="text-muted-foreground/40">—</span>}
        </span>
      ),
    },
    {
      key: "job_position", header: "Position", sortable: true,
      value: e => e.job_position,
      cell: e => <span className="text-sm">{e.job_position || "—"}</span>,
    },
    {
      key: "job_grade", header: "Grade", width: "w-20",
      value: e => e.job_grade,
      cell: e => e.job_grade ? <Badge variant="outline" className="text-xs font-mono">{e.job_grade}</Badge> : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "job_type", header: "Job Type", sortable: true, width: "w-32",
      value: e => e.job_type,
      cell: e => {
        const colors: Record<string, string> = {
          Permanent: "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400",
          "Semi Permanent": "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400",
          Seasonal: "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400",
        };
        return e.job_type
          ? <Badge variant="outline" className={`text-xs font-medium ${colors[e.job_type] || ""}`}>{e.job_type}</Badge>
          : <span className="text-muted-foreground/50">—</span>;
      },
    },
    {
      key: "department_name", header: "Department", sortable: true,
      value: e => e.department_name,
      cell: e => e.department_name
        ? <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-xs font-medium">{e.department_name}</span>
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "hire_date", header: "Hire Date", sortable: true, width: "w-28",
      value: e => e.hire_date,
      cell: e => <span className="tabular-nums text-xs">{e.hire_date ?? "—"}</span>,
    },
    {
      key: "service_years", header: "Service", width: "w-28", align: "center",
      value: e => e.service_duration || `${e.service_years} yrs`,
      cell: e => (
        <span className="tabular-nums text-xs font-medium">
          {e.service_duration || (e.service_years ? `${e.service_years} yrs` : <span className="text-muted-foreground/40">—</span>)}
        </span>
      ),
    },
    {
      key: "family_size", header: "Family", width: "w-16", align: "center", defaultHidden: true,
      value: e => e.family_size,
      cell: e => <span className="tabular-nums text-xs">{e.family_size}</span>,
    },
    {
      key: "has_disability", header: "Disability", width: "w-24", align: "center",
      value: e => e.has_disability ? "Yes" : "No",
      cell: e => e.has_disability
        ? <Badge className="bg-violet-500/10 text-violet-700 border-violet-400/30 dark:text-violet-400 text-xs border">Yes</Badge>
        : <span className="text-muted-foreground/40 text-xs">No</span>,
    },
    {
      key: "status", header: "Status", sortable: true, width: "w-28",
      value: e => e.status,
      cell: e => <StatusBadge status={e.status} />,
    },
    {
      key: "cv_file", header: "CV", width: "w-16", align: "center",
      value: e => e.cv_file ? "Yes" : "",
      cell: e => e.cv_file
        ? <a href={e.cv_file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileText className="h-3.5 w-3.5" />View</a>
        : <span className="text-muted-foreground/40 text-xs">—</span>,
    },
    ...(isAdmin ? [{
      key: "actions", header: "", width: "w-20", pinned: true, align: "right" as const,
      cell: (emp: Employee) => (
        <EmployeeActionsDropdown
          onEdit={() => openEdit(emp)}
          onDelete={() => setDeleteTarget(emp)}
          onPrint={() => handlePrintEmployee(emp)}
          canEdit={isAdmin}
          canDelete={isAdmin}
        />
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); if (cvInputRef.current) cvInputRef.current.value = ""; setDialogOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({ employee_id: emp.employee_id, full_name: emp.full_name, national_id: emp.national_id, job_position: emp.job_position, job_grade: emp.job_grade, job_type: emp.job_type || "Permanent", department: emp.department, hire_date: emp.hire_date, family_size: emp.family_size, marital_status: emp.marital_status || "Single", has_disability: emp.has_disability, status: emp.status, cv_file: null });
    if (cvInputRef.current) cvInputRef.current.value = "";
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.employee_id.trim()) { toast.error("Employee ID is required — it must be entered manually."); return; }
    if (!form.full_name.trim() || !form.national_id.trim() || !form.job_position.trim()) { toast.error("Full name, national ID and position are required."); return; }
    if (!form.department) { toast.error("Department is required."); return; }
    const ok = await requireSu(editingId ? "Authorise update" : "Authorise creation", editingId ? "Superuser password required to update this employee record." : "Superuser password required to create a new employee.", editingId ? "Save Changes" : "Create Employee");
    if (!ok) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateEmployee(editingId, form);
        await refreshEmployees();
        toast.success("Employee updated");
        await logActivity("employee_updated", `${updated.full_name} updated`);
        trackActivity("user", "update", { entityName: updated.full_name, entityId: updated.employee_id }).catch(() => {});
      } else {
        const created = await createEmployee(form);
        await refreshEmployees();
        toast.success(`${created.employee_id} created`);
        await logActivity("employee_created", `${created.full_name} created`);
        trackActivity("user", "create", { entityName: created.full_name, entityId: created.employee_id }).catch(() => {});
      }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handlePrintEmployee = (emp: Employee) => {
    // Placeholder print logic – you can replace with custom PDF generation or printable view
    const html = employeePrintHTML(emp);
    setPrintHtml(html);
    setPrintOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await requireSu("Authorise deletion", `Superuser password required to permanently delete ${deleteTarget.full_name}.`, "Delete Permanently");
    if (!ok) { setDeleteTarget(null); return; }
    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      await refreshEmployees();
      toast.success(`${deleteTarget.employee_id} deleted`);
      await logActivity("employee_deleted", `${deleteTarget.full_name} deleted`);
      trackActivity("user", "delete", { entityName: deleteTarget.full_name, entityId: deleteTarget.employee_id }).catch(() => {});
      setDeleteTarget(null);
    } catch (e: any) { toast.error(e.message || "Failed to delete"); }
    finally { setDeleting(false); }
  };

  const handleBulkDelete = async () => {
    if (!selectedRows.length) return;
    const ok = await requireSu("Authorise bulk deletion", `Superuser password required to delete ${selectedRows.length} employee(s).`, "Delete Selected");
    if (!ok) return;
    let done = 0;
    for (const emp of selectedRows) {
      try { await deleteEmployee(emp.id); done++; } catch {}
    }
    await refreshEmployees();
    toast.success(`${done} employee(s) deleted`);
    setSelectedRows([]);
  };

  const downloadTemplate = () => {
    const t = [{ employee_id: "", full_name: "", national_id: "", job_position: "", job_grade: "", job_type: "Permanent", department: "", hire_date: "", family_size: 0, marital_status: "Single", has_disability: false, status: "Active" }];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" })); a.download = "SAMS_Employee_Template.json"; a.click(); URL.revokeObjectURL(a.href); a.remove();
  };

  const handleBulkImport = async () => {
    if (!bulkFile) { toast.error("Select a JSON file."); return; }
    const ok = await requireSu("Authorise bulk import", "Superuser password required to bulk-import employee records.", "Import");
    if (!ok) return;
    setBulkImporting(true); setBulkProgress(20); setBulkResult(null);
    try {
      const parsed = JSON.parse(await bulkFile.text());
      const rows = Array.isArray(parsed) ? parsed : (parsed.employees ?? []);
      setBulkProgress(50);
      const result = await bulkImportEmployees(rows);
      setBulkProgress(100); setBulkResult(result);
      if (result.errors.length) toast.info(`${result.created} created, ${result.skipped} skipped.`);
      else toast.success(`${result.created} imported.`);
      await refreshEmployees();
    } catch (e: any) { toast.error(e.message || "Import failed"); }
    finally { setBulkImporting(false); setTimeout(() => setBulkProgress(0), 800); if (bulkRef.current) bulkRef.current.value = ""; setBulkFile(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6 pb-10">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Employees" }]} />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm">
          <div className="relative z-10 max-w-3xl space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Employee Management | የሰራተኞች አስተዳደር</h1>
            <p className="text-muted-foreground">Workforce records, service history and HR data — {metrics.total} employees total.</p>
          </div>
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard icon={Users2}         title="Total"      value={metrics.total}      variant="blue"    caption="All employees" />
          <MetricCard icon={UserCheck}      title="Active"     value={metrics.active}     variant="emerald" caption="Currently working" />
          <MetricCard icon={Clock}          title="On Leave"   value={metrics.onLeave}    variant="amber"   caption="Temporary absence" />
          <MetricCard icon={UserX}          title="Terminated" value={metrics.terminated} variant="rose"    caption="No longer employed" />
          <MetricCard icon={HeartHandshake} title="Disability" value={metrics.disabled}   variant="violet"  caption="Registered" />
        </div>

        {/* DataTable */}
        <DataTable<Employee>
          tableKey="employees-v2"
          columns={columns}
          data={filtered}
          rowKey={e => e.id}
          loading={loading}
          emptyMessage="No employees found"
          emptyIcon={<Users2 className="h-10 w-10 opacity-20" />}
          selectable={isAdmin}
          onSelectionChange={setSelectedRows}
          searchable
          searchPlaceholder="Search name, ID, position, department…"
          exportFileName="SAMS_Employees"
          pageSize={25}
          onRowDoubleClick={(e) => navigate(`/employees/${e.id}`)}
          recordDetail={{
            title: (e) => e.full_name,
            subtitle: (e) => e.job_position || "",
            icon: Users2,
            badge: (e) => <StatusBadge status={e.status} />,
          }}
          toolbarLeft={
            <div className="flex gap-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.filter(d => d.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          toolbarRight={
            isAdmin ? (
              <div className="flex gap-1.5">
                {selectedRows.length > 0 && (
                  <Button size="sm" variant="destructive" className="h-8 gap-1.5 text-xs" onClick={handleBulkDelete}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete {selectedRows.length}
                  </Button>
                )}
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { setBulkResult(null); setBulkOpen(true); }}><Upload className="h-3.5 w-3.5" /> Import</Button>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setExpanded(false); }}>
        <DialogContent className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-200",
          expanded
            ? "w-full h-full max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg"
            : "sm:max-w-2xl max-h-[90vh]"
        )}>
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-14 text-left border-b border-border/60 bg-muted/10 px-6 py-5">
            <div className="space-y-0.5">
              <DialogTitle>{editingId ? "Edit Employee" : "New Employee"}</DialogTitle>
              <DialogDescription>{editingId ? "Update employee details." : "Register a new employee."}</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse" : "Expand"}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users2 className="h-4 w-4 text-primary" />
                Personal Information
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee ID <span className="text-destructive">*</span></Label>
                  <Input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value.toUpperCase() })} placeholder="EMP-00001" />
                  <p className="text-[11px] text-muted-foreground">Entered by HR — never auto-generated.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Marital Status</Label>
                  <Select value={form.marital_status} onValueChange={v => setForm({ ...form, marital_status: v })}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name <span className="text-destructive">*</span></Label>
                  <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full legal name" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">National ID <span className="text-destructive">*</span></Label>
                  <Input value={form.national_id} onChange={e => setForm({ ...form, national_id: e.target.value })} placeholder="1234567890" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Position <span className="text-destructive">*</span></Label>
                  <Input value={form.job_position} onChange={e => setForm({ ...form, job_position: e.target.value })} placeholder="Software Engineer" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Grade</Label>
                  <Input value={form.job_grade} onChange={e => setForm({ ...form, job_grade: e.target.value })} placeholder="G5" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department <span className="text-destructive">*</span></Label>
                  <Select value={form.department ?? "__none__"} onValueChange={v => setForm({ ...form, department: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{departments.filter(d => d.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hire Date</Label>
                  <Input type="date" value={form.hire_date ?? ""} onChange={e => setForm({ ...form, hire_date: e.target.value || null })} />
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-primary" />
                Employment Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Type</Label>
                  <Select value={form.job_type} onValueChange={v => setForm({ ...form, job_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Permanent">Permanent</SelectItem>
                      <SelectItem value="Semi Permanent">Semi Permanent</SelectItem>
                      <SelectItem value="Seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Family Size</Label>
                  <Input type="number" min={0} value={form.family_size} onChange={e => setForm({ ...form, family_size: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status <span className="text-destructive">*</span></Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="On Leave">On Leave</SelectItem><SelectItem value="Terminated">Terminated</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Disability</Label>
                  <div className="flex items-center gap-2 h-10"><Checkbox id="dis" checked={form.has_disability} onCheckedChange={v => setForm({ ...form, has_disability: Boolean(v) })} /><label htmlFor="dis" className="text-sm text-muted-foreground cursor-pointer select-none">Registered disability</label></div>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Documents
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CV / Resume (PDF, DOC)</Label>
                <Input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" onChange={e => setForm({ ...form, cv_file: e.target.files?.[0] ?? null })} />
                {editingId && !form.cv_file && <p className="text-xs text-muted-foreground">Leave blank to keep existing file.</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2 rounded-xl">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save Changes" : "Create Employee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.employee_id}). Superuser password required next.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Import */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk Import Employees</DialogTitle><DialogDescription>Upload JSON. Download template for required format.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
              <div className="text-sm"><p className="font-medium">Download Template</p><p className="text-xs text-muted-foreground">JSON with sample row</p></div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadTemplate}><Download className="h-3.5 w-3.5" /> Download</Button>
            </div>
            <div className="space-y-2"><Label>JSON File</Label><Input ref={bulkRef} type="file" accept=".json" disabled={bulkImporting} onChange={e => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }} /></div>
            {bulkProgress > 0 && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>{bulkImporting ? "Importing…" : "Done"}</span><span>{bulkProgress}%</span></div><Progress value={bulkProgress} className="h-2" /></div>}
            {bulkResult && <div className="rounded-lg border border-emerald-400/40 bg-emerald-100/20 px-4 py-3 text-sm">Created: <strong>{bulkResult.created}</strong> · Skipped: <strong>{bulkResult.skipped}</strong></div>}
            {(bulkResult?.errors.length ?? 0) > 0 && <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive space-y-1"><p className="font-semibold mb-1">Errors ({bulkResult!.errors.length}):</p>{bulkResult!.errors.map((e, i) => <p key={i}>Row {e.row}: {e.message}</p>)}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkImporting}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={bulkImporting || !bulkFile}>{bulkImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Superuser dialog */}
      <SuperuserDialog open={suDialog.open} onClose={() => setSuDialog(p => ({ ...p, open: false }))} onConfirm={suDialog.onConfirm} title={suDialog.title} description={suDialog.description} confirmLabel={suDialog.confirmLabel} />
    </>
  );
}
