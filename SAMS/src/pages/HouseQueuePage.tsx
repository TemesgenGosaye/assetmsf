import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import MetricCard from "@/components/ui/metric-card";
import StatusChip from "@/components/ui/status-chip";
import { listApplications, type HouseApplication } from "@/services/houseApplication";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FileText,
  Home,
  Inbox,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

type QueueRow = HouseApplication & {
  queuePosition: number;
  queueTimestamp: string | null;
};

export default function HouseQueuePage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<HouseApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listApplications();
      setApplications(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load house queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const houseQueue = useMemo<QueueRow[]>(
    () =>
      applications
        .filter((app) => app.status === "Submitted")
        .sort((a, b) => {
          const aTime = new Date(a.submitted_at || a.created_at).getTime();
          const bTime = new Date(b.submitted_at || b.created_at).getTime();
          return aTime - bTime;
        })
        .map((app, index) => ({
          ...app,
          queuePosition: index + 1,
          queueTimestamp: app.submitted_at || app.created_at,
        })),
    [applications],
  );

  const metrics = useMemo(() => {
    const withDocuments = houseQueue.filter((app) => Boolean(app.supporting_document)).length;
    const disabilityFlagged = houseQueue.filter((app) => app.has_disability).length;
    const averageFamilySize = houseQueue.length
      ? (houseQueue.reduce((sum, app) => sum + (app.family_size || 0), 0) / houseQueue.length).toFixed(1)
      : "0.0";

    return {
      total: houseQueue.length,
      withDocuments,
      disabilityFlagged,
      averageFamilySize,
    };
  }, [houseQueue]);

  const queueColumns = useMemo(
    (): ColDef<QueueRow>[] => [
      {
        key: "queuePosition",
        header: "Queue #",
        width: "w-20",
        pinned: true,
        align: "center",
        sortable: true,
        value: (app) => app.queuePosition,
        cell: (app) => (
          <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {app.queuePosition}
          </span>
        ),
      },
      {
        key: "application_no",
        header: "Application",
        width: "w-36",
        sortable: true,
        value: (app) => app.application_no,
        cell: (app) => (
          <span className="font-mono text-xs text-muted-foreground">{app.application_no}</span>
        ),
      },
      {
        key: "employee_id",
        header: "Employee ID",
        width: "w-32",
        sortable: true,
        value: (app) => app.employee_id,
      },
      {
        key: "employee_name",
        header: "Employee Name",
        width: "min-w-[220px]",
        sortable: true,
        value: (app) => app.employee_name,
        cell: (app) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{app.employee_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {app.requester_name || app.requester || "Applicant"}
            </p>
          </div>
        ),
      },
      {
        key: "national_id",
        header: "National ID",
        width: "w-40",
        sortable: true,
        value: (app) => app.national_id,
      },
      {
        key: "gender",
        header: "Gender",
        width: "w-24",
        sortable: true,
        value: (app) => app.gender,
      },
      {
        key: "job_position",
        header: "Job Position",
        width: "min-w-[180px]",
        sortable: true,
        value: (app) => app.job_position,
      },
      {
        key: "job_grade",
        header: "Job Grade",
        width: "w-28",
        sortable: true,
        value: (app) => app.job_grade,
        cell: (app) => app.job_grade || "—",
      },
      {
        key: "years_of_service",
        header: "Years",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.years_of_service,
      },
      {
        key: "marital_status",
        header: "Marital",
        width: "w-32",
        sortable: true,
        value: (app) => app.marital_status,
      },
      {
        key: "has_disability",
        header: "Disability",
        width: "w-28",
        sortable: true,
        align: "center",
        value: (app) => (app.has_disability ? "Yes" : "No"),
        cell: (app) => (
          <Badge
            variant="outline"
            className={app.has_disability ? "border-amber-300 bg-amber-500/10 text-amber-700" : ""}
          >
            {app.has_disability ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        key: "family_size",
        header: "Family Size",
        width: "w-28",
        sortable: true,
        align: "center",
        value: (app) => app.family_size,
      },
      {
        key: "number_of_children",
        header: "Children",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.number_of_children,
      },
      {
        key: "requested_house_category",
        header: "Requested",
        width: "w-32",
        sortable: true,
        value: (app) => app.requested_house_category,
        cell: (app) => (
          <Badge variant="outline" className="text-xs font-medium">
            {app.requested_house_category === "E"
              ? "Barrack"
              : app.requested_house_category === "Staff"
                ? "Staff"
                : `Type ${app.requested_house_category}`}
          </Badge>
        ),
      },
      {
        key: "preferred_location",
        header: "Preferred Location",
        width: "min-w-[180px]",
        sortable: true,
        value: (app) => app.preferred_location,
        cell: (app) => app.preferred_location || "—",
      },
      {
        key: "reason_for_request",
        header: "Reason",
        width: "min-w-[280px]",
        sortable: true,
        value: (app) => app.reason_for_request,
        cell: (app) => (
          <p className="line-clamp-2 max-w-[320px] text-sm text-muted-foreground">
            {app.reason_for_request || "—"}
          </p>
        ),
      },
      {
        key: "supporting_document",
        header: "Document",
        width: "w-28",
        align: "center",
        value: (app) => (app.supporting_document ? "Yes" : "No"),
        cell: (app) =>
          app.supporting_document ? (
            <Button size="sm" variant="ghost" asChild>
              <a href={app.supporting_document} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                Open
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "queueTimestamp",
        header: "Submitted At",
        width: "min-w-[170px]",
        sortable: true,
        value: (app) => app.queueTimestamp,
        cell: (app) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {app.queueTimestamp ? new Date(app.queueTimestamp).toLocaleString() : "—"}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "w-32",
        sortable: true,
        value: (app) => app.status,
        cell: (app) => <StatusChip status={app.status} />,
      },
      {
        key: "actions",
        header: "",
        width: "w-32",
        align: "right",
        pinned: true,
        cell: (app) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              className="h-8 gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/house-opp/queue/${app.id}`);
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Open
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 p-6 pb-10">
      <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }, { label: "House Queue" }]} />

      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_35%)]" />
        <div className="relative space-y-6 p-6 md:p-8">
          <PageHeader
            icon={Inbox}
            title="House Queue"
            description="FIFO queue of submitted applicant requests. Oldest submitted request is first in line."
            actions={
              <>
                <Button variant="outline" onClick={() => navigate("/house-opp")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to House Opp
                </Button>
                <Button variant="outline" onClick={() => void fetchQueue()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary">
              {metrics.total} active in queue
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              FIFO Standard
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              Full Applicant Fields
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Inbox}
          title="Queued Requests"
          value={metrics.total}
          caption="Submitted and waiting in FIFO order"
          variant="blue"
        />
        <MetricCard
          icon={FileText}
          title="With Documents"
          value={metrics.withDocuments}
          caption="Requests that include supporting files"
          variant="emerald"
        />
        <MetricCard
          icon={ShieldCheck}
          title="Disability Flagged"
          value={metrics.disabilityFlagged}
          caption="Requests marked with accessibility needs"
          variant="amber"
        />
        <MetricCard
          icon={Users}
          title="Avg Family Size"
          value={metrics.averageFamilySize}
          caption="Average household size across queued requests"
          variant="violet"
        />
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardContent className="p-0">
          <DataTable<QueueRow>
            tableKey="house-queue-page"
            data={houseQueue}
            rowKey={(app) => app.id}
            loading={loading}
            searchable
            emptyMessage="No submitted applications in queue"
            emptyIcon={<Inbox className="h-8 w-8 text-muted-foreground/30" />}
            exportFileName={`house-queue-${new Date().toISOString().slice(0, 10)}`}
            pageSize={25}
            onRowDoubleClick={(app) => navigate(`/house-opp/queue/${app.id}`)}
            columns={queueColumns}
          />
        </CardContent>
      </Card>
    </div>
  );
}
