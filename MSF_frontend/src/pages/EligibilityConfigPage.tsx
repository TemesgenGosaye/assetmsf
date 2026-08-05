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
import { Switch } from "@/components/ui/switch";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listEligibilityRules,
  createEligibilityRule,
  updateEligibilityRule,
  deleteEligibilityRule,
  type EligibilityRule,
} from "@/services/houseApplication";
import { HOUSE_CATEGORIES } from "@/services/houseApplication";
import {
  ArrowLeft,
  Shield,
  Save,
  Plus,
  Trash2,
  Pencil,
  X,
  Users,
  AlertTriangle,
} from "lucide-react";

type RuleForm = {
  min_grade: number;
  max_grade: number;
  house_type: string;
  gender_eligibility: string;
  requires_family: boolean;
  min_family_size: number;
  description: string;
  priority: number;
};

const EMPTY_FORM: RuleForm = {
  min_grade: 0,
  max_grade: 30,
  house_type: "Staff",
  gender_eligibility: "Both",
  requires_family: false,
  min_family_size: 0,
  description: "",
  priority: 0,
};

const GENDER_OPTIONS = ["Both", "Male", "Female"];

const CATEGORY_COLORS: Record<string, string> = {
  Staff: "bg-purple-100 text-purple-800 border-purple-300",
  A: "bg-blue-100 text-blue-800 border-blue-300",
  B: "bg-emerald-100 text-emerald-800 border-emerald-300",
  C: "bg-amber-100 text-amber-800 border-amber-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  E: "bg-slate-100 text-slate-800 border-slate-300",
};

export default function EligibilityConfigPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listEligibilityRules();
      setRules(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load eligibility rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, priority: rules.length });
    setShowForm(true);
  };

  const startEdit = (rule: EligibilityRule) => {
    setEditingId(rule.id);
    setForm({
      min_grade: rule.min_grade,
      max_grade: rule.max_grade,
      house_type: rule.house_type,
      gender_eligibility: rule.gender_eligibility,
      requires_family: rule.requires_family,
      min_family_size: rule.min_family_size,
      description: rule.description,
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (form.min_grade > form.max_grade) {
      toast.error("Min grade cannot be greater than max grade");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateEligibilityRule(editingId, form);
        toast.success("Rule updated");
      } else {
        await createEligibilityRule(form);
        toast.success("Rule created");
      }
      cancelForm();
      void fetchRules();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this eligibility rule?")) return;
    try {
      await deleteEligibilityRule(id);
      toast.success("Rule deleted");
      void fetchRules();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete rule");
    }
  };

  const handleToggleActive = async (rule: EligibilityRule) => {
    try {
      await updateEligibilityRule(rule.id, { is_active: !rule.is_active });
      void fetchRules();
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle rule");
    }
  };

  if (loading) return <PageSkeleton />;

  const gradeRange = (r: EligibilityRule) => {
    if (r.min_grade === 0 && r.max_grade >= 30) return "All grades";
    if (r.min_grade === 0) return `Below ${r.max_grade + 1}`;
    if (r.max_grade >= 30) return `${r.min_grade}+`;
    return `${r.min_grade} \u2013 ${r.max_grade}`;
  };

  return (
    <div className="space-y-6 p-6 pb-10">
      <Breadcrumbs items={[{ label: "House Opp", to: "/house-opp" }, { label: "Eligibility Config" }]} />

      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_35%)]" />
        <div className="relative space-y-6 p-6 md:p-8">
          <PageHeader
            icon={Shield}
            title="Eligibility Rules"
            description="Define which job grades qualify for which house categories."
            actions={
              <>
                <Button variant="outline" onClick={() => navigate("/house-opp")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to House Opp
                </Button>
                <Button variant="outline" onClick={() => navigate("/house-opp/scoring")}>
                  <Users className="mr-2 h-4 w-4" />
                  Scoring Config
                </Button>
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary">
              {rules.length} Rule{rules.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              {rules.filter((r) => r.is_active).length} Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Rules grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <Card
            key={rule.id}
            className={`relative transition-shadow hover:shadow-md ${
              rule.is_active ? "border-primary/40" : "border-border/60 opacity-70"
            }`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={CATEGORY_COLORS[rule.house_type] || "bg-slate-100 text-slate-800"}>
                    {rule.house_type}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    Priority: {rule.priority}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => void handleToggleActive(rule)}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(rule)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-500 hover:text-rose-600"
                    onClick={() => void handleDelete(rule.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-semibold">Grade: {gradeRange(rule)}</p>
                {rule.description && (
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {rule.gender_eligibility !== "Both" && (
                  <Badge variant="outline" className="text-[10px]">
                    {rule.gender_eligibility} Only
                  </Badge>
                )}
                {rule.requires_family && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                    Married Required
                  </Badge>
                )}
                {rule.min_family_size > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    Family ≥ {rule.min_family_size}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {rules.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
              <p className="text-sm font-semibold">No eligibility rules configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add rules to define which job grades qualify for each house category.
              </p>
              <Button onClick={startCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Add First Rule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">
                {editingId ? "Edit Eligibility Rule" : "New Eligibility Rule"}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>House Category</Label>
                  <Select
                    value={form.house_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, house_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority (order)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, priority: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Grade (inclusive)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={form.min_grade}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, min_grade: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Grade (inclusive)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={form.max_grade}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, max_grade: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender Eligibility</Label>
                  <Select
                    value={form.gender_eligibility}
                    onValueChange={(v) => setForm((p) => ({ ...p, gender_eligibility: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g === "Both" ? "Both Genders" : `${g} Only`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Family Size</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_family_size}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        min_family_size: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.requires_family}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, requires_family: v }))}
                />
                <Label className="cursor-pointer">Requires married status</Label>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g., Staff houses for senior management"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
                  {saving ? "Saving..." : (
                    <>
                      <Save className="h-4 w-4" />
                      {editingId ? "Update" : "Create"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
