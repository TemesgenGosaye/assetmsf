import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import {
  Package,
  Banknote,
  TrendingDown,
  RefreshCw,
  ShieldAlert,
  Wrench,
  CalendarClock,
  Layers,
  Building2,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  fetchAssetAnalytics,
  recalculateDepreciation,
  type AssetAnalytics,
} from "@/services/assetAnalytics";

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

function formatMoney(v: number | undefined | null) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function AssetAnalytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AssetAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAssetAnalytics();
        if (!cancelled) setAnalytics(data);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      const result = await recalculateDepreciation();
      toast.success(`Depreciation recalculated for ${result.updated} asset(s)`);
      const data = await fetchAssetAnalytics({ force: true });
      setAnalytics(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to recalculate depreciation");
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchAssetAnalytics({ force: true });
      setAnalytics(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh analytics");
    } finally {
      setLoading(false);
    }
  };

  const totalPurchase = analytics?.totals.total_purchase_cost ?? 0;
  const totalCurrent = analytics?.totals.total_current_value ?? 0;
  const totalDepr = analytics?.totals.total_accumulated_depreciation ?? 0;
  const healthPct =
    totalPurchase > 0 ? Math.max(0, Math.min(100, (totalCurrent / totalPurchase) * 100)) : 0;

  const statusPieData = useMemo(
    () =>
      (analytics?.status_breakdown ?? []).map((r, i) => ({
        ...r,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [analytics],
  );

  const conditionData = useMemo(() => (analytics?.condition_breakdown ?? []).slice(0, 6), [analytics]);
  const categoryData = useMemo(() => (analytics?.category_breakdown ?? []).slice(0, 8), [analytics]);
  const deptData = useMemo(() => (analytics?.department_breakdown ?? []).slice(0, 8), [analytics]);

  if (loading) return <PageSkeleton />;

  const warranty = analytics?.warranty;
  const amc = analytics?.amc;
  const mnt = analytics?.maintenance;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Assets", href: "/assets" }, { label: "Analytics" }]}
      />
      <PageHeader
        icon={Activity}
        title="Asset Analytics"
        amharicTitle="የንብረት አስተዳደር"
        description="Enterprise-wide portfolio intelligence, lifecycle health, and financial projection."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/assets")}
            >
              <Package className="mr-2 h-4 w-4" /> All Assets
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={handleRecalculate} disabled={recalcLoading}>
              <TrendingDown className="mr-2 h-4 w-4" />
              {recalcLoading ? "Recalculating…" : "Recompute Depreciation"}
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Package}
          title="Total Assets"
          value={analytics?.totals.total_assets ?? 0}
          caption={`${(analytics?.totals.total_quantity ?? 0).toLocaleString()} units tracked`}
          variant="blue"
        />
        <MetricCard
          icon={Banknote}
          title="Portfolio Value"
          value={formatMoney(totalCurrent)}
          caption={`Purchase cost ${formatMoney(totalPurchase)}`}
          variant="emerald"
        />
        <MetricCard
          icon={TrendingDown}
          title="Depreciation"
          value={formatMoney(totalDepr)}
          caption={`${healthPct.toFixed(0)}% of book value retained`}
          variant="amber"
        />
        <MetricCard
          icon={ShieldAlert}
          title="Warranty / AMC"
          value={`${(warranty?.expired ?? 0) + (amc?.expired ?? 0)}`}
          caption={`${(warranty?.expiring_30 ?? 0) + (amc?.expiring_30 ?? 0)} expiring in 30d`}
          variant="rose"
        />
      </div>

      {/* Status + Condition */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Status</CardTitle>
            <CardDescription>Current lifecycle status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPieData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No data</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Condition Breakdown</CardTitle>
            <CardDescription>Physical condition across the portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={conditionData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="label" width={90} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    "Assets",
                  ]}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category + Department */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Categories</CardTitle>
            <CardDescription>Assets by category and book value</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value.toLocaleString() : formatMoney(value),
                    name === "count" ? "Assets" : "Value",
                  ]}
                />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Departments</CardTitle>
            <CardDescription>Asset concentration by department</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="label" width={110} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value.toLocaleString() : formatMoney(value),
                    name === "count" ? "Assets" : "Value",
                  ]}
                />
                <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Acquisitions + Projection */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Acquisitions</CardTitle>
            <CardDescription>Last 12 months of asset purchases</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics?.monthly_acquisitions ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value.toLocaleString() : formatMoney(value),
                    name === "count" ? "Assets" : "Value",
                  ]}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">5-Year Book Value Projection</CardTitle>
            <CardDescription>Projected depreciation curve for the portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={analytics?.projection ?? []}>
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tickFormatter={(y: number) => `Year ${y}`}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis tickFormatter={(v) => formatMoney(v)} stroke="hsl(var(--muted-foreground))" width={80} />
                <RechartsTooltip formatter={(value: number) => [formatMoney(value), "Book Value"]} />
                <Area type="monotone" dataKey="value" stroke="#0891b2" fill="url(#projGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Compliance + Maintenance summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warranty & AMC Compliance</CardTitle>
            <CardDescription>Contract health at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {[
                { label: "Active", value: warranty?.active, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
                { label: "30d", value: warranty?.expiring_30, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
                { label: "90d", value: warranty?.expiring_90, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
                { label: "Expired", value: warranty?.expired, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
                { label: "None", value: warranty?.none, tone: "bg-muted text-muted-foreground" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border p-2">
                  <div className={`mx-auto mb-1 w-fit rounded px-1.5 py-0.5 font-bold ${c.tone}`}>{c.value ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {[
                { label: "Active", value: amc?.active, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
                { label: "30d", value: amc?.expiring_30, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
                { label: "90d", value: amc?.expiring_90, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
                { label: "Expired", value: amc?.expired, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
                { label: "None", value: amc?.none, tone: "bg-muted text-muted-foreground" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border p-2">
                  <div className={`mx-auto mb-1 w-fit rounded px-1.5 py-0.5 font-bold ${c.tone}`}>{c.value ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/assets/compliance")}
              >
                <ShieldAlert className="mr-2 h-4 w-4" /> Compliance Details
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance Health</CardTitle>
            <CardDescription>Work order and preventive schedule summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" /> Open Tickets
                </p>
                <p className="mt-1 text-2xl font-bold">{mnt?.open_tickets ?? 0}</p>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {mnt?.overdue_tickets ?? 0} overdue
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Preventive Schedules
                </p>
                <p className="mt-1 text-2xl font-bold">{mnt?.schedules_due_30d ?? 0}</p>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {mnt?.schedules_overdue ?? 0} overdue
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> Actual Cost
                </p>
                <p className="mt-1 text-xl font-bold">{formatMoney(mnt?.total_actual_cost)}</p>
                <p className="text-xs text-muted-foreground">
                  est. {formatMoney(mnt?.total_estimated_cost)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Resolved
                </p>
                <p className="mt-1 text-2xl font-bold">{mnt?.resolved_30d ?? 0}</p>
                <p className="text-xs text-muted-foreground">in the last 30 days</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/maintenance")}
              >
                <Wrench className="mr-2 h-4 w-4" /> Maintenance Center
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Depreciation method breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Depreciation Methods</CardTitle>
          <CardDescription>Accounting method distribution across assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(analytics?.depreciation_method_breakdown ?? []).map((m) => (
              <div key={m.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Badge variant="secondary">{m.label}</Badge>
                <span className="text-lg font-bold">{m.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
