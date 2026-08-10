import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MetricCard from "@/components/ui/metric-card";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Legend,
} from "recharts";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import { Wrench, CheckCircle2, CalendarClock, Clock, Plus, RefreshCw, Package } from "lucide-react";
import {
  fetchMaintenanceSchedules,
  fetchMaintenanceAnalytics,
  performMaintenanceSchedule,
  createMaintenanceSchedule,
  type MaintenanceSchedule,
  type MaintenanceAnalytics,
  type MaintenanceFrequency,
} from "@/services/maintenanceSchedules";
import { listAssets, type Asset } from "@/services/assets";

const CHART_COLORS = ["#2563eb", "#7c3aed", "#059669", "#f59e0b", "#e11d48", "#0891b2"];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};

function formatMoney(v: number | undefined | null) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function Maintenance() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [analytics, setAnalytics] = useState<MaintenanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [performing, setPerforming] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset: "",
    name: "",
    description: "",
    frequency: "monthly" as MaintenanceFrequency,
    start_date: "",
    assigned_to: "",
    estimated_duration_hours: "",
  });

  const load = useCallback(async (force?: boolean) => {
    try {
      const [sched, ana] = await Promise.all([
        fetchMaintenanceSchedules({ force }),
        fetchMaintenanceAnalytics(),
      ]);
      setSchedules(sched);
      setAnalytics(ana);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load maintenance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      try {
        const list = await listAssets({ force: true });
        setAssets(list);
      } catch {}
    })();
  }, [createOpen]);

  const handlePerform = async (schedule: MaintenanceSchedule) => {
    setPerforming(schedule.id);
    try {
      await performMaintenanceSchedule(schedule.id);
      toast.success(`"${schedule.name}" marked as performed`);
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to mark schedule as performed");
    } finally {
      setPerforming(null);
    }
  };

  const handleCreate = async () => {
    if (!form.asset || !form.name.trim() || !form.start_date) {
      toast.error("Asset, name, and start date are required");
      return;
    }
    setSaving(true);
    try {
      await createMaintenanceSchedule({
        asset: form.asset,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        frequency: form.frequency,
        start_date: form.start_date,
        assigned_to: form.assigned_to || null,
        estimated_duration_hours: form.estimated_duration_hours
          ? Number(form.estimated_duration_hours)
          : null,
      });
      toast.success("Maintenance schedule created");
      setCreateOpen(false);
      setForm({ asset: "", name: "", description: "", frequency: "monthly", start_date: "", assigned_to: "", estimated_duration_hours: "" });
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  };

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      return new Date(a.next_due).getTime() - new Date(b.next_due).getTime();
    });
  }, [schedules]);

  const statusPieData = useMemo(
    () =>
      (analytics?.status_breakdown ?? []).map((r, i) => ({
        ...r,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [analytics],
  );

  const priorityData = useMemo(() => (analytics?.priority_breakdown ?? []).slice(0, 8), [analytics]);

  if (loading) return <PageSkeleton />;

  const totals = analytics?.totals;
  const dueSoon = sortedSchedules.filter(
    (s) => !s.is_overdue && new Date(s.next_due).getTime() - Date.now() <= 30 * 86400000,
  ).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Assets", href: "/assets" }, { label: "Maintenance" }]} />
      <PageHeader
        icon={Wrench}
        title="Maintenance Center"
        description="Preventive maintenance scheduling, work order performance, and SLA health."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/tickets")}>
              <Package className="mr-2 h-4 w-4" /> Work Orders
            </Button>
            <Button variant="outline" onClick={() => load(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Schedule
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Wrench}
          title="Open Work Orders"
          value={totals?.open_tickets ?? 0}
          caption={`${totals?.overdue_tickets ?? 0} overdue`}
          variant="rose"
        />
        <MetricCard
          icon={CalendarClock}
          title="Schedules Due"
          value={`${totals?.schedules_due ?? 0}`}
          caption={`${totals?.schedules_overdue ?? 0} overdue`}
          variant="amber"
        />
        <MetricCard
          icon={CheckCircle2}
          title="Resolved (30d)"
          value={totals?.resolved_30d ?? 0}
          caption={`${totals?.closed_30d ?? 0} closed`}
          variant="emerald"
        />
        <MetricCard
          icon={Clock}
          title="Avg Resolution"
          value={
            totals?.avg_resolution_hours != null
              ? `${totals.avg_resolution_hours}h`
              : "—"
          }
          caption="per work order"
          variant="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work Order Status</CardTitle>
            <CardDescription>Distribution by ticket status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPieData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
              <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Priority Breakdown</CardTitle>
            <CardDescription>Tickets and cost by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value.toLocaleString() : formatMoney(value),
                    name === "count" ? "Tickets" : "Cost",
                  ]}
                />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preventive Maintenance Schedules</CardTitle>
          <CardDescription>
            {sortedSchedules.length} schedules • {dueSoon} due within 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedSchedules.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Last Performed</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSchedules.map((schedule) => (
                  <TableRow
                    key={schedule.id}
                    className={schedule.is_overdue ? "bg-rose-500/5" : undefined}
                  >
                    <TableCell>
                      <div className="font-medium">{schedule.asset_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {schedule.asset_code}
                      </div>
                    </TableCell>
                    <TableCell>{schedule.name}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}</TableCell>
                    <TableCell>
                      {schedule.last_performed
                        ? new Date(schedule.last_performed).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {new Date(schedule.next_due).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{schedule.assigned_to_name || "—"}</TableCell>
                    <TableCell>
                      {schedule.is_overdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="secondary">Scheduled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={performing === schedule.id || !schedule.is_active}
                        onClick={() => handlePerform(schedule)}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        {performing === schedule.id ? "Recording…" : "Mark Performed"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No preventive maintenance schedules yet. Create one to automate upkeep.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Maintenance Schedule</DialogTitle>
            <DialogDescription>
              Schedule recurring preventive maintenance for an asset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Asset</Label>
              <Select
                value={form.asset}
                onValueChange={(v) => setForm((f) => ({ ...f, asset: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.asset_code} — {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Quarterly generator service"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, frequency: v as MaintenanceFrequency }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.estimated_duration_hours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estimated_duration_hours: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
