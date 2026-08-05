import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  listScoringConfigs,
  createScoringConfig,
  updateScoringConfig,
  type ScoringConfig,
} from "@/services/houseApplication";
import {
  ArrowLeft,
  Award,
  Save,
  Settings,
  TrendingUp,
  Plus,
} from "lucide-react";

const WEIGHT_FIELDS: { key: keyof Pick<ScoringConfig, "job_grade_weight" | "years_of_service_weight" | "family_size_weight" | "disability_weight" | "fifo_weight">; label: string; description: string; color: string }[] = [
  { key: "job_grade_weight", label: "Job Grade", description: "Higher grade = higher priority", color: "text-blue-600" },
  { key: "years_of_service_weight", label: "Years of Service", description: "More tenure = higher priority", color: "text-emerald-600" },
  { key: "family_size_weight", label: "Family Size", description: "Larger family = higher priority", color: "text-violet-600" },
  { key: "disability_weight", label: "Disability Status", description: "Disability = bonus priority", color: "text-amber-600" },
  { key: "fifo_weight", label: "FIFO (Application Date)", description: "Earlier application = higher priority", color: "text-rose-600" },
];

export default function ScoringConfigPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<ScoringConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeConfig, setActiveConfig] = useState<ScoringConfig | null>(null);
  const [form, setForm] = useState({
    name: "Default",
    job_grade_weight: 30,
    years_of_service_weight: 25,
    family_size_weight: 20,
    disability_weight: 15,
    fifo_weight: 10,
  });

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listScoringConfigs();
      setConfigs(data);
      const active = data.find((c) => c.is_active) || data[0];
      if (active) {
        setActiveConfig(active);
        setForm({
          name: active.name,
          job_grade_weight: Number(active.job_grade_weight),
          years_of_service_weight: Number(active.years_of_service_weight),
          family_size_weight: Number(active.family_size_weight),
          disability_weight: Number(active.disability_weight),
          fifo_weight: Number(active.fifo_weight),
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load scoring configs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  const totalWeight = Object.values(form).reduce((sum, v) => (typeof v === "number" ? sum + v : sum), 0);

  const handleSave = async () => {
    if (totalWeight === 0) {
      toast.error("Total weight cannot be zero");
      return;
    }
    try {
      setSaving(true);
      if (activeConfig) {
        await updateScoringConfig(activeConfig.id, form);
        toast.success("Scoring config updated. All queue scores recalculated.");
      } else {
        const created = await createScoringConfig(form);
        setActiveConfig(created);
        toast.success("Scoring config created. All queue scores recalculated.");
      }
      void fetchConfigs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save scoring config");
    } finally {
      setSaving(false);
    }
  };

  const handleWeightChange = (key: string, value: string) => {
    const num = parseFloat(value) || 0;
    setForm((prev) => ({ ...prev, [key]: num }));
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 p-6 pb-10">
      <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }, { label: "Scoring Config" }]} />

      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_35%)]" />
        <div className="relative space-y-6 p-6 md:p-8">
          <PageHeader
            icon={Settings}
            title="Scoring Configuration"
            description="Configure the priority scoring weights used to rank house allocation applicants."
            actions={
              <>
                <Button variant="outline" onClick={() => navigate("/house-opp")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to House Opp
                </Button>
                <Button variant="outline" onClick={() => navigate("/house-opp/queue")}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Queue
                </Button>
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary">
              {activeConfig ? "Active Config" : "No Active Config"}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              Total Weight: {totalWeight.toFixed(0)}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-primary" />
            Scoring Weights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Default, Priority, Balanced"
              />
            </div>
          </div>

          <div className="space-y-4">
            {WEIGHT_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px_1fr] md:items-center">
                <div>
                  <p className={`text-sm font-semibold ${field.color}`}>{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form[field.key]}
                    onChange={(e) => handleWeightChange(field.key, e.target.value)}
                    className="text-center font-mono text-sm"
                  />
                  <p className="text-center text-[10px] text-muted-foreground">weight (0-100)</p>
                </div>
                <div className="hidden md:block">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (Number(form[field.key]) / 100) * 100)}%`,
                        backgroundColor: "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">Total Weight</p>
              <p className="text-xs text-muted-foreground">
                All weights are normalised relative to each other.
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-lg font-bold tabular-nums ${
                totalWeight > 0 ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" : "bg-rose-500/10 text-rose-700 border-rose-300"
              }`}
            >
              {totalWeight.toFixed(1)}
            </Badge>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void fetchConfigs()}>
              Reset
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save & Recalculate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {configs.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" />
              All Configurations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                    cfg.is_active ? "border-primary bg-primary/5" : "border-border/60"
                  }`}
                >
                  <Badge variant={cfg.is_active ? "default" : "outline"} className="text-xs">
                    {cfg.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="font-medium">{cfg.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Grade: {cfg.job_grade_weight} | Service: {cfg.years_of_service_weight} | Family: {cfg.family_size_weight} | Disability: {cfg.disability_weight} | FIFO: {cfg.fifo_weight}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
