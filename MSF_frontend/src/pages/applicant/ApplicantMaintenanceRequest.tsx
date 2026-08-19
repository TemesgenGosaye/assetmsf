import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Wrench, ArrowLeft, CheckCircle2, Clock, Home, AlertTriangle } from "lucide-react";
import {
  submitMaintenanceRequest,
  listMyMaintenanceRequests,
  listMyAllocatedHouses,
  type MaintenanceRequest,
  type MaintenanceCategory,
  type MaintenancePriority,
} from "@/services/maintenanceRequest";

const CATEGORIES: { value: MaintenanceCategory; label: string }[] = [
  { value: "Plumbing", label: "Plumbing" },
  { value: "Electrical", label: "Electrical" },
  { value: "Structural", label: "Structural" },
  { value: "Roofing", label: "Roofing" },
  { value: "Painting", label: "Painting" },
  { value: "Flooring", label: "Flooring" },
  { value: "Door & Window", label: "Door & Window" },
  { value: "Water Supply", label: "Water Supply" },
  { value: "Drainage", label: "Drainage" },
  { value: "General", label: "General Repair" },
  { value: "Other", label: "Other" },
];

const PRIORITIES: { value: MaintenancePriority; label: string; color: string }[] = [
  { value: "Low", label: "Low", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "Medium", label: "Medium", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "High", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "Emergency", label: "Emergency", color: "bg-red-100 text-red-700 border-red-200" },
];

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-700",
  Received: "bg-indigo-100 text-indigo-700",
  "In Progress": "bg-amber-100 text-amber-700",
  "On Hold": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

type House = { id: string; house_id: string; house_number: string; location: string; house_type: string };

export default function ApplicantMaintenanceRequest() {
  const navigate = useNavigate();
  const [houses, setHouses] = useState<House[]>([]);
  const [myRequests, setMyRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formHouse, setFormHouse] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<MaintenanceCategory>("General");
  const [formPriority, setFormPriority] = useState<MaintenancePriority>("Medium");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [housesData, requestsData] = await Promise.all([
        listMyAllocatedHouses(),
        listMyMaintenanceRequests().catch(() => []),
      ]);
      setHouses(housesData);
      setMyRequests(requestsData);
    } catch (e: any) {
      toast.error("Failed to load data: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formHouse || !formTitle.trim() || !formDescription.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitMaintenanceRequest({
        house: formHouse,
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        priority: formPriority,
      });
      toast.success("Maintenance request submitted successfully!", {
        description: `Request ${result.request_number} has been sent to the Civil Work Department.`,
      });
      setFormHouse("");
      setFormTitle("");
      setFormDescription("");
      setFormCategory("General");
      setFormPriority("Medium");
      setShowForm(false);
      await loadData();
    } catch (e: any) {
      toast.error("Submission failed: " + (e.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/applicant/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maintenance Request</h1>
            <p className="text-sm text-muted-foreground">
              Submit and track maintenance requests for your allocated house
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#0B4F2F] hover:bg-[#0E5A37] text-white">
          <Wrench className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "New Request"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-[#0B4F2F]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B4F2F] dark:text-[#7BC29A]">
              <Wrench className="h-5 w-5" />
              Submit Maintenance Request
            </CardTitle>
            <CardDescription>
              Describe the issue with your house and our Civil Work Department will handle it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {houses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  No allocated houses found. You must have an allocated house to submit a maintenance request.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>House *</Label>
                    <Select value={formHouse} onValueChange={setFormHouse}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your house" />
                      </SelectTrigger>
                      <SelectContent>
                        {houses.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.house_number || h.house_id} — {h.location} ({h.house_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={formCategory} onValueChange={(v) => setFormCategory(v as MaintenanceCategory)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Brief description of the issue"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Detailed Description *</Label>
                  <Textarea
                    placeholder="Describe the maintenance issue in detail — what is broken, where, when it started, etc."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priority *</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setFormPriority(p.value)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          formPriority === p.value
                            ? `${p.color} ring-2 ring-offset-1 ring-current/20`
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {p.value === "Emergency" && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0B4F2F] hover:bg-[#0E5A37] text-white"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#0B4F2F] dark:text-[#7BC29A]" />
            My Maintenance Requests
          </CardTitle>
          <CardDescription>
            Track the status of your submitted maintenance requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Home className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No maintenance requests yet. Click "New Request" to submit one.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between gap-4 rounded-xl border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{req.request_number}</span>
                      <Badge className={`${STATUS_COLORS[req.status] || "bg-gray-100 text-gray-600"} text-xs`} variant="outline">
                        {req.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {req.priority}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm truncate">{req.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        {req.house_number || req.house_hid} — {req.house_location}
                      </span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    {req.status === "Rejected" && req.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {req.rejection_reason}</p>
                    )}
                    {req.status === "Completed" && req.resolution_notes && (
                      <p className="text-xs text-green-600 mt-1">Resolution: {req.resolution_notes}</p>
                    )}
                  </div>
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${
                    req.status === "Completed" ? "text-green-500" :
                    req.status === "Rejected" ? "text-red-500" : "text-muted-foreground/40"
                  }`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
