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
import { ArrowLeft, FileText, Save, Send } from "lucide-react";
import { createApplication, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, HOUSE_CATEGORIES } from "@/services/houseApplication";

const EMPTY_FORM = {
  employee_id: "",
  employee_name: "",
  national_id: "",
  gender: "",
  job_position: "",
  job_grade: "",
  years_of_service: 0,
  marital_status: "",
  has_disability: false,
  family_size: 1,
  number_of_children: 0,
  requested_house_category: "",
  reason_for_request: "",
  preferred_location: "",
};

export default function RequesterApplicationNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.employee_id.trim()) e.employee_id = "Employee ID is required";
    if (!form.employee_name.trim()) e.employee_name = "Employee name is required";
    if (!form.national_id.trim()) e.national_id = "National ID is required";
    if (!form.gender) e.gender = "Gender is required";
    if (!form.job_position.trim()) e.job_position = "Job position is required";
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
      navigate(saveAsDraft ? "/requester/my" : "/requester/status");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/requester/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New House Application</h1>
        <p className="text-sm text-muted-foreground">Submit a new house allocation request</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Applicant Information
          </CardTitle>
          <CardDescription>Fill in your details below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee ID <span className="text-destructive">*</span></Label>
              <Input value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} placeholder="EMP-0001" />
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
              <Input type="number" min={1} value={form.family_size} onChange={(e) => set("family_size", parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Number of Children</Label>
              <Input type="number" min={0} value={form.number_of_children} onChange={(e) => set("number_of_children", parseInt(e.target.value) || 0)} />
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={saving} className="gap-2">
              <Send className="h-4 w-4" />
              {saving ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
