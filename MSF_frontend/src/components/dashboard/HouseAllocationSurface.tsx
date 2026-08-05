import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listHouses,
  HOUSE_TYPES,
  type House,
  type HouseType,
} from "@/services/houses";
import {
  Activity,
  Home,
  KeyRound,
  RefreshCw,
  Users,
  Waves,
  Wrench,
  Power,
  PowerOff,
  Gauge,
  BarChart3,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  Staff: "Staff",
  A: "Type A",
  B: "Type B",
  C: "Type C",
  D: "Type D",
  E: "Barrack",
};

type TypeRow = {
  type: HouseType;
  label: string;
  total: number;
  assigned: number;
  vacant: number;
  active: number;
  inactive: number;
  damaged: number;
};

const EMPTY_ROW = (type: HouseType): TypeRow => ({
  type,
  label: TYPE_LABEL[type] ?? type,
  total: 0,
  assigned: 0,
  vacant: 0,
  active: 0,
  inactive: 0,
  damaged: 0,
});

const CHART_COLORS = {
  assigned: "hsl(160, 84%, 39%)",
  assignedSoft: "hsl(160, 84%, 39%)",
  vacant: "hsl(199, 89%, 48%)",
  inactive: "hsl(339, 90%, 51%)",
  active: "hsl(191, 91%, 46%)",
};

function buildRows(houses: House[]): TypeRow[] {
  const rows = HOUSE_TYPES.map(EMPTY_ROW);
  houses.forEach((h) => {
    const tIdx = HOUSE_TYPES.indexOf(h.house_type);
    if (tIdx < 0) return;
    const row = rows[tIdx];
    row.total += 1;
    const isAssigned = Boolean(
      h.assigned_employee_id ||
        h.assigned_employee_name ||
        h.assigned_application_no,
    );
    if (isAssigned) row.assigned += 1;
    else row.vacant += 1;
    const inactive = String(h.status || "").toLowerCase() === "inactive";
    if (inactive || h.is_active === false) row.inactive += 1;
    else row.active += 1;
    if (
      h.damaged_door ||
      h.damaged_windows ||
      h.damaged_walls ||
      h.damaged_switch ||
      h.damaged_bulb ||
      h.damaged_water
    ) {
      row.damaged += 1;
    }
  });
  return rows.filter((r) => r.total > 0).length
    ? rows.filter((r) => r.total > 0)
    : HOUSE_TYPES.map(EMPTY_ROW);
}

