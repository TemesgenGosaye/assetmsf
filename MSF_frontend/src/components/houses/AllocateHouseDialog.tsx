import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, User, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { allocateHouse, type AllocationType } from "@/services/houseAllocations";
import { type HouseApplication } from "@/services/houseApplication";
import { type AvailableHouse, type AvailableCandidate } from "@/services/houseAnalytics";
import { cn } from "@/lib/utils";

export type AllocateMode = AllocationType;

interface AllocateHouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  house: AvailableHouse | null;
  candidates: HouseApplication[];
  recommended?: AvailableCandidate | null;
  onAllocated?: (type: AllocateMode, employee: string, house: string) => void;
}

const MODE_DESCRIPTIONS: Record<AllocateMode, string> = {
  Auto: "Let the engine pick the highest-ranked eligible candidate for this unit.",
  Manual: "You choose the candidate; engine validates eligibility, capacity & conflicts.",
  Override: "Force an allocation past standard constraints. Requires a written reason (audited).",
};

const CATEGORY_ORDER: Record<string, number> = {
  Staff: 6,
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

function eligibleCandidates(candidates: HouseApplication[], house: AvailableHouse | null): HouseApplication[] {
  if (!house) return [];
  const houseRank = CATEGORY_ORDER[house.house_type] ?? 0;
  return candidates.filter((c) => {
    // Disable/exclude already allocated employees or non-waiting/verified
    if (c.status === "Allocated") return false;
    if (c.status !== "Waiting for Allocation" && c.status !== "Verified") return false;
    const catRank = CATEGORY_ORDER[c.eligible_house_category] ?? 0;
    return houseRank <= catRank;
  });
}

export function AllocateHouseDialog({
  open,
  onOpenChange,
  house,
  candidates,
  recommended,
  onAllocated,
}: AllocateHouseDialogProps) {
  const [mode, setMode] = useState<AllocateMode>("Auto");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pool = useMemo(() => eligibleCandidates(candidates, house), [candidates, house]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((c) =>
      [c.employee_name, c.employee_id, c.application_no, c.job_position].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [pool, search]);

  const resolvedRecommendedId =
    recommended && pool.some((c) => c.id === recommended.application_id)
      ? recommended.application_id
      : null;

  const selected = useMemo(
    () => pool.find((c) => c.id === selectedId) ?? null,
    [pool, selectedId],
  );

  const handleSubmit = async () => {
    if (!house) return;
    const app = selected ?? (mode === "Auto" ? pool.find((c) => c.id === resolvedRecommendedId) ?? pool[0] : null);
    if (!app) {
      toast.error("Select a candidate to allocate to this house");
      return;
    }
    if (mode === "Override" && !overrideReason.trim()) {
      toast.error("An override reason is required (this action is audited)");
      return;
    }
    setSubmitting(true);
    try {
      await allocateHouse({
        house_id: house.house_id,
        application_id: app.id,
        allocation_type: mode,
        notes,
        ...(mode === "Override" ? { override_reason: overrideReason } : {}),
      });
      toast.success(`Allocated ${house.hid} to ${app.employee_name} (${mode})`);
      onAllocated?.(mode, app.employee_name, house.hid);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to allocate house");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Allocate {house?.hid ?? "House"}
          </DialogTitle>
          <DialogDescription>
            {house
              ? `${house.house_number} · ${house.house_type} · ${house.location} · ${house.vacant} vacancy(ies)`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Mode ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Allocation Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as AllocateMode)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {(["Auto", "Manual", "Override"] as AllocateMode[]).map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors",
                    mode === m
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <RadioGroupItem value={m} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-foreground">{m}</span>
                    <span className="block text-xs text-muted-foreground">
                      {MODE_DESCRIPTIONS[m]}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* ── Candidate picker ──────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Candidate</Label>
              <span className="text-xs text-muted-foreground">{filtered.length} eligible</span>
            </div>
            {resolvedRecommendedId && (
              <button
                type="button"
                onClick={() => setSelectedId(resolvedRecommendedId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selectedId === resolvedRecommendedId
                    ? "border-primary bg-primary/5"
                    : "border-dashed border-primary/40 hover:border-primary",
                )}
              >
                <Star className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="font-medium">Engine pick:</span>
                <span className="truncate">
                  {recommended?.employee_name} · {recommended?.application_no}
                </span>
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {Math.round(Number(recommended?.closeness ?? 0) * 100)}% fit
                </Badge>
              </button>
            )}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee ID or application no…"
              className="h-9"
            />
            <ScrollArea className="h-44 rounded-md border p-1">
              <div className="divide-y divide-border">
                {filtered.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No eligible candidates. Switch to Override to force an allocation.
                  </p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedId === c.id && "bg-primary/5",
                    )}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {c.employee_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.application_no} · {c.employee_id} · Grade {c.job_grade || "—"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xs font-semibold text-primary">
                        {Number(c.priority_score).toFixed(1)}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        score
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* ── Reason / notes ────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="alloc-notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <ScrollArea className="h-24 rounded-md border">
              <Textarea
                id="alloc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context for this allocation…"
                className="min-h-[80px] border-0 focus-visible:ring-0 resize-none shadow-none"
              />
            </ScrollArea>
          </div>

          {mode === "Override" && (
            <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <Label htmlFor="override-reason" className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Override Reason <span className="text-destructive">*</span>
              </Label>
              <ScrollArea className="h-24 rounded-md border bg-background">
                <Textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why is this allocation justified despite constraints?"
                  className="min-h-[80px] border-0 focus-visible:ring-0 resize-none shadow-none"
                />
              </ScrollArea>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Overrides are written to the audit trail and shown as{" "}
                <span className="font-semibold">Override</span> in the register.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Allocate {selected?.employee_name ? `→ ${selected.employee_name.split(" ")[0]}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
