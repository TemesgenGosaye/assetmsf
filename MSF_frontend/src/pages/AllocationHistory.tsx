import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  History,
  RefreshCw,
  Sparkles,
  KeyRound,
  User,
  FileText,
  ArrowRight,
  ScrollText,
} from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listAllocationLogs,
  type AllocationLog,
} from "@/services/houseApplication";
import { invalidateCache } from "@/lib/data-cache";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtScore(value?: number): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(1);
}

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Allocated: "default",
  "Auto-Allocated": "default",
  "Manual Override": "destructive",
  Deallocated: "destructive",
  Transferred: "secondary",
  "Queue Joined": "secondary",
  "Queue Left": "secondary",
  "Status Changed": "outline",
};

export default function AllocationHistory() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState<AllocationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await listAllocationLogs({ force });
      setLogs(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load allocation history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () => ({
      total: logs.length,
      allocated: logs.filter((l) => ["Allocated", "Auto-Allocated", "Manual Override"].includes(l.action)).length,
      deallocated: logs.filter((l) => l.action === "Deallocated").length,
      transferred: logs.filter((l) => l.action === "Transferred").length,
      statusChanges: logs.filter((l) => l.action === "Status Changed").length,
    }),
    [logs],
  );

  const columns: ColDef<AllocationLog>[] = useMemo(
    () => [
      {
        key: "created_at",
        header: "Timestamp",
        width: "w-40",
        sortable: true,
        pinned: true,
        value: (r) => r.created_at,
        cell: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>,
      },
      {
        key: "application_no",
        header: "Application",
        width: "w-28",
        sortable: true,
        value: (r) => r.application_no,
        cell: (r) => <span className="font-medium text-foreground">{r.application_no}</span>,
      },
      {
        key: "employee_name",
        header: "Employee",
        width: "min-w-[180px]",
        sortable: true,
        value: (r) => r.employee_name,
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{r.employee_name}</span>
          </div>
        ),
      },
      {
        key: "action",
        header: "Action",
        width: "w-32",
        sortable: true,
        value: (r) => r.action,
        cell: (r) => (
          <Badge variant={ACTION_BADGE_VARIANT[r.action] ?? "secondary"} className="text-[11px]">
            {r.action}
          </Badge>
        ),
      },
      {
        key: "house_id",
        header: "House",
        width: "w-28",
        sortable: true,
        value: (r) => r.house_id ?? "",
        cell: (r) => <span className="text-muted-foreground">{r.house_id || "—"}</span>,
      },
      {
        key: "priority_score",
        header: "Score",
        width: "w-20",
        align: "right",
        sortable: true,
        value: (r) => r.priority_score,
        cell: (r) => fmtScore(r.priority_score),
      },
      {
        key: "eligible_category",
        header: "Category",
        width: "w-24",
        sortable: true,
        value: (r) => r.eligible_category,
        cell: (r) => (r.eligible_category ? <Badge variant="outline">{r.eligible_category}</Badge> : <span className="text-muted-foreground">—</span>),
      },
      {
        key: "performed_by_name",
        header: "Performed By",
        width: "w-32",
        sortable: true,
        value: (r) => r.performed_by_name ?? "",
        cell: (r) => <span className="text-muted-foreground">{r.performed_by_name || "—"}</span>,
      },
      {
        key: "notes",
        header: "Notes",
        width: "min-w-[220px]",
        value: (r) => r.notes,
        cell: (r) => (
          <span className="block truncate text-muted-foreground">{r.notes || "—"}</span>
        ),
      },
    ],
    [],
  );

  const actionOptions = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => l.action)))
        .sort()
        .map((a) => ({ label: a, value: a })),
    [logs],
  );

  if (loading && logs.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Housing" }, { label: "Allocation History" }]} />
      <PageHeader
        icon={History}
        title="Allocation History"
        description="Immutable audit trail of every allocation action across the housing program."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                invalidateCache("allocation-logs:list");
                void load(true);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses/allocate")}>
              <Sparkles className="mr-2 h-4 w-4" /> Allocation Console
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses/allocations")}>
              <KeyRound className="mr-2 h-4 w-4" /> Allocated Houses
            </Button>
            <Button onClick={() => navigate("/houses/command-center")}>
              Command Center <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ScrollText}
          title="Audit Events"
          value={summary.total}
          countValue={summary.total}
          variant="blue"
        />
        <MetricCard
          icon={FileText}
          title="Allocations"
          value={summary.allocated}
          countValue={summary.allocated}
          variant="emerald"
          caption="Allocated / Auto / Override"
        />
        <MetricCard
          icon={ArrowRight}
          title="Deallocations"
          value={summary.deallocated}
          countValue={summary.deallocated}
          variant="rose"
        />
        <MetricCard
          icon={RefreshCw}
          title="Status Changes"
          value={summary.statusChanges}
          countValue={summary.statusChanges}
          variant="amber"
        />
      </div>

      <DataTable<AllocationLog>
        tableKey="allocation-history"
        columns={columns}
        data={logs}
        rowKey={(r) => r.id}
        loading={loading}
        title="Allocation Audit Log"
        emptyMessage="No allocation history recorded"
        filters={[{ key: "action", label: "Action", options: actionOptions }]}
        pageSize={25}
        exportFileName="allocation-history"
        searchPlaceholder="Search application no., employee, house, actor…"
      />
    </div>
  );
}