function sampleRows(): TypeRow[] {
  const base = [
    { type: "Staff" as HouseType, total: 12, assigned: 9, inactive: 1, damaged: 2 },
    { type: "A" as HouseType, total: 24, assigned: 18, inactive: 2, damaged: 3 },
    { type: "B" as HouseType, total: 30, assigned: 21, inactive: 3, damaged: 1 },
    { type: "C" as HouseType, total: 28, assigned: 19, inactive: 4, damaged: 4 },
    { type: "D" as HouseType, total: 20, assigned: 11, inactive: 5, damaged: 2 },
    { type: "E" as HouseType, total: 16, assigned: 6, inactive: 7, damaged: 3 },
  ];
  return base.map((b) => ({
    ...EMPTY_ROW(b.type),
    ...b,
    vacant: b.total - b.assigned,
    active: b.total - b.inactive,
  }));
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: entry.color || entry.stroke,
                opacity: entry.fill ? 0.9 : 1,
              }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">
              {Number(entry.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LegendIcon = ({ color, dashed }: { color: string; dashed?: boolean }) => (
  <span
    className="inline-block h-0.5 w-3 rounded-full"
    style={{
      backgroundColor: dashed ? "transparent" : color,
      borderTop: dashed ? `2px dashed ${color}` : "none",
    }}
  />
);

export function HouseAllocationSurface({
  houses: initialHouses,
}: {
  houses: House[];
}) {
  const [houses, setHouses] = useState<House[]>(initialHouses);
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setHouses(initialHouses);
  }, [initialHouses]);

  const refresh = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const fresh = await listHouses();
      setHouses(fresh);
      setLastUpdated(Date.now());
    } catch {
      // keep the last known chart when the API is unreachable
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh(true);
    }, 25_000);
    return () => window.clearInterval(id);
  }, []);

  const previewMode = houses.length === 0;
  const rows = useMemo(
    () => (previewMode ? sampleRows() : buildRows(houses)),
    [houses, previewMode],
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        assigned: acc.assigned + r.assigned,
        vacant: acc.vacant + r.vacant,
        active: acc.active + r.active,
        inactive: acc.inactive + r.inactive,
        damaged: acc.damaged + r.damaged,
      }),
      { total: 0, assigned: 0, vacant: 0, active: 0, inactive: 0, damaged: 0 },
    );
  }, [rows]);

  const occupancyRate = totals.total
    ? Math.round((totals.assigned / totals.total) * 100)
    : 0;
  const activeRate = totals.total
    ? Math.round((totals.active / totals.total) * 100)
    : 0;

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        label: r.label,
        total: r.total,
        assigned: r.assigned,
        vacant: r.vacant,
        inactive: r.inactive,
      })),
    [rows],
  );

  const stats: Array<{
    key: string;
    title: string;
    value: number;
    suffix?: string;
    icon: typeof Home;
    tint: string;
  }> = [
    {
      key: "total",
      title: "Total Houses",
      value: totals.total,
      icon: Home,
      tint: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "assigned",
      title: "Users Assigned",
      value: totals.assigned,
      icon: KeyRound,
      tint: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "vacant",
      title: "Not Assigned",
      value: totals.vacant,
      icon: Users,
      tint: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "active",
      title: "Active Houses",
      value: totals.active,
      icon: Power,
      tint: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "inactive",
      title: "Inactive Houses",
      value: totals.inactive,
      icon: PowerOff,
      tint: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "damaged",
      title: "Needs Repair",
      value: totals.damaged,
      icon: Wrench,
      tint: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <CardHeader className="flex flex-col gap-3 pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
              <Waves className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base text-foreground">
                House Allocation Overview
              </CardTitle>
              <CardDescription className="max-w-2xl">
                Live XY view of unit types against allocation — how many A, B,
                C, D and E houses exist, which users are assigned, and which
                units are active or inactive.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => void refresh()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {previewMode && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            No house records yet — showing a sample breakdown. Register houses
            to see live allocation data.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 ring-1 ring-border/60">
                <s.icon className={cn("h-4.5 w-4.5", s.tint)} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.title}
                </p>
                <p className="text-lg font-bold tracking-tight text-foreground">
                  {s.value.toLocaleString()}
                  {s.suffix ?? ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.7fr,1fr]">
          <div className="min-w-0">
            <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/40 to-background p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <LegendIcon color={CHART_COLORS.assigned} />
                    Assigned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <LegendIcon color={CHART_COLORS.vacant} />
                    Not assigned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <LegendIcon color={CHART_COLORS.inactive} dashed />
                    Inactive
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Updated {formatTime(lastUpdated)}
                </span>
              </div>
              <div className="h-[300px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient
                        id="assignedGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={CHART_COLORS.assigned}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor={CHART_COLORS.assigned}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                      <linearGradient
                        id="vacantGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={CHART_COLORS.vacant}
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor={CHART_COLORS.vacant}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeWidth={1.5}
                      opacity={0.75}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickLine={{
                        stroke: "hsl(var(--muted-foreground))",
                        strokeWidth: 1.5,
                      }}
                      axisLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 2.5,
                      }}
                      dy={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickLine={{
                        stroke: "hsl(var(--muted-foreground))",
                        strokeWidth: 1.5,
                      }}
                      axisLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 2.5,
                      }}
                      dx={-6}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--muted-foreground))" }} />
                    <Area
                      type="monotone"
                      dataKey="assigned"
                      name="Assigned"
                      stackId="a"
                      stroke={CHART_COLORS.assigned}
                      strokeWidth={2.5}
                      fill="url(#assignedGrad)"
                      dot={{ r: 3, fill: CHART_COLORS.assigned, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={700}
                    />
                    <Area
                      type="monotone"
                      dataKey="vacant"
                      name="Not assigned"
                      stackId="a"
                      stroke={CHART_COLORS.vacant}
                      strokeWidth={2.5}
                      fill="url(#vacantGrad)"
                      dot={{ r: 3, fill: CHART_COLORS.vacant, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={700}
                    />
                    <Line
                      type="monotone"
                      dataKey="inactive"
                      name="Inactive"
                      stroke={CHART_COLORS.inactive}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: CHART_COLORS.inactive, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={700}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <div
                  key={r.type}
                  className="rounded-xl border border-border/50 bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {r.label}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-background/70 font-medium"
                    >
                      {r.total.toLocaleString()} units
                    </Badge>
                  </div>
                  <div className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-l-full"
                      style={{
                        width: `${r.total ? (r.assigned / r.total) * 100 : 0}%`,
                        background: CHART_COLORS.assigned,
                      }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{
                        width: `${r.total ? (r.vacant / r.total) * 100 : 0}%`,
                        background: CHART_COLORS.vacant,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: CHART_COLORS.assigned }}
                      />
                      {r.assigned.toLocaleString()} assigned
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: CHART_COLORS.vacant }}
                      />
                      {r.vacant.toLocaleString()} free
                    </span>
                    <span
                      className={
                        r.inactive
                          ? "inline-flex items-center gap-1 text-rose-500 dark:text-rose-400"
                          : "inline-flex items-center gap-1"
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: CHART_COLORS.inactive }}
                      />
                      {r.inactive.toLocaleString()} inactive
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Allocation by type
                </span>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CHART_COLORS.assigned }}
                    />
                    Assigned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CHART_COLORS.vacant }}
                    />
                    Free
                  </span>
                </div>
              </div>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeWidth={1.5}
                      opacity={0.75}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickLine={false}
                      axisLine={{
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 2,
                      }}
                      dy={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{
                        fill: "hsl(var(--muted-foreground))",
                        opacity: 0.08,
                      }}
                    />
                    <Bar
                      dataKey="assigned"
                      name="Assigned"
                      stackId="a"
                      fill={CHART_COLORS.assigned}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="vacant"
                      name="Not assigned"
                      stackId="a"
                      fill={CHART_COLORS.vacant}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(value: number) => value.toLocaleString()}
                        style={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-border/40">
                <div className="grid grid-cols-4 gap-2 border-b border-border/40 bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Type</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Assigned</span>
                  <span className="text-right">Unassigned</span>
                </div>
                {rows.map((r) => (
                  <div
                    key={r.type}
                    className="grid grid-cols-4 gap-2 border-b border-border/30 px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="font-medium text-foreground">
                      {r.label}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-foreground">
                      {r.total.toLocaleString()}
                    </span>
                    <span className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.assigned.toLocaleString()}
                    </span>
                    <span className="text-right font-medium tabular-nums text-amber-600 dark:text-amber-400">
                      {r.vacant.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  Occupancy {occupancyRate}%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Power className="h-3.5 w-3.5 text-primary" />
                  Active {activeRate}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs repair
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-orange-500 dark:text-orange-400">
                  {totals.damaged.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  units out of service
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Unit types
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                  {rows.length}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Staff • A–E categories
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
