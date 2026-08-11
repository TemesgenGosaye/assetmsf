import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import StatusChip from "@/components/ui/status-chip";
import DataTable, { type ColDef } from "@/components/table/DataTable";
import { normalizeRole } from "@/services/permissions";
import {
  Building2,
  Home,
  DoorOpen,
  Gauge,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wrench,
  CalendarClock,
  Boxes,
  AlertTriangle,
  User,
  Clock,
  Users,
  Activity,
  ArrowRight,
  Wand2,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  getHousingAnalytics,
  getAvailableHouses,
  getOccupancy,
  type HousingAnalytics,
  type AvailableHouse,
  type OccupancyRow,
  type HousingAlert,
} from "@/services/houseAnalytics";
import {
  getConflicts,
  getRecommendations,
  resolveConflict,
  type ConflictItem,
  type Recommendation,
} from "@/services/houseOperations";

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#f59e0b",
  "#e11d48",
  "#0891b2",
  "#ea580c",
  "#6366f1",
];

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-primary/30 bg-primary/5",
};

function pct(v: number | undefined | null) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return `${Math.round(Number(v))}%`;
}

function formatDays(d: number | undefined | null) {
  if (d === null || d === undefined || Number.isNaN(Number(d))) return "—";
  return `${Math.round(Number(d))}d`;
}

function isAdminOrManager() {
  try {
    const raw = localStorage.getItem("auth_user");
    const role = raw ? JSON.parse(raw).role || "" : "";
    return ["admin", "manager", "super_admin", "superadmin"].includes(normalizeRole(role));
  } catch {
    return false;
  }
}

