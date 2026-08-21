import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MetricCard, { type MetricCardVariant } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  FileText, Clock, CheckCircle, XCircle, FilePlus, Eye,
  Home,
} from "lucide-react";
import {
  listApplications, getApplicationDashboard,
  type HouseApplication, type ApplicationDashboardCounts,
} from "@/services/houseApplication";

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

const metrics = [
  { key: "total", label: "Total Applications", icon: FileText, variant: "default" as MetricCardVariant },
  { key: "draft", label: "Drafts", icon: FileText, variant: "orange" as MetricCardVariant },
  { key: "submitted", label: "Submitted", icon: Clock, variant: "blue" as MetricCardVariant },
  { key: "under_review", label: "Under Review", icon: Clock, variant: "amber" as MetricCardVariant },
  { key: "allocated", label: "Allocated", icon: CheckCircle, variant: "emerald" as MetricCardVariant },
  { key: "rejected", label: "Rejected", icon: XCircle, variant: "rose" as MetricCardVariant },
];

export default function ApplicantDashboard() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<HouseApplication[]>([]);
  const [dash, setDash] = useState<ApplicationDashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const u = JSON.parse(raw);
        setUserName(u.name || u.email || "User");
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [list, dashboard] = await Promise.all([
          listApplications(),
          getApplicationDashboard().catch(() => null),
        ]);
        setApps(list);
        setDash(dashboard);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 pb-10">
      {/* Welcome */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {userName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s an overview of your house applications.
          </p>
        </div>
        <Button onClick={() => navigate("/applicant/new")} className="gap-2 shrink-0 bg-[#0B4F2F] hover:bg-[#0E5A37]">
          <FilePlus className="h-4 w-4" />
          New Application
        </Button>
      </div>

      {/* Metrics */}
      {dash && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map((m) => {
            const value = (dash as any)[m.key] ?? 0;
            return (
              <MetricCard
                key={m.key}
                icon={m.icon}
                title={m.label}
                countValue={value}
                variant={m.variant}
              />
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePlus className="h-4 w-4 text-[#0B4F2F]" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-start gap-3 h-11 bg-[#0B4F2F] hover:bg-[#0E5A37]"
              onClick={() => navigate("/applicant/new")}
            >
              <FilePlus className="h-4 w-4" />
              Submit New Application
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11"
              onClick={() => navigate("/applicant/my")}
            >
              <Eye className="h-4 w-4" />
              View My Applications
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-[#0B4F2F]" />
              Application Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11"
              onClick={() => navigate("/applicant/status")}
            >
              <Clock className="h-4 w-4" />
              Track Progress
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11"
              onClick={() => navigate("/applicant/profile")}
            >
              <Eye className="h-4 w-4" />
              My Profile
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No applications yet.</p>
              <Button variant="outline" onClick={() => navigate("/applicant/new")}>
                Create Your First Application
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/applicant/status?id=${app.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{app.application_no}</p>
                    <p className="truncate text-sm font-medium">{app.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.requested_house_category} &middot; {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "Not submitted"}
                    </p>
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
