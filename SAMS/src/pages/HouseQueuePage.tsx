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

import StatusChip from "@/components/ui/status-chip";
import { listApplications, type HouseApplication } from "@/services/houseApplication";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Clock3,
  FileText,
  Home,
  Inbox,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

type QueueRow = HouseApplication & {
  queuePosition: number;
  queueTimestamp: string | null;
};

const CATEGORY_BADGE: Record<string, string> = {
  Staff: "bg-violet-500/10 text-violet-700 border-violet-300",
  A: "bg-blue-500/10 text-blue-700 border-blue-300",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  C: "bg-amber-500/10 text-amber-700 border-amber-300",
  D: "bg-orange-500/10 text-orange-700 border-orange-300",
  E: "bg-slate-500/10 text-slate-700 border-slate-300",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className={`text-xs font-medium ${CATEGORY_BADGE[category] || ""}`}>
      {category === "E" ? "Barrack" : category === "Staff" ? "Staff" : `Type ${category}`}
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
    : score >= 40 ? "bg-amber-500/10 text-amber-700 border-amber-300"
    : "bg-slate-500/10 text-slate-700 border-slate-300";
  return (
    <Badge variant="outline" className={`text-xs font-bold tabular-nums ${color}`}>
      {score.toFixed(1)}
    </Badge>
  );
}

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
        .filter((app) =>
          ["Submitted", "Under Review", "Verified", "Waiting for Allocation", "Allocated"].includes(app.status)
        )
        .sort((a, b) => {
          // Put Allocated at the bottom or sort purely by score/FIFO
          if (a.status === "Allocated" && b.status !== "Allocated") return 1;
          if (b.status === "Allocated" && a.status !== "Allocated") return -1;
          const scoreDiff = (b.priority_score || 0) - (a.priority_score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          const aTime = new Date(a.submitted_at || a.created_at).getTime();
          const bTime = new Date(b.submitted_at || b.created_at).getTime();
          return aTime - bTime;
        })
        .map((app, index) => ({
          ...app,
          queuePosition: app.queue_position ?? index + 1,
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
    const averageScore = houseQueue.length
      ? (houseQueue.reduce((sum, app) => sum + (app.priority_score || 0), 0) / houseQueue.length).toFixed(1)
      : "0.0";

    return {
      total: houseQueue.length,
      withDocuments,
      disabilityFlagged,
      averageFamilySize,
      averageScore,
    };
  }, [houseQueue]);

  const queueColumns = useMemo(
    (): ColDef<QueueRow>[] => [
      {
        key: "queuePosition",
        header: "Rank",
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
        key: "priority_score",
        header: "Score",
        width: "w-24",
        sortable: true,
        align: "center",
        value: (app) => app.priority_score || 0,
        cell: (app) => <ScoreBadge score={app.priority_score || 0} />,
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
              {app.job_position || "—"}
            </p>
          </div>
        ),
      },
      {
        key: "gender",
        header: "Gender",
        width: "w-24",
        sortable: true,
        value: (app) => app.gender,
      },
      {
        key: "job_grade",
        header: "Grade",
        width: "w-20",
        sortable: true,
        value: (app) => app.job_grade,
        cell: (app) => app.job_grade || "—",
      },
      {
        key: "years_of_service",
        header: "Years",
        width: "w-20",
        sortable: true,
        align: "center",
        value: (app) => app.years_of_service,
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
        header: "Family",
        width: "w-20",
        sortable: true,
        align: "center",
        value: (app) => app.family_size,
      },
      {
        key: "eligible_house_category",
        header: "Eligible",
        width: "w-28",
        sortable: true,
        value: (app) => app.eligible_house_category || "",
        cell: (app) => app.eligible_house_category
          ? <CategoryBadge category={app.eligible_house_category} />
          : <span className="text-xs text-muted-foreground">—</span>,
      },
      {
        key: "requested_house_category",
        header: "Requested",
        width: "w-28",
        sortable: true,
        value: (app) => app.requested_house_category,
        cell: (app) => <CategoryBadge category={app.requested_house_category} />,
      },
      {
        key: "queueTimestamp",
        header: "Submitted",
        width: "min-w-[160px]",
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
        width: "w-36",
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
              Review
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
            description="Ranked by priority score. Higher score = higher priority. FIFO is the tie-breaker."
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
              <Trophy className="h-3 w-3" />
              Priority Score Ranked
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              FIFO Tie-Breaker
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { icon: Inbox, label: "Queued", value: metrics.total, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-l-blue-500" },
          { icon: Award, label: "Avg Score", value: metrics.averageScore, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-l-violet-500" },
          { icon: FileText, label: "With Docs", value: metrics.withDocuments, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-l-emerald-500" },
          { icon: ShieldCheck, label: "Disability", value: metrics.disabilityFlagged, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-l-rose-500" },
          { icon: Users, label: "Avg Family", value: metrics.averageFamilySize, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-l-amber-500" },
        ].map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-2.5 rounded-lg border-l-[3px] ${s.border} ${s.bg} px-3 py-2.5`}
          >
            <s.icon className={`h-4 w-4 shrink-0 ${s.color}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="text-base font-bold tabular-nums leading-tight text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
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
