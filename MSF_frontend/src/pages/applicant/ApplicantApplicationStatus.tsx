import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { ArrowLeft, CheckCircle, FileText, Clock, Home } from "lucide-react";
import {
  listApplications, getApplication, getApplicationDashboard,
  type HouseApplication, type ApplicationDashboardCounts,
} from "@/services/houseApplication";

const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  "Under Review": "Under Review",
  Verified: "Verified",
  "Waiting for Allocation": "Waiting",
  Allocated: "Allocated",
  Rejected: "Rejected",
  Returned: "Returned",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  Submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Under Review": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Verified: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "Waiting for Allocation": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Allocated: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Returned: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

const WORKFLOW_STEPS = ["Draft", "Submitted", "Under Review", "Verified", "Waiting for Allocation", "Allocated"];

function WorkflowProgress({ currentStatus }: { currentStatus: string }) {
  const currentStepIndex = WORKFLOW_STEPS.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const done = idx <= currentStepIndex;
        const current = idx === currentStepIndex;
        return (
          <div key={step} className="flex items-center gap-1 min-w-0">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              current
                ? "bg-[#0B4F2F] text-white dark:bg-[#7BC29A] dark:text-[#0B4F2F] shadow-sm"
                : done
                ? "bg-[#0B4F2F]/10 text-[#0B4F2F] dark:text-[#7BC29A]"
                : "bg-muted text-muted-foreground"
            }`}>
              {done && idx < currentStepIndex ? <CheckCircle className="h-3 w-3" /> : null}
              {STATUS_LABELS[step] || step}
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className={`h-px w-6 ${done ? "bg-[#0B4F2F]/40" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ApplicantApplicationStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const detailId = searchParams.get("id");

  const [apps, setApps] = useState<HouseApplication[]>([]);
  const [detail, setDetail] = useState<HouseApplication | null>(null);
  const [dash, setDash] = useState<ApplicationDashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      if (detailId) {
        const app = await getApplication(detailId);
        setDetail(app);
      } else {
        const [list, dashboard] = await Promise.all([
          listApplications(),
          getApplicationDashboard().catch(() => null),
        ]);
        setApps(list);
        setDash(dashboard);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [detailId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <PageSkeleton />;

  if (detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <button
          type="button"
          onClick={() => navigate("/applicant/status")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Status Overview
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Application {detail.application_no}
            </h1>
            <p className="text-sm text-muted-foreground">Track your application progress</p>
          </div>
          <Badge variant="outline" className={STATUS_COLORS[detail.status] || "self-start"}>
            {detail.status}
          </Badge>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-[#0B4F2F]" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowProgress currentStatus={detail.status} />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-[#0B4F2F]" />
              Application Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Employee Name", detail.employee_name],
                ["Employee ID", detail.employee_id],
                ["National ID", detail.national_id],
                ["Gender", detail.gender],
                ["Job Position", detail.job_position],
                ["Job Grade", detail.job_grade || "-"],
                ["Years of Service", String(detail.years_of_service)],
                ["Marital Status", detail.marital_status],
                ["Disability", detail.has_disability ? "Yes" : "No"],
                ["Family Size", String(detail.family_size)],
                ["Number of Children", String(detail.number_of_children)],
                ["Requested Category", detail.requested_house_category],
                ["Preferred Location", detail.preferred_location || "-"],
                ["Submitted At", detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : "-"],
                ["Reviewed At", detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : "-"],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-border/30 pb-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>
            {detail.reason_for_request && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Reason for Request</p>
                <p className="mt-1 text-sm">{detail.reason_for_request}</p>
              </div>
            )}
            {detail.rejection_reason && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
                <p className="text-xs font-medium text-destructive">Rejection Reason</p>
                <p className="mt-1 text-sm">{detail.rejection_reason}</p>
              </div>
            )}
            {detail.returned_reason && (
              <div className="mt-4 rounded-lg bg-orange-50 p-3 dark:bg-orange-950/20">
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Return Reason</p>
                <p className="mt-1 text-sm">{detail.returned_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button variant="outline" onClick={() => navigate("/applicant/status")}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => navigate("/applicant/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Application Status</h1>
        <p className="text-sm text-muted-foreground">Overview of your house applications</p>
      </div>

      {dash && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            ["Total", dash.total, FileText, "text-[#0B4F2F] dark:text-[#7BC29A]"],
            ["Draft", dash.draft, FileText, "text-muted-foreground"],
            ["Submitted", dash.submitted, Clock, "text-blue-600 dark:text-blue-400"],
            ["Under Review", dash.under_review, Clock, "text-amber-600 dark:text-amber-400"],
            ["Allocated", dash.allocated, CheckCircle, "text-green-600 dark:text-green-400"],
            ["Rejected", dash.rejected, CheckCircle, "text-red-600 dark:text-red-400"],
          ].map(([label, value, Icon, color]) => (
            <Card key={label as string} className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{label as string}</p>
                    <p className="text-2xl font-bold">{value as number}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                    <Icon className={`h-5 w-5 ${color as string}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-[#0B4F2F]" />
            Recent Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No applications found.</p>
          ) : (
            <div className="space-y-2">
              {apps.slice(0, 10).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/applicant/status?id=${app.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{app.application_no}</p>
                    <p className="truncate font-medium">{app.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{app.requested_house_category}</p>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
