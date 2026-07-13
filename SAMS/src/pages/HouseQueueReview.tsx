import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import StatusChip from "@/components/ui/status-chip";
import {
  getApplication,
  updateApplicationStatus,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type HouseApplication,
} from "@/services/houseApplication";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Send,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-slate-500/10 text-slate-700 border-slate-300",
  Submitted: "bg-blue-500/10 text-blue-700 border-blue-300",
  "Under Review": "bg-amber-500/10 text-amber-700 border-amber-300",
  Verified: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  "Waiting for Allocation": "bg-violet-500/10 text-violet-700 border-violet-300",
  Allocated: "bg-green-500/10 text-green-700 border-green-300",
  Rejected: "bg-rose-500/10 text-rose-700 border-rose-300",
  Returned: "bg-orange-500/10 text-orange-700 border-orange-300",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border/50 bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export default function HouseQueueReview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<HouseApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonStatus, setReasonStatus] = useState<ApplicationStatus | null>(null);
  const [reasonText, setReasonText] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const app = await getApplication(id);
      setDetail(app);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load queue application");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const actionButtons = useMemo(
    () => [
      {
        label: "Mark Under Review",
        status: "Under Review" as ApplicationStatus,
        variant: "outline" as const,
        className: "",
      },
      {
        label: "Verify",
        status: "Verified" as ApplicationStatus,
        variant: "outline" as const,
        className: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
      },
      {
        label: "Wait Allocation",
        status: "Waiting for Allocation" as ApplicationStatus,
        variant: "outline" as const,
        className: "border-violet-300 text-violet-700 hover:bg-violet-50",
      },
      {
        label: "Allocate",
        status: "Allocated" as ApplicationStatus,
        variant: "default" as const,
        className: "bg-emerald-600 hover:bg-emerald-700 text-white",
      },
    ],
    [],
  );

  const setStatus = async (status: ApplicationStatus, reason?: string) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const updated = await updateApplicationStatus(id, status, reason);
      setDetail(updated);
      toast.success(`Application marked as ${status}`);
      setReasonOpen(false);
      setReasonStatus(null);
      setReasonText("");
    } catch (err: any) {
      toast.error(err?.message || `Failed to update status to ${status}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openReasonModal = (status: ApplicationStatus) => {
    setReasonStatus(status);
    setReasonText("");
    setReasonOpen(true);
  };

  if (loading) return <PageSkeleton />;

  if (!detail) {
    return (
      <div className="space-y-6 p-6">
        <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }, { label: "Queue Review" }]} />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Application not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-10">
      <Breadcrumbs
        items={[
          { label: "House Opp", to: "/house-opp" },
          { label: "House Queue Review" },
          { label: detail.application_no || detail.id },
        ]}
      />

      <PageHeader
        title={`Queue Review • ${detail.application_no || detail.id}`}
        description="Review the queued housing request, inspect all applicant fields, and update its workflow status."
      >
        <div className="flex items-center gap-2">
          <StatusChip status={detail.status} />
          <Badge variant="outline" className={STATUS_STYLES[detail.status] || ""}>
            Queue Record
          </Badge>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => navigate("/house-opp")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to House Opp
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <FileText className="mr-2 h-4 w-4" />
          Print
        </Button>
        {detail.supporting_document ? (
          <Button variant="outline" asChild>
            <a href={detail.supporting_document} target="_blank" rel="noreferrer">
              Open Supporting Document
            </a>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Workflow Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {actionButtons.map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                className={action.className}
                disabled={submitting || detail.status === action.status}
                onClick={() => void setStatus(action.status)}
              >
                {action.status === "Allocated" ? (
                  <Home className="mr-2 h-4 w-4" />
                ) : action.status === "Verified" ? (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </Button>
            ))}
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              disabled={submitting}
              onClick={() => openReasonModal("Returned")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return
            </Button>
            <Button
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
              disabled={submitting}
              onClick={() => openReasonModal("Rejected")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {APPLICATION_STATUSES.map((status) => (
              <div
                key={status}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  detail.status === status
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {status}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" />
            Applicant Input Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Employee ID" value={detail.employee_id} />
            <DetailField label="Employee Name" value={detail.employee_name} />
            <DetailField label="National ID" value={detail.national_id} />
            <DetailField label="Gender" value={detail.gender} />
            <DetailField label="Job Position" value={detail.job_position} />
            <DetailField label="Job Grade" value={detail.job_grade || "—"} />
            <DetailField label="Years of Service" value={String(detail.years_of_service)} />
            <DetailField label="Marital Status" value={detail.marital_status} />
            <DetailField label="Has Disability" value={detail.has_disability ? "Yes" : "No"} />
            <DetailField label="Family Size" value={String(detail.family_size)} />
            <DetailField label="Number of Children" value={String(detail.number_of_children)} />
            <DetailField label="Requested House Category" value={detail.requested_house_category} />
            <DetailField label="Preferred Location" value={detail.preferred_location || "—"} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Reason for Request</Label>
              <Textarea value={detail.reason_for_request || ""} readOnly rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Supporting Document</Label>
              {detail.supporting_document ? (
                <div className="rounded-lg border border-border/60 px-4 py-3 text-sm">
                  <a
                    href={detail.supporting_document}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Open uploaded file
                  </a>
                </div>
              ) : (
                <Input value="No supporting document uploaded" readOnly disabled />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            System & Queue Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Application ID" value={detail.id} />
            <DetailField label="Application Number" value={detail.application_no || "—"} />
            <DetailField label="Requester" value={detail.requester || "—"} />
            <DetailField label="Requester Name" value={detail.requester_name || "—"} />
            <DetailField label="Status" value={detail.status} />
            <DetailField label="Is Active" value={detail.is_active ? "Yes" : "No"} />
            <DetailField label="Created At" value={formatDateTime(detail.created_at)} />
            <DetailField label="Updated At" value={formatDateTime(detail.updated_at)} />
            <DetailField label="Submitted At" value={formatDateTime(detail.submitted_at)} />
            <DetailField label="Reviewed At" value={formatDateTime(detail.reviewed_at)} />
            <DetailField label="Reviewed By" value={detail.reviewed_by || "—"} />
            <DetailField label="Reviewed By Name" value={detail.reviewed_by_name || "—"} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Returned Reason</Label>
              <Textarea value={detail.returned_reason || ""} readOnly rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea value={detail.rejection_reason || ""} readOnly rows={4} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonStatus === "Returned" ? "Return application" : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {reasonStatus === "Returned"
                ? "Provide a reason so the applicant knows what to correct."
                : "Provide a reason for rejecting this application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              {reasonStatus === "Returned" ? "Return reason" : "Rejection reason"}
            </Label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={5}
              placeholder="Enter reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!reasonStatus) return;
                if (!reasonText.trim()) {
                  toast.error("Reason is required");
                  return;
                }
                void setStatus(reasonStatus, reasonText.trim());
              }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
