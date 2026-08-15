import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  Home,
  RefreshCw,
  KeyRound,
  User,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Play,
  Loader2,
  Wand2,
  Star,
  Layers,
  ArrowRight,
  BadgeCheck,
  XCircle,
} from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/ui/metric-card";
import { ReportExportMenu } from "@/components/table/ReportExportMenu";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAvailableHouses, type AvailableHouse } from "@/services/houseAnalytics";
import {
  getRankedQueue,
  batchAllocateAll,
  batchAllocatePreview,
  type BatchAllocateResponse,
  type HouseApplication,
} from "@/services/houseApplication";
import {
  invalidateCacheByPrefix,
  invalidateCache,
} from "@/lib/data-cache";
import { AllocateHouseDialog } from "@/components/houses/AllocateHouseDialog";

function fmtScore(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toFixed(1);
}

export default function SmartAllocationConsole() {
  const navigate = useNavigate();

  const [houses, setHouses] = useState<AvailableHouse[]>([]);
  const [candidates, setCandidates] = useState<HouseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogHouse, setDialogHouse] = useState<AvailableHouse | null>(null);

  const [preview, setPreview] = useState<BatchAllocateResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([
        getAvailableHouses({ force }),
        getRankedQueue(),
      ]);
      setHouses(h);
      setCandidates(c);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load allocation console");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAfterMutation = useCallback(async () => {
    invalidateCacheByPrefix("houses:analytics");
    invalidateCacheByPrefix("houses:allocations");
    invalidateCache("applications:list");
    invalidateCache("houses:list");
    await load(true);
  }, [load]);

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const data = await batchAllocatePreview();
      setPreview(data);
      toast.success(
        `Preview ready: ${data.allocated.length} would be allocated, ${data.skipped.length} skipped`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to run dry-run preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const commitBatch = async () => {
    setCommitting(true);
    try {
      const data = await batchAllocateAll();
      setPreview(null);
      toast.success(
        `Batch complete: ${data.allocated.length} allocated, ${data.skipped.length} skipped`,
      );
      await refreshAfterMutation();
    } catch (e: any) {
      toast.error(e?.message || "Batch allocation failed");
    } finally {
      setCommitting(false);
    }
  };

  const quickAllocate = async (house: AvailableHouse) => {
    if (!house.recommended_candidate) {
      setDialogHouse(house);
      return;
    }
    try {
      const app = candidates.find((c) => c.id === house.recommended_candidate?.application_id);
      const { allocateHouse } = await import("@/services/houseAllocations");
      await allocateHouse({
        house_id: house.house_id,
        application_id: house.recommended_candidate.application_id,
        allocation_type: "Auto",
        notes: "One-click allocation from Smart Allocation Console",
      });
      toast.success(
        `Allocated ${house.hid} to ${app?.employee_name ?? house.recommended_candidate.employee_name}`,
      );
      await refreshAfterMutation();
    } catch (e: any) {
      toast.error(e?.message || "Auto allocation failed");
    }
  };

  const vacantTotal = useMemo(
    () => houses.reduce((sum, h) => sum + (h.vacant ?? 0), 0),
    [houses],
  );
  const recommendedCount = useMemo(
    () => houses.filter((h) => h.recommended_candidate).length,
    [houses],
  );
  const waitingCount = useMemo(
    () => candidates.filter((c) => c.status === "Waiting for Allocation").length,
    [candidates],
  );

  if (loading && houses.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Housing" }, { label: "Smart Allocation Console" }]} />
      <PageHeader
        icon={Sparkles}
        title="Smart Allocation Console"
        description="Vacant units, engine recommendations, and one-click / batch allocation in one workspace."
        actions={
          <>
            <Button variant="outline" onClick={() => load(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses/command-center")}>
              <Home className="mr-2 h-4 w-4" /> Command Center
            </Button>
            <Button variant="outline" onClick={() => navigate("/houses/allocations")}>
              <KeyRound className="mr-2 h-4 w-4" /> Allocated Houses
            </Button>
            <Button onClick={() => navigate("/houses/allocations/history")}>
              History <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* ── Metrics ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Home}
          title="Vacant Units"
          value={vacantTotal}
          countValue={vacantTotal}
          variant="blue"
          caption={`${houses.length} available houses`}
        />
        <MetricCard
          icon={Star}
          title="Engine Recommendations"
          value={recommendedCount}
          countValue={recommendedCount}
          variant="violet"
          caption="houses with a best-fit candidate"
        />
        <MetricCard
          icon={Users}
          title="Queue Waiting"
          value={waitingCount}
          countValue={waitingCount}
          variant="amber"
          caption="Waiting for Allocation"
        />
        <MetricCard
          icon={Wand2}
          title="Batch Preview"
          value={preview ? preview.allocated.length : "—"}
          variant="emerald"
          caption={preview ? `${preview.skipped.length} would be skipped` : "run a dry-run first"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Vacant unit cards ───────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Home className="h-4 w-4 text-primary" /> Vacant Units ({houses.length})
            </h2>
            <ReportExportMenu
              title="Smart Housing Candidates Report"
              fileName="smart_housing_candidates"
              columns={[
                { header: "App No", key: "application_no" },
                { header: "Employee Name", key: "employee_name" },
                { header: "Position", key: "position" },
                { header: "Score", key: "total_score" },
                { header: "Status", key: "status" },
              ]}
              getRows={() => (candidates || []).map((c) => [
                c.application_no || c.id,
                c.employee_name || "",
                c.position || "",
                fmtScore(c.total_score),
                c.status || "",
              ])}
              totalCount={(candidates || []).length}
            />
          </div>

          {houses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center">
              <BadgeCheck className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium text-foreground">No vacant houses</p>
              <p className="text-xs text-muted-foreground">
                Every active unit is at capacity. Allocate responsibly.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {houses.map((h) => {
                const rec = h.recommended_candidate;
                const recommendedApp = rec
                  ? candidates.find((c) => c.id === rec.application_id)
                  : null;
                return (
                  <div
                    key={h.house_id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                      <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-foreground">{h.house_number || h.hid}</span>
                          <Badge variant="outline">{h.house_type}</Badge>
                          <Badge variant="secondary">{h.allocation_category || "—"}</Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {h.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {h.vacant} vacant
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          cap {h.capacity}
                        </p>
                      </div>
                    </div>

                    {h.damaged_items.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {h.damaged_items.map((d) => (
                          <Badge
                            key={d}
                            variant="destructive"
                            className="text-[10px] normal-case"
                          >
                            {d}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-lg border p-3",
                        rec
                          ? "border-primary/30 bg-primary/5"
                          : "border-dashed border-border bg-muted/30",
                      )}
                    >
                      {rec ? (
                        <>
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                            <Star className="h-3 w-3" /> Engine recommended
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {rec.employee_name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {rec.application_no} · fit{" "}
                                {Math.round(Number(rec.closeness ?? 0) * 100)}%
                              </span>
                            </span>
                            {!rec.constraint_ok && (
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                            )}
                          </div>
                          {!rec.constraint_ok && (
                            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                              {rec.constraint_reason}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No engine recommendation — no matching candidate in the queue.
                        </p>
                      )}
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => void quickAllocate(h)}
                        disabled={!rec || !rec.constraint_ok}
                      >
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Allocate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDialogHouse(h)}>
                        Manual…
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Batch allocation panel ──────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-primary" /> Batch Allocation
          </h2>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Run a <span className="font-medium text-foreground">dry-run preview</span> of the
              engine's full pipeline (Hungarian optimal assignment) — nothing is persisted until
              you commit.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => void runPreview()} disabled={previewLoading}>
                {previewLoading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-4 w-4" />
                )}
                Run Preview
              </Button>
              <Button
                className="flex-1"
                onClick={() => void commitBatch()}
                disabled={committing || !preview || preview.allocated.length === 0}
              >
                {committing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Commit
              </Button>
            </div>

            {preview && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {preview.allocated.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      would allocate
                    </p>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {preview.skipped.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      would skip
                    </p>
                  </div>
                </div>

                <ScrollArea className="h-72 rounded-lg border">
                  <div className="divide-y divide-border">
                    {preview.allocated.map((r) => (
                      <div key={r.house_id} className="flex items-center gap-2 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="w-24 shrink-0 truncate text-sm font-medium text-foreground">
                          {r.house_number}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {r.allocated_to}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {fmtScore(r.score)}
                        </span>
                      </div>
                    ))}
                    {preview.skipped.map((r) => (
                      <div key={r.house_id} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                          <span className="w-24 shrink-0 truncate text-sm font-medium text-foreground">
                            {r.house_number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {r.application_no ?? "—"}
                          </span>
                        </div>
                        {r.skip_reason && (
                          <p className="mt-1 pl-6 text-xs text-rose-600 dark:text-rose-400">
                            {r.skip_reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </div>

      <AllocateHouseDialog
        open={Boolean(dialogHouse)}
        onOpenChange={(o) => { if (!o) setDialogHouse(null); }}
        house={dialogHouse}
        candidates={candidates}
        recommended={dialogHouse?.recommended_candidate ?? null}
        onAllocated={() => void refreshAfterMutation()}
      />
    </div>
  );
}
