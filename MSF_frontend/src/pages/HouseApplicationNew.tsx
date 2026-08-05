import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { createApplication, validateEmployeeId, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, HOUSE_CATEGORIES, POSITION_TYPE_OPTIONS, JOB_TYPE_OPTIONS } from "@/services/houseApplication";

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

export default function HouseApplicationNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employeeChecking, setEmployeeChecking] = useState(false);

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
    const id = form.employee_id.trim();
    if (!id) return;
    setEmployeeChecking(true);
    try {
      const result = await validateEmployeeId(id);
      if (!result.valid) {
        setErrors((prev) => ({ ...prev, employee_id: `Employee ID "${id}" not found in the system. Please verify your ID.` }));
      } else {
        setErrors((prev) => ({ ...prev, employee_id: "" }));
        // Auto-fill employee name if empty
        if (!form.employee_name.trim() && result.employee_name) {
          setForm((prev) => ({ ...prev, employee_name: result.employee_name! }));
        }
      }
    } finally {
      setEmployeeChecking(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.employee_id.trim()) e.employee_id = "Employee ID is required";
    if (!form.employee_name.trim()) e.employee_name = "Employee name is required";
    if (!form.national_id.trim()) e.national_id = "National ID is required";
    if (!form.gender) e.gender = "Gender is required";
    if (!form.job_position.trim()) e.job_position = "Job position is required";
    if (!form.position_type) e.position_type = "Position type is required";
    if (!form.job_type) e.job_type = "Job type is required";
    if (!form.years_of_service || form.years_of_service < 0) e.years_of_service = "Years of service must be 0 or more";
    if (!form.marital_status) e.marital_status = "Marital status is required";
    if (!form.requested_house_category) e.requested_house_category = "House category is required";
    if (file && file.size > 5 * 1024 * 1024) e.supporting_document = "File must be under 5 MB";
    if (file && !["pdf", "jpg", "jpeg", "png"].includes(file.name.split(".").pop()?.toLowerCase() || ""))
      e.supporting_document = "Only PDF, JPG, PNG files allowed";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (saveAsDraft: boolean) => {
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
      await createApplication(fd);
      toast.success(saveAsDraft ? "Application saved as draft" : "Application submitted successfully");
      navigate(saveAsDraft ? "/house-application/my" : "/house-application/status");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumbs items={[{ label: "House Application" }, { label: "New Application" }]} />
      <PageHeader title="New House Application" description="Submit a new house allocation request" />
      <Card>
        <CardHeader>
          <CardTitle>Applicant Information</CardTitle>
          <CardDescription>Fill in your details below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee ID <span className="text-destructive">*</span></Label>
              <Input
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
                onBlur={handleEmployeeIdBlur}
                placeholder="e.g. 0001"
              />
              {employeeChecking && <p className="text-xs text-muted-foreground animate-pulse">Verifying employee…</p>}
              {errors.employee_id && <p className="text-xs text-destructive">{errors.employee_id}</p>}
            </div>
            <div className="space-y-2">
              <Label>Employee Name <span className="text-destructive">*</span></Label>
              <Input value={form.employee_name} onChange={(e) => set("employee_name", e.target.value)} placeholder="John Doe" />
              {errors.employee_name && <p className="text-xs text-destructive">{errors.employee_name}</p>}
            </div>
            <div className="space-y-2">
              <Label>National ID <span className="text-destructive">*</span></Label>
              <Input value={form.national_id} onChange={(e) => set("national_id", e.target.value)} placeholder="ID number" />
              {errors.national_id && <p className="text-xs text-destructive">{errors.national_id}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender <span className="text-destructive">*</span></Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-xs text-destructive">{errors.gender}</p>}
            </div>
            <div className="space-y-2">
              <Label>Job Position <span className="text-destructive">*</span></Label>
              <Input value={form.job_position} onChange={(e) => set("job_position", e.target.value)} placeholder="Engineer" />
              {errors.job_position && <p className="text-xs text-destructive">{errors.job_position}</p>}
            </div>
            <div className="space-y-2">
              <Label>Job Grade</Label>
              <Input value={form.job_grade} onChange={(e) => set("job_grade", e.target.value)} placeholder="e.g. G5" />
            </div>
            <div className="space-y-2">
              <Label>Job Type <span className="text-destructive">*</span></Label>
              <Select value={form.job_type} onValueChange={(v) => set("job_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select job type" /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.job_type && <p className="text-xs text-destructive">{errors.job_type}</p>}
            </div>
            <div className="space-y-2">
              <Label>Position Type <span className="text-destructive">*</span></Label>
              <Select value={form.position_type} onValueChange={(v) => set("position_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {POSITION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position_type && <p className="text-xs text-destructive">{errors.position_type}</p>}
            </div>
            <div className="space-y-2">
              <Label>Years of Service <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={form.years_of_service} onChange={(e) => set("years_of_service", parseInt(e.target.value) || 0)} />
              {errors.years_of_service && <p className="text-xs text-destructive">{errors.years_of_service}</p>}
            </div>
            <div className="space-y-2">
              <Label>Marital Status <span className="text-destructive">*</span></Label>
              <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v)}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.marital_status && <p className="text-xs text-destructive">{errors.marital_status}</p>}
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="disability" checked={form.has_disability} onCheckedChange={(v) => set("has_disability", !!v)} />
              <Label htmlFor="disability" className="cursor-pointer">Has Disability</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Family Size</Label>
              <Input
                type="number"
                min={1}
                value={form.family_size}
                disabled={form.marital_status === "Single"}
                onChange={(e) => set("family_size", parseInt(e.target.value) || 1)}
              />
              {form.marital_status === "Single" && (
                <p className="text-xs text-muted-foreground">Family size is 1 for single applicants</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Requested House Category <span className="text-destructive">*</span></Label>
              <Select value={form.requested_house_category} onValueChange={(v) => set("requested_house_category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {HOUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c === "E" ? "E (Barrack)" : `Type ${c}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.requested_house_category && <p className="text-xs text-destructive">{errors.requested_house_category}</p>}
            </div>
            <div className="space-y-2">
              <Label>Preferred Location</Label>
              <Input value={form.preferred_location} onChange={(e) => set("preferred_location", e.target.value)} placeholder="Area or compound" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason for Request</Label>
            <Textarea value={form.reason_for_request} onChange={(e) => set("reason_for_request", e.target.value)} rows={3} placeholder="Brief explanation" />
          </div>

          <div className="space-y-2">
            <Label>Supporting Document (PDF/JPG/PNG, max 5 MB)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {errors.supporting_document && <p className="text-xs text-destructive">{errors.supporting_document}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
              {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
