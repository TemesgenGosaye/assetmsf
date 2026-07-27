import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/ui/metric-card";
import { Home, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
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

export default function HouseApplicationStatus() {
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

  const currentStepIndex = detail ? WORKFLOW_STEPS.indexOf(detail.status) : -1;

  if (loading) return <PageSkeleton />;

  if (detail) {
    return (
      <div className="space-y-6 pb-10">
        <Breadcrumbs items={[
          { label: "House Application" },
          { label: "Application Status", href: "/house-application/status" },
          { label: detail.application_no },
        ]} />
        <PageHeader title={`Application ${detail.application_no}`} description="Track your application progress">
          <Badge variant="outline" className={STATUS_COLORS[detail.status] || ""}>
            {detail.status}
          </Badge>
        </PageHeader>

        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {WORKFLOW_STEPS.map((step, idx) => {
                const done = idx <= currentStepIndex;
                const current = idx === currentStepIndex;
                return (
                  <div key={step} className="flex items-center gap-1 min-w-0">
                    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                      current
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {done && idx < currentStepIndex ? <CheckCircle className="h-3 w-3" /> : null}
                      {STATUS_LABELS[step] || step}
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div className={`h-px w-6 ${done ? "bg-primary/40" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Application Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Employee Name", detail.employee_name],
                ["Employee ID", detail.employee_id],
                ["National ID", detail.national_id],
                ["Gender", detail.gender],
                ["Job Position", detail.job_position],
                ["Job Grade", detail.job_grade || "-"],
                ["Job Type", detail.job_type || "-"],
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
                <div key={label} className="border-b pb-2">
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
          <Button variant="outline" onClick={() => window.history.back()}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumbs items={[{ label: "House Application" }, { label: "Application Status" }]} />
      <PageHeader title="Application Status" description="Overview of your house applications" />

      {dash && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard icon={FileText} title="Total" value={dash.total} />
          <MetricCard icon={FileText} title="Draft" value={dash.draft} />
          <MetricCard icon={Clock} title="Submitted" value={dash.submitted} />
          <MetricCard icon={Clock} title="Under Review" value={dash.under_review} />
          <MetricCard icon={CheckCircle} title="Allocated" value={dash.allocated} />
          <MetricCard icon={XCircle} title="Rejected" value={dash.rejected} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Applications</CardTitle></CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No applications found.</p>
          ) : (
            <div className="space-y-3">
              {apps.slice(0, 10).map((app) => (
                <div key={app.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{app.application_no}</p>
                    <p className="truncate font-medium">{app.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{app.requested_house_category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>
                      {app.status}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => window.location.href = `/house-application/status?id=${app.id}`}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
