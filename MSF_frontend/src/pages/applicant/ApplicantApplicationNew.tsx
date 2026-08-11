import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Save,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  createApplication,
  getApplication,
  updateApplication,
  validateEmployeeId,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  HOUSE_CATEGORIES,
  POSITION_TYPE_OPTIONS,
  JOB_TYPE_OPTIONS,
  type HouseApplication,
} from "@/services/houseApplication";

const EMPTY_FORM = {
  employee_id: "",
  employee_name: "",
  national_id: "",
  gender: "",
  job_position: "",
  job_grade: "",
  job_type: "Permanent",
  position_type: "",
  years_of_service: 0,
  marital_status: "",
  has_disability: false,
  family_size: 1,
  requested_house_category: "",
  reason_for_request: "",
  preferred_location: "",
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-slate-500/10 text-slate-700 border-slate-300",
  Submitted: "bg-blue-500/10 text-blue-700 border-blue-300",
  "Under Review": "bg-amber-500/10 text-amber-700 border-amber-300",
  Verified: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  "Waiting for Allocation":
    "bg-violet-500/10 text-violet-700 border-violet-300",
  Allocated: "bg-green-500/10 text-green-700 border-green-300",
  Rejected: "bg-rose-500/10 text-rose-700 border-rose-300",
  Returned: "bg-orange-500/10 text-orange-700 border-orange-300",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ApplicantApplicationNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const isEditMode = Boolean(editId);

  const authUser = useMemo(() => getStoredAuthUser(), []);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [application, setApplication] = useState<HouseApplication | null>(null);
  const [employeeChecking, setEmployeeChecking] = useState(false);
  const [hasActiveAllocation, setHasActiveAllocation] = useState(false);
  const [allocationInfo, setAllocationInfo] = useState<string | null>(null);

  const canEdit =
    !application ||
    application.status === "Draft" ||
    application.status === "Returned";

  const set = (field: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "marital_status" && value === "Single") {
        next.family_size = 1;
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleEmployeeIdBlur = async () => {
    if (!canEdit) return;
    const id = form.employee_id.trim();
    if (!id) return;
    setEmployeeChecking(true);
    try {
      const result = await validateEmployeeId(id);
      if (!result.valid) {
        setHasActiveAllocation(false);
        setAllocationInfo(null);
        setErrors((prev) => ({ ...prev, employee_id: `Employee ID "${id}" not found in the system. Please verify your ID.` }));
      } else {
        if (result.employee) {
          const emp = result.employee;
          setForm((prev) => ({
            ...prev,
            employee_id: emp.employee_id || prev.employee_id,
            employee_name: emp.full_name || prev.employee_name,
            national_id: emp.national_id || prev.national_id,
            job_position: emp.job_position || prev.job_position,
            job_grade: emp.job_grade || prev.job_grade,
            job_type: emp.job_type || prev.job_type,
            position_type: prev.position_type || emp.job_type || "Permanent",
            years_of_service: emp.service_years ?? prev.years_of_service,
            marital_status: emp.marital_status || prev.marital_status,
            has_disability: emp.has_disability ?? prev.has_disability,
            family_size: emp.family_size ?? prev.family_size,
          }));
          toast.success("Employee details loaded");
        }

        if (result.has_active_allocation) {
          setHasActiveAllocation(true);
          setAllocationInfo(result.allocation_info || null);
          setErrors((prev) => ({
            ...prev,
            employee_id: result.error_message || "Employee already has an active house allocation and cannot submit a new application.",
          }));
        } else {
          setHasActiveAllocation(false);
          setAllocationInfo(null);
          setErrors((prev) => ({ ...prev, employee_id: "" }));
        }
      }
    } finally {
      setEmployeeChecking(false);
    }
  };

  useEffect(() => {
    if (!editId) {
      setApplication(null);
      setForm({ ...EMPTY_FORM });
      setFile(null);
      setErrors({});
      return;
    }

    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const data = await getApplication(editId);
        if (!active) return;
        setApplication(data);
        setForm({
          employee_id: data.employee_id || "",
          employee_name: data.employee_name || "",
          national_id: data.national_id || "",
          gender: data.gender || "",
          job_position: data.job_position || "",
          job_grade: data.job_grade || "",
          job_type: data.job_type || "Permanent",
          position_type: data.position_type || "",
          years_of_service: data.years_of_service ?? 0,
          marital_status: data.marital_status || "",
          has_disability: Boolean(data.has_disability),
          family_size: data.family_size ?? 1,
          requested_house_category: data.requested_house_category || "",
          reason_for_request: data.reason_for_request || "",
          preferred_location: data.preferred_location || "",
        });
      } catch (err: any) {
        toast.error(err?.message || "Failed to load application");
        navigate("/applicant/my", { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editId, navigate]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.employee_id.trim()) e.employee_id = "Employee ID is required";
    if (!form.employee_name.trim())
      e.employee_name = "Employee name is required";
    if (!form.national_id.trim()) e.national_id = "National ID is required";
    if (!form.gender) e.gender = "Gender is required";
    if (!form.job_position.trim()) e.job_position = "Job position is required";
    if (!form.position_type) e.position_type = "Position type is required";
    if (!form.job_type) e.job_type = "Job type is required";
    if (form.years_of_service < 0 || Number.isNaN(form.years_of_service)) {
      e.years_of_service = "Years of service must be 0 or more";
    }
    if (!form.marital_status) e.marital_status = "Marital status is required";
    if (!form.requested_house_category)
      e.requested_house_category = "House category is required";
    if (form.family_size < 1 || Number.isNaN(form.family_size))
      e.family_size = "Family size must be at least 1";
    if (file && file.size > 5 * 1024 * 1024)
      e.supporting_document = "File must be under 5 MB";
    if (
      file &&
      !["pdf", "jpg", "jpeg", "png"].includes(
        file.name.split(".").pop()?.toLowerCase() || "",
      )
    ) {
      e.supporting_document = "Only PDF, JPG, PNG files allowed";
    }
    if (hasActiveAllocation) {
      e.employee_id = "Employee already has an active house allocation and cannot submit a new application.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (!canEdit) {
      toast.error("This application can no longer be edited from this page");
      return;
    }
    if (hasActiveAllocation) {
      toast.error("This employee already has an active house allocation. Cannot submit application.");
      return;
    }
    if (!validate()) return;

    // Re-verify employee ID before submitting
    const empId = form.employee_id.trim();
    if (empId) {
      setEmployeeChecking(true);
      try {
        const result = await validateEmployeeId(empId);
        if (!result.valid) {
          setErrors((prev) => ({ ...prev, employee_id: `Employee ID "${empId}" not found in the system. Please verify your ID.` }));
          setSaving(false);
          setEmployeeChecking(false);
          return;
        }
        if (result.has_active_allocation) {
          setHasActiveAllocation(true);
          setErrors((prev) => ({
            ...prev,
            employee_id: result.error_message || "Employee already has an active house allocation and cannot submit a new application.",
          }));
          toast.error("Employee already has an active house allocation.");
          setSaving(false);
          setEmployeeChecking(false);
          return;
        }
      } finally {
        setEmployeeChecking(false);
      }
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === "has_disability") fd.append(k, v ? "true" : "false");
        else if (typeof v === "number") fd.append(k, String(v));
        else fd.append(k, v as string);
      });
      fd.append("status", saveAsDraft ? "Draft" : "Submitted");
      if (file) fd.append("supporting_document", file);

      if (isEditMode && editId) {
        const updated = await updateApplication(editId, fd);
        setApplication(updated);
        toast.success(
          saveAsDraft
            ? "Application draft updated"
            : "Application submitted successfully",
        );
      } else {
        const created = await createApplication(fd);
        setApplication(created);
        toast.success(
          saveAsDraft
            ? "Application saved as draft"
            : "Application submitted successfully",
        );
      }

      navigate(saveAsDraft ? "/applicant/my" : "/applicant/status");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  const metadata = application ?? null;
  const requesterLabel =
    metadata?.requester_name ||
    authUser?.name ||
    authUser?.username ||
    "Current applicant";

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => navigate("/applicant/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditMode ? "Edit Applicant Request" : "Applicant Request Input"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete the full request form below. System-generated columns are
            shown as read-only.
          </p>
        </div>
        {metadata?.status ? (
          <Badge
            variant="outline"
            className={STATUS_STYLES[metadata.status] || ""}
          >
            {metadata.status}
          </Badge>
        ) : null}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-[#0B4F2F]" />
            System & Tracking Columns
          </CardTitle>
          <CardDescription>
            These columns exist on the application record. Some are generated
            automatically after save or review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>Application ID</Label>
              <Input
                value={metadata?.id || "Auto-generated after save"}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Application Number</Label>
              <Input
                value={metadata?.application_no || "Auto-generated after save"}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input
                value={metadata?.status || "Draft / Submitted on save"}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Requester</Label>
              <Input
                value={
                  metadata?.requester ||
                  authUser?.id ||
                  "Assigned automatically"
                }
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Requester Name</Label>
              <Input value={requesterLabel} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Active Record</Label>
              <Input
                value={metadata ? (metadata.is_active ? "Yes" : "No") : "Yes"}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Created At</Label>
              <Input
                value={formatDateTime(metadata?.created_at)}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Updated At</Label>
              <Input
                value={formatDateTime(metadata?.updated_at)}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Submitted At</Label>
              <Input
                value={formatDateTime(metadata?.submitted_at)}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Reviewed At</Label>
              <Input
                value={formatDateTime(metadata?.reviewed_at)}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Reviewed By</Label>
              <Input value={metadata?.reviewed_by || "—"} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Reviewed By Name</Label>
              <Input
                value={metadata?.reviewed_by_name || "—"}
                readOnly
                disabled
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Returned Reason</Label>
              <Textarea
                value={metadata?.returned_reason || ""}
                readOnly
                disabled
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={metadata?.rejection_reason || ""}
                readOnly
                disabled
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-[#0B4F2F]" />
            Applicant Information Columns
          </CardTitle>
          <CardDescription>
            Fill in all applicant-facing request fields below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!canEdit && metadata ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              This application is in <strong>{metadata.status}</strong> status
              and is now read-only from this page.
            </div>
          ) : null}

          {hasActiveAllocation && (
            <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <AlertTitle className="font-bold">Active Allocation Detected</AlertTitle>
              <AlertDescription className="mt-1">
                This employee already has an active house allocation ({allocationInfo || "Active Allocation"}). Employees with an active allocation cannot submit a new application.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Employee ID <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
                onBlur={handleEmployeeIdBlur}
                placeholder="e.g. 0001"
                disabled={!canEdit}
              />
              {employeeChecking && <p className="text-xs text-muted-foreground animate-pulse">Verifying employee…</p>}
              {errors.employee_id && (
                <p className="text-xs text-destructive">{errors.employee_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Employee Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.employee_name}
                onChange={(e) => set("employee_name", e.target.value)}
                placeholder="John Doe"
                disabled={!canEdit}
              />
              {errors.employee_name && (
                <p className="text-xs text-destructive">
                  {errors.employee_name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                National ID <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.national_id}
                onChange={(e) => set("national_id", e.target.value)}
                placeholder="ID number"
                disabled={!canEdit}
              />
              {errors.national_id && (
                <p className="text-xs text-destructive">{errors.national_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Gender <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs text-destructive">{errors.gender}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Job Position <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.job_position}
                onChange={(e) => set("job_position", e.target.value)}
                placeholder="Engineer"
                disabled={!canEdit}
              />
              {errors.job_position && (
                <p className="text-xs text-destructive">
                  {errors.job_position}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Job Grade</Label>
              <Input
                value={form.job_grade}
                onChange={(e) => set("job_grade", e.target.value)}
                placeholder="e.g. G5"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Job Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.job_type}
                onValueChange={(v) => set("job_type", v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.job_type && (
                <p className="text-xs text-destructive">{errors.job_type}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Position Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.position_type}
                onValueChange={(v) => set("position_type", v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position_type && (
                <p className="text-xs text-destructive">{errors.position_type}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Years of Service <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={form.years_of_service}
                onChange={(e) =>
                  set("years_of_service", parseInt(e.target.value, 10) || 0)
                }
                disabled={!canEdit}
              />
              {errors.years_of_service && (
                <p className="text-xs text-destructive">
                  {errors.years_of_service}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Marital Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.marital_status}
                onValueChange={(v) => set("marital_status", v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.marital_status && (
                <p className="text-xs text-destructive">
                  {errors.marital_status}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/60 px-4 py-3">
            <Checkbox
              id="applicant-disability"
              checked={form.has_disability}
              onCheckedChange={(v) => set("has_disability", !!v)}
              disabled={!canEdit}
            />
            <Label htmlFor="applicant-disability" className="cursor-pointer">
              Has Disability
            </Label>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Family Size</Label>
              <Input
                type="number"
                min={1}
                value={form.family_size}
                disabled={!canEdit || form.marital_status === "Single"}
                onChange={(e) =>
                  set("family_size", parseInt(e.target.value, 10) || 1)
                }
              />
              {form.marital_status === "Single" && (
                <p className="text-xs text-muted-foreground">
                  Family size is 1 for single applicants
                </p>
              )}
              {errors.family_size && (
                <p className="text-xs text-destructive">{errors.family_size}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Requested House Category{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.requested_house_category}
                onValueChange={(v) => set("requested_house_category", v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {HOUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "Staff"
                        ? "Staff"
                        : c === "E"
                          ? "E (Barrack)"
                          : `Type ${c}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.requested_house_category && (
                <p className="text-xs text-destructive">
                  {errors.requested_house_category}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Preferred Location</Label>
              <Input
                value={form.preferred_location}
                onChange={(e) => set("preferred_location", e.target.value)}
                placeholder="Area or compound"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason for Request</Label>
            <Textarea
              value={form.reason_for_request}
              onChange={(e) => set("reason_for_request", e.target.value)}
              rows={4}
              placeholder="Brief explanation"
              disabled={!canEdit}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Current Supporting Document</Label>
              {metadata?.supporting_document ? (
                <div className="rounded-lg border border-border/60 px-4 py-3 text-sm">
                  <a
                    href={metadata.supporting_document}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Open current document
                  </a>
                </div>
              ) : (
                <Input
                  value="No supporting document uploaded"
                  readOnly
                  disabled
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Upload / Replace Supporting Document</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPG, or PNG. Maximum 5 MB.
              </p>
              {errors.supporting_document && (
                <p className="text-xs text-destructive">
                  {errors.supporting_document}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={saving || !canEdit || hasActiveAllocation}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving
                ? "Saving..."
                : isEditMode
                  ? "Update Draft"
                  : "Save as Draft"}
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={saving || !canEdit || hasActiveAllocation}
              className="gap-2 bg-[#0B4F2F] hover:bg-[#0E5A37]"
            >
              <Send className="h-4 w-4" />
              {saving
                ? "Submitting..."
                : isEditMode
                  ? "Update & Submit"
                  : "Submit Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