export default function HouseCommandCenter() {
  const navigate = useNavigate();
  const canAdmin = isAdminOrManager();

  const [analytics, setAnalytics] = useState<HousingAnalytics | null>(null);
  const [available, setAvailable] = useState<AvailableHouse[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [houseTypeFilter, setHouseTypeFilter] = useState("");

  const loadAll = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const [a, av, occ] = await Promise.all([
          getHousingAnalytics({ force }),
          getAvailableHouses({ force }),
          getOccupancy({ force }),
        ]);
        setAnalytics(a);
        setAvailable(av);
        setOccupancy(occ);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load housing analytics");
      } finally {
        setLoading(false);
      }
      if (canAdmin) {
        try {
          const [c, r] = await Promise.all([getConflicts(), getRecommendations(12)]);
          setConflicts(c);
          setRecommendations(r);
          setConflictError(null);
        } catch (e: any) {
          setConflictError(e?.message || "Admin insights unavailable");
        }
      }
    },
    [canAdmin],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = () => loadAll(true);

  const RESOLVABLE_TYPES = new Set([
    "orphaned_allocation",
    "capacity_breach",
    "duplicate_application",
    "already_allocated",
  ]);

  const conflictTargetId = (c: ConflictItem): string | null =>
    c.type === "capacity_breach" ? c.house_id ?? null : c.applications?.[0]?.id ?? null;

  const handleResolve = async (c: ConflictItem) => {
    const targetId = conflictTargetId(c);
    if (!targetId) return;
    const key = `${c.type}:${targetId}`;
    setResolving(key);
    try {
      const res = await resolveConflict(c.type, targetId);
      setConflicts(res.conflicts);
      const r = res.resolved;
      const detail =
        r.action === "capacity_breach"
          ? `freed ${(r.freed ?? []).length} allocation(s) on ${r.house_id}`
          : r.action === "duplicate_application"
            ? `kept ${r.kept}, returned ${(r.returned ?? []).length} duplicate(s)`
            : `${r.application_no ?? "application"} → ${r.status ?? r.action.replace(/_/g, " ")}`;
      toast.success(`Conflict resolved — ${detail}`);
      void loadAll(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resolve conflict");
    } finally {
      setResolving(null);
    }
  };

  const kpis = analytics?.kpis;

  const occupancyByType = useMemo(
    () =>
      Object.entries(analytics?.occupancy_by_type ?? {}).map(([house_type, r], i) => ({
        house_type,
        occupied: r.occupied ?? 0,
        vacant: r.vacant ?? 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [analytics],
  );

  const trendData = useMemo(
    () =>
      (analytics?.allocation_trend_30d ?? []).map((p) => ({
        date: p.date,
        allocations: p.total ?? 0,
      })),
    [analytics],
  );

  const appByStatus = useMemo(() => {
    const s = analytics?.applications_by_status ?? {};
    return Object.entries(s)
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v], i) => ({ name: k, value: Number(v), fill: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [analytics]);

  const longWaitCount = useMemo(
    () => (analytics?.alerts?.items ?? []).filter((a) => a.kind === "long_wait").length,
    [analytics],
  );

  const damagedAvailable = useMemo(
    () => available.filter((h) => (h.damaged_items ?? []).length > 0).length,
    [available],
  );

  const filteredOccupancy = useMemo(
    () => (houseTypeFilter ? occupancy.filter((r) => r.house_type === houseTypeFilter) : occupancy),
    [occupancy, houseTypeFilter],
  );

  const houseTypes = useMemo(() => Array.from(new Set(occupancy.map((r) => r.house_type))).sort(), [occupancy]);

  const occupancyCols: ColDef<OccupancyRow>[] = [
    { key: "hid", header: "House", width: "w-28", sortable: true, pinned: true, value: (r) => r.hid },
    {
      key: "house_type",
      header: "Type",
      width: "w-20",
      sortable: true,
      value: (r) => r.house_type,
      cell: (r) => <Badge variant="outline">{r.house_type}</Badge>,
    },
    { key: "location", header: "Location", width: "min-w-[140px]", sortable: true, value: (r) => r.location },
    { key: "status", header: "Status", width: "w-24", value: (r) => r.status, badge: true },
    { key: "capacity", header: "Capacity", width: "w-20", align: "right", sortable: true, value: (r) => r.capacity },
    { key: "current_occupancy", header: "Occupied", width: "w-20", align: "right", sortable: true, value: (r) => r.current_occupancy },
    { key: "vacant", header: "Vacant", width: "w-20", align: "right", sortable: true, value: (r) => r.vacant },
    {
      key: "occupants",
      header: "Occupants",
      width: "min-w-[220px]",
      value: (r) => r.occupants.map((o) => o.employee_name).join(", "),
      cell: (r) =>
        r.occupants.length === 0 ? (
          <span className="text-muted-foreground/60">—</span>
        ) : (
          <div className="space-y-1">
            {r.occupants.map((o) => (
              <div key={o.application_id} className="flex items-center gap-1.5 text-xs">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{o.employee_name}</span>
                <span className="text-muted-foreground">({o.application_no})</span>
              </div>
            ))}
          </div>
        ),
    },
  ];

  if (loading && !analytics) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Housing" }, { label: "Command Center" }]} />
      <PageHeader
        icon={Activity}
        title="Housing Command Center"
        description="Live portfolio intelligence, allocation activity, alerts, and transparent recommendations."
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses")}>
              <Home className="mr-2 h-4 w-4" /> Houses
            </Button>
            <Button onClick={() => navigate("/houses/operations")}>
              <Wrench className="mr-2 h-4 w-4" /> Operations
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={Building2}
          title="Total Houses"
          value={kpis?.total_houses ?? 0}
          countValue={kpis?.total_houses ?? 0}
          variant="blue"
          onClick={() => navigate("/houses")}
        />
        <MetricCard
          icon={Users}
          title="Occupied"
          value={kpis?.occupied_units ?? 0}
          countValue={kpis?.occupied_units ?? 0}
          variant="emerald"
        />
        <MetricCard
          icon={DoorOpen}
          title="Vacant Units"
          value={kpis?.vacant_units ?? 0}
          countValue={kpis?.vacant_units ?? 0}
          variant="amber"
        />
        <MetricCard
          icon={Gauge}
          title="Occupancy Rate"
          value={pct(kpis?.occupancy_rate)}
          variant="cyan"
        />
        <MetricCard
          icon={Hourglass}
          title="Waiting Queue"
          value={kpis?.waiting_for_allocation ?? 0}
          countValue={kpis?.waiting_for_allocation ?? 0}
          variant="violet"
          caption={`Avg ${formatDays(analytics?.queue_stats?.avg_days)} | Max ${formatDays(analytics?.queue_stats?.max_days)}`}
          onClick={() => navigate("/house-opp/queue")}
        />
        <MetricCard
          icon={Clock}
          title="Long Waits (60d+)"
          value={longWaitCount}
          countValue={longWaitCount}
          variant="rose"
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by House Type</CardTitle>
            <CardDescription>Occupied vs vacant units per house type</CardDescription>
          </CardHeader>
          <CardContent>
            {occupancyByType.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No houses registered.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={occupancyByType} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="house_type" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} width={30} />
                  <RechartsTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="occupied" name="Occupied" radius={[4, 4, 0, 0]} fill="#2563eb" />
                  <Bar dataKey="vacant" name="Vacant" radius={[4, 4, 0, 0]} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation Activity — Last 30 Days</CardTitle>
            <CardDescription>Houses allocated per day across the estate</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No allocation activity recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} width={30} />
                  <RechartsTooltip cursor={{ stroke: "hsl(var(--border))" }} />
                  <Area
                    type="monotone"
                    dataKey="allocations"
                    name="Allocations"
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Availability + queue + applications ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary" /> Vacancy Insights
            </CardTitle>
            <CardDescription>Estate capacity and available pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Total capacity</span>
              <span className="text-lg font-bold tabular-nums">{kpis?.total_capacity ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Active houses</span>
              <span className="font-semibold tabular-nums">{kpis?.active_houses ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Available now</span>
              <span className="font-semibold tabular-nums text-emerald-600">{kpis?.available_houses ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Open maintenance</span>
              <span className="font-semibold tabular-nums text-amber-600">{kpis?.open_maintenance ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Available with damage</span>
              <span className="font-semibold tabular-nums text-rose-600">{damagedAvailable}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Guest houses</span>
              <span className="font-semibold tabular-nums">{kpis?.guest_houses ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" /> Applications by Status
            </CardTitle>
            <CardDescription>Live application pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {appByStatus.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No active applications.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={appByStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {appByStatus.map((s) => (
                        <Cell key={s.name} fill={s.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {appByStatus.map((s) => (
                    <Badge key={s.name} variant="outline" style={{ borderColor: s.fill }}>
                      <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: s.fill }} />
                      {s.name} · {s.value}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Alerts
              {analytics && analytics.alerts.items.length > 0 && (
                <Badge className="ml-auto">{analytics.alerts.items.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>Operational risks needing attention</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
            {!analytics || analytics.alerts.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                All clear — no alerts detected.
              </p>
            ) : (
              analytics.alerts.items.map((a, i) => <AlertRow key={i} alert={a} />)
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Admin: conflicts + recommendations ─────────────────────── */}
      {canAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" /> Conflict Scan
                <Badge className="ml-auto" variant="outline">
                  {conflicts.length}
                </Badge>
              </CardTitle>
              <CardDescription>Data-integrity and fairness issues detected</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
              {conflictError ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{conflictError}</p>
              ) : conflicts.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No conflicts found — records are consistent.
                </p>
              ) : (
                conflicts.map((c, i) => (
                  <div key={i} className={cn("rounded-lg border px-3 py-2", SEVERITY_STYLES[c.severity])}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold capitalize">
                        {c.type.replace(/_/g, " ")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <StatusChip status={c.severity} size="sm" />
                        {RESOLVABLE_TYPES.has(c.type) && conflictTargetId(c) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            disabled={resolving === `${c.type}:${conflictTargetId(c)}`}
                            onClick={() => void handleResolve(c)}
                            title={
                              c.type === "duplicate_application"
                                ? "Keep the first application and return the others"
                                : "Apply the audited auto-fix for this conflict"
                            }
                          >
                            {resolving === `${c.type}:${conflictTargetId(c)}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            Resolve
                          </Button>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Allocation Recommendations
              </CardTitle>
              <CardDescription>What the engine would do for each vacant unit — nothing is executed</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
              {recommendations.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No vacant units or waiting applicants right now.
                </p>
              ) : (
                recommendations.map((r) => (
                  <div key={r.house_id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {r.hid}{" "}
                        <Badge variant="outline" className="ml-1">
                          {r.house_type}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">{r.location}</span>
                    </div>
                    {r.candidate ? (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{r.candidate.employee_name}</span>
                        <span className="text-muted-foreground">({r.candidate.application_no})</span>
                        <Badge variant={r.constraint_ok ? "default" : "secondary"} className="ml-auto">
                          score {r.candidate.score.toFixed(2)}
                        </Badge>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No eligible applicant</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Occupancy register ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Occupancy Register</CardTitle>
            <CardDescription>Every house with its current occupants</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHouseTypeFilter("")}
              className={!houseTypeFilter ? "bg-accent" : ""}
            >
              All types
            </Button>
            {houseTypes.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() => setHouseTypeFilter(houseTypeFilter === t ? "" : t)}
                className={houseTypeFilter === t ? "bg-accent" : ""}
              >
                {t}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            tableKey="houses:occupancy"
            columns={occupancyCols}
            data={filteredOccupancy}
            rowKey={(r) => r.house_id}
            searchable
            searchPlaceholder="Search house, location, occupant…"
            pageSize={12}
            emptyMessage="No houses found."
            onRowDoubleClick={(r) => navigate(`/house-opp/${r.house_id}`)}
            recordDetail={{
              title: (r: OccupancyRow) => r.hid,
              subtitle: (r: OccupancyRow) => `${r.house_type} · ${r.location}`,
              icon: Home,
              badge: (r: OccupancyRow) => <StatusChip status={r.status} size="sm" />,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({ alert }: { alert: HousingAlert }) {
  const Icon = alert.severity === "critical" ? AlertTriangle : alert.severity === "warning" ? Clock : CalendarClock;
  return (
    <div className={cn("rounded-lg border px-3 py-2", SEVERITY_STYLES[alert.severity])}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-3.5 w-3.5" />
          {alert.title}
        </span>
        <StatusChip status={alert.severity} size="sm" />
      </div>
      {alert.detail && <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>}
    </div>
  );
}
