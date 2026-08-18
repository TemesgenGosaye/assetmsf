import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Printer,
  Download,
  Loader2,
  Clock,
  Users,
  Pencil,
  Eye,
  History,
  CheckCircle2,
  Copy,
  ShieldCheck,
  AlertTriangle,
  Stamp,
  KeyRound,
  DoorOpen,
  Lightbulb,
  Droplets,
  ClipboardList,
  ArrowUpRight,
  ArrowDownToLine,
  RotateCcw,
  Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type HandoverReceipt,
  updateHandoverReceipt,
  recordPrint,
} from "@/services/houseHandoverReceipt";
import {
  printHandoverReceipt,
  downloadHandoverReceiptPdf,
} from "@/lib/handoverReceiptPdf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: HandoverReceipt;
  onReceiptUpdated?: (r: HandoverReceipt) => void;
};

function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtRelative(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
}

const ACTION_META: Record<
  string,
  { icon: typeof Printer; label: string; tone: string }
> = {
  generated: { icon: FileText, label: "Generated", tone: "text-slate-500 bg-slate-100" },
  printed: { icon: Printer, label: "Printed", tone: "text-emerald-700 bg-emerald-100" },
  downloaded: { icon: ArrowDownToLine, label: "Downloaded", tone: "text-sky-700 bg-sky-100" },
  reprinted: { icon: RotateCcw, label: "Reprinted", tone: "text-amber-700 bg-amber-100" },
  voided: { icon: Ban, label: "Voided", tone: "text-red-700 bg-red-100" },
};

export default function HandoverReceiptModal({
  open,
  onOpenChange,
  receipt: initial,
  onReceiptUpdated,
}: Props) {
  const [receipt, setReceipt] = useState<HandoverReceipt>(initial);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");

  const [electrical, setElectrical] = useState(initial.inspection_electrical);
  const [structural, setStructural] = useState(initial.inspection_structural);
  const [water, setWater] = useState(initial.inspection_water);
  const [admin, setAdmin] = useState(initial.inspection_admin);
  const [committee, setCommittee] = useState<string[]>(
    (initial.committee_members || []).slice(0, 4).concat(
      Array(Math.max(0, 4 - (initial.committee_members || []).length)).fill(""),
    ),
  );

  const isDirty =
    electrical !== receipt.inspection_electrical ||
    structural !== receipt.inspection_structural ||
    water !== receipt.inspection_water ||
    admin !== receipt.inspection_admin ||
    committee.filter((c) => c.trim()).join("|") !==
      (receipt.committee_members || []).join("|");

  useEffect(() => {
    setReceipt(initial);
    setElectrical(initial.inspection_electrical);
    setStructural(initial.inspection_structural);
    setWater(initial.inspection_water);
    setAdmin(initial.inspection_admin);
    setCommittee(
      (initial.committee_members || []).slice(0, 4).concat(
        Array(Math.max(0, 4 - (initial.committee_members || []).length)).fill(""),
      ),
    );
  }, [initial]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await updateHandoverReceipt(receipt.id, {
        inspection_electrical: electrical,
        inspection_structural: structural,
        inspection_water: water,
        inspection_admin: admin,
        committee_members: committee.filter((c) => c.trim()),
      });
      setReceipt(updated);
      onReceiptUpdated?.(updated);
      toast.success("Receipt updated", {
        description: `${updated.doc_number} saved successfully.`,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update receipt");
    } finally {
      setSaving(false);
    }
  }, [receipt.id, electrical, structural, water, admin, committee, onReceiptUpdated]);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    try {
      const { receipt: updated } = await recordPrint(receipt.id, "printed");
      setReceipt(updated);
      onReceiptUpdated?.(updated);
      printHandoverReceipt(updated);
    } catch (e: any) {
      toast.error(e?.message || "Failed to record print event");
    } finally {
      setPrinting(false);
    }
  }, [receipt.id, onReceiptUpdated]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { receipt: updated } = await recordPrint(receipt.id, "downloaded");
      setReceipt(updated);
      onReceiptUpdated?.(updated);
      await downloadHandoverReceiptPdf(updated);
      toast.success("PDF downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }, [receipt.id, onReceiptUpdated]);

  const handleCopyDocNumber = useCallback(() => {
    navigator.clipboard?.writeText(receipt.doc_number);
    toast.success("Document number copied", { description: receipt.doc_number });
  }, [receipt.doc_number]);

  const statusTone = useMemo(() => {
    switch (receipt.doc_status) {
      case "Active":
        return {
          badge: "default" as const,
          ring: "ring-emerald-500/30 bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: ShieldCheck,
        };
      case "Voided":
        return {
          badge: "destructive" as const,
          ring: "ring-red-500/30 bg-red-50 text-red-700 border-red-200",
          icon: AlertTriangle,
        };
      default:
        return {
          badge: "secondary" as const,
          ring: "ring-slate-500/20 bg-slate-50 text-slate-600 border-slate-200",
          icon: Clock,
        };
    }
  }, [receipt.doc_status]);

  const StatusIcon = statusTone.icon;
  const historyCount = receipt.audit_history?.length ?? 0;

  const completion = useMemo(() => {
    const fields = [admin, structural, electrical, water];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [admin, structural, electrical, water]);

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 border-slate-800/10">
          {/* ── Header plate ───────────────────────────────────────── */}
          <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 px-6 pt-5 pb-4 text-slate-100">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 10px)",
              }}
            />
            <DialogHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-gradient-to-b from-amber-600/20 to-amber-900/20 shadow-inner">
                    <FileText className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-slate-50 text-base">
                      <span className="truncate">Handover Receipt</span>
                      <button
                        onClick={handleCopyDocNumber}
                        className="group inline-flex items-center gap-1 rounded border border-slate-600/60 bg-slate-950/40 px-1.5 py-0.5 text-[11px] font-mono tracking-wide text-amber-300 hover:bg-slate-950/70 transition-colors"
                        title="Copy document number"
                      >
                        {receipt.doc_number}
                        <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                      </button>
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-xs mt-0.5 truncate">
                      {receipt.employee_name} <ArrowUpRight className="inline h-3 w-3 -rotate-45 mx-0.5" /> {receipt.house_number} · {receipt.house_type}
                    </DialogDescription>
                  </div>
                </div>

                <div
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ring-1 ${statusTone.ring} bg-white`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {receipt.doc_status}
                </div>
              </div>
            </DialogHeader>

            {/* Metadata strip */}
            <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Generated {fmtDate(receipt.generated_date)}
              </span>
              <span className="flex items-center gap-1">
                <Pencil className="h-3 w-3" /> By {receipt.generated_by_name || "—"}
              </span>
              {receipt.is_printed && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Printed {receipt.reprint_count + 1}×
                </span>
              )}
              <span className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" /> Inspection {completion}% complete
              </span>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <div className="px-6 pt-3 border-b bg-muted/30">
              <TabsList className="bg-transparent p-0 h-auto gap-1">
                <TabsTrigger
                  value="preview"
                  className="gap-1.5 rounded-t-md rounded-b-none border border-transparent data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </TabsTrigger>
                <TabsTrigger
                  value="edit"
                  className="gap-1.5 rounded-t-md rounded-b-none border border-transparent data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                  {isDirty && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="gap-1.5 rounded-t-md rounded-b-none border border-transparent data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background"
                >
                  <History className="h-3.5 w-3.5" /> Print History
                  {historyCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                      {historyCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[440px]">
                <div className="p-4 bg-slate-100/60">
                  <div className="mx-auto max-w-[680px] rounded-sm border border-slate-300 bg-white shadow-sm relative overflow-hidden">
                    {receipt.doc_status === "Voided" && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                        <div className="rotate-[-18deg] border-4 border-red-600/70 text-red-600/70 px-6 py-1.5 text-3xl font-black tracking-widest opacity-25">
                          VOIDED
                        </div>
                      </div>
                    )}
                    <ReceiptPreview receipt={receipt} />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Edit Tab */}
            <TabsContent value="edit" className="flex-1 overflow-auto m-0">
              <ScrollArea className="h-[440px]">
                <div className="space-y-3 p-5">
                  <InspectionField
                    icon={DoorOpen}
                    numeral="1"
                    titleAm="በሮችና መሠረታዊ ዕቃዎች"
                    titleEn="Doors & Basics"
                    hint="የፊት በር መክፈቻ፣ ቁልፍ ማብራሪያ…"
                    value={admin}
                    onChange={setAdmin}
                  />
                  <InspectionField
                    icon={KeyRound}
                    numeral="2"
                    titleAm="መስኮቶችና እቃዎች"
                    titleEn="Windows & Furnishings"
                    hint="የሳሎን መስኮት መዋቅር፣ የመኝታ ክፍል መዋቅር…"
                    value={structural}
                    onChange={setStructural}
                  />
                  <InspectionField
                    icon={Lightbulb}
                    numeral="3"
                    titleAm="የመብራት ዕቃዎች"
                    titleEn="Lighting Items"
                    hint="የላምፕ ማብሪያና ማጥፊያ፣ የመሠረት ማጥፊያዎች…"
                    value={electrical}
                    onChange={setElectrical}
                  />
                  <InspectionField
                    icon={Droplets}
                    numeral="4"
                    titleAm="የቤቱ አጠቃላይ ሁኔታ"
                    titleEn="Overall Condition"
                    hint="የተደረሰበት ሁኔታ፣ ሌሎች…"
                    value={water}
                    onChange={setWater}
                  />

                  <Separator className="my-1" />

                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Handover Committee
                      <span className="font-normal text-xs text-muted-foreground">
                        (up to 4 members)
                      </span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {committee.map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-100">
                            {i + 1}
                          </span>
                          <Input
                            value={name}
                            onChange={(e) => {
                              const next = [...committee];
                              next[i] = e.target.value;
                              setCommittee(next);
                            }}
                            placeholder={`Member ${i + 1} name`}
                            className="h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="w-full"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {isDirty ? "Save Changes" : "No Changes to Save"}
                  </Button>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 overflow-auto m-0">
              <ScrollArea className="h-[440px]">
                <div className="p-5">
                  {receipt.audit_history && receipt.audit_history.length > 0 ? (
                    <ol className="relative border-l border-dashed border-slate-300 pl-5 space-y-4">
                      {receipt.audit_history
                        .slice()
                        .reverse()
                        .map((evt, i) => {
                          const meta = ACTION_META[evt.action] ?? ACTION_META.generated;
                          const Icon = meta.icon;
                          return (
                            <li key={i} className="relative">
                              <span
                                className={`absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-background ${meta.tone}`}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                              <div className="rounded-md border bg-card p-3 text-sm shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{meta.label}</span>
                                    {evt.reprint_no > 0 && (
                                      <Badge variant="outline" className="text-[10px]">
                                        occurrence #{evt.reprint_no + 1}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {fmtRelative(evt.timestamp)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {evt.user_name || "—"} · {fmtDateTime(evt.timestamp)}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                    </ol>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <Stamp className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        No print or download activity yet.
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Actions taken on this receipt will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <DialogFooter className="gap-2 sm:gap-2 border-t bg-muted/30 px-6 py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={downloading || receipt.doc_status === "Voided"}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </TooltipTrigger>
              {receipt.doc_status === "Voided" && (
                <TooltipContent>Voided receipts can't be downloaded</TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handlePrint}
                  disabled={printing || receipt.doc_status === "Voided"}
                >
                  {printing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  {receipt.is_printed ? "Reprint" : "Print"}
                </Button>
              </TooltipTrigger>
              {receipt.doc_status === "Voided" && (
                <TooltipContent>Voided receipts can't be printed</TooltipContent>
              )}
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

/* ── Reusable edit-tab field ─────────────────────────────────────── */

function InspectionField({
  icon: Icon,
  numeral,
  titleAm,
  titleEn,
  hint,
  value,
  onChange,
}: {
  icon: typeof DoorOpen;
  numeral: string;
  titleAm: string;
  titleEn: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <Label className="text-sm font-medium flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-[10px] font-bold text-amber-400">
          {numeral}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>
          {titleAm} — {titleEn}
        </span>
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        rows={2}
        className="resize-none"
      />
      <div className="text-right text-[10px] text-muted-foreground">
        {value?.length ?? 0} characters
      </div>
    </div>
  );
}

/* ── Inline A4 Preview (መዝገብ-style) ─────────────────────────────── */

function ReceiptPreview({ receipt: r }: { receipt: HandoverReceipt }) {
  const dot = (w = 160) => (
    <span
      className="inline-block border-b border-dotted border-slate-400 font-normal text-slate-900 px-0.5"
      style={{ minWidth: w }}
    >
      &nbsp;
    </span>
  );

  const dotVal = (val: string, w = 160) => (
    <span
      className="inline-block border-b border-dotted border-slate-400 font-medium text-slate-900 px-0.5"
      style={{ minWidth: w }}
    >
      {val || "\u00A0"}
    </span>
  );

  return (
    <div
      className="p-5 text-[9pt] leading-[1.7] text-slate-800"
      style={{ fontFamily: '"Noto Sans Ethiopic", "Noto Sans", Arial, sans-serif' }}
    >
      {/* ── HEADER: 3-column ── */}
      <table className="w-full border-collapse border border-slate-900 text-[8pt] mb-0">
        <tbody>
          <tr>
            {/* Col 1: Logo */}
            <td className="border border-slate-900 p-1.5 w-[12%] text-center align-middle">
              <img
                src="/msf_logo.jpg"
                alt="MSF"
                className="w-[52px] h-[52px] object-contain mx-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </td>

            {/* Col 2: Factory Name */}
            <td className="border border-slate-900 p-1.5 w-[58%] text-center align-middle">
              <div className="text-[8pt] text-slate-500 font-medium">የፋብሪካው ስም:</div>
              <div className="text-[7.5pt] text-slate-500 font-medium">Factory Name:</div>
              <div className="text-[12pt] font-bold text-slate-900 leading-tight my-0.5">
                መተሐራ ስኳር ፋብሪካ
              </div>
              <div className="text-[10pt] font-bold text-slate-800 tracking-wide">
                METAHARA SUGAR FACTORY
              </div>
            </td>

            {/* Col 3: Ref / Date */}
            <td className="border border-slate-900 p-1.5 w-[30%] align-middle">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-slate-800">ቁጥር:</span>
                <span className="font-medium text-slate-900">{r.doc_number}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-slate-800">ቀን:</span>
                <span className="font-medium text-slate-900">{fmtDate(r.generated_date)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── TITLE BAR ── */}
      <table className="w-full border-collapse border border-slate-900 border-t-0 text-[9pt] mb-0">
        <tbody>
          <tr>
            <td className="border border-slate-900 p-1.5 w-[78%] text-center">
              <span className="font-semibold text-slate-500 mr-2">ርዕስ/Title</span>
              <span className="font-bold text-[11pt] text-slate-900">
                በቤት ምደባ ወቅት የቤት ማስረከቢያ ቅጽ
              </span>
            </td>
            <td className="border border-slate-900 p-1.5 w-[22%] text-center">
              <div className="font-bold text-slate-800">የገጽ ቁጥር 1/1</div>
              <div className="text-[7.5pt] text-slate-500">Page No</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── BODY ── */}
      <div className="mt-3">

        {/* Row: ማኅበር / ክፍል / ቀን */}
        <div className="text-[9pt] mb-1">
          <span className="font-bold">ማኅበር/</span>{dot(120)}
          <span className="mx-2" />
          <span className="font-bold">ክፍል</span>{dot(120)}
          <span className="mx-2" />
          <span className="font-bold">ቀን</span>{dot(120)}
        </div>

        {/* Declaration */}
        <div className="text-[9pt] leading-[1.8] text-justify mt-2">
          <span className="font-bold">እኔ</span> {dotVal(r.employee_name, 140)}{" "}
          <span className="font-bold">መ/ቁ</span> {dotVal(r.employee_id, 100)}{" "}
          <span className="font-bold">ክፍል</span> {dotVal(r.department, 100)}{" "}
          <span className="font-bold">ባልደረባ</span> በድርጅቱ የተሰጠኝን መኖሪያ ቤት ቁጥር{" "}
          <br />
          {dotVal(r.house_number, 160)}{" "}
          በመኖሪያ ስምምነት አንቀጽ {dotVal(r.allocation_no, 120)}{" "}
          <br />
          መሠረት የድርጅቱን ንብረት በአግባቡ ለመያዝና የቤቱንም ጽዳት ለመጠበቅ{" "}
          <br />
          ተስማምቼ ከዚህ በታች የተዘረዘሩትን ነገሮች በደህና ሁኔታ መቀበሌን{" "}
          <br />
          እገልጻለሁ፡፡
        </div>

        {/* ═══ 1. በሮችና መሠረታዊ ዕቃዎች ═══ */}
        <div className="font-bold text-[9.5pt] mt-3 mb-0.5">1. በሮችና መሠረታዊ ዕቃዎች</div>

        <div className="text-[9pt]">
          <span className="font-semibold">ሀ.</span> የፊት በር መክፈቻ {dotVal(r.inspection_admin, 200)}
          <span className="mx-2" />
          <span className="font-bold">ቁልፍ</span> {dot(160)}
        </div>

        {/* ═══ 2. መስኮቶችና እቃዎች ═══ */}
        <div className="font-bold text-[9.5pt] mt-2.5 mb-0.5">2. መስኮቶችና እቃዎች</div>

        <div className="text-[9pt]">
          <span className="font-semibold">ሀ.</span> የሳሎን መስኮት መዋቅር {dotVal(r.inspection_structural, 200)}
        </div>
        <div className="text-[9pt]">
          <span className="font-semibold">ለ.</span> የመኝታ ክፍል መዋቅር {dot(200)}
        </div>

        {/* ═══ 3. የመብራት ዕቃዎች ═══ */}
        <div className="font-bold text-[9.5pt] mt-2.5 mb-0.5">3. የመብራት ዕቃዎች</div>

        <div className="text-[9pt]">
          <span className="font-semibold">ሀ.</span> የላምፕ ማብሪያና ማጥፊያ {dotVal(r.inspection_electrical, 200)}
        </div>
        <div className="text-[9pt]">
          <span className="font-semibold">ለ.</span> የመሠረት ማጥፊያዎች {dot(200)}
        </div>
        <div className="text-[9pt]">
          <span className="font-semibold">ሐ.</span> ሌሎች {dot(200)}
        </div>

        {/* ═══ 4. የቤቱ አጠቃላይ ሁኔታ ═══ */}
        <div className="font-bold text-[9.5pt] mt-2.5 mb-0.5">4. የቤቱ አጠቃላይ ሁኔታ</div>

        <div className="text-[9pt]">
          <span className="font-semibold">ሀ.</span> የተደረሰበት ሁኔታ {dotVal(r.inspection_water, 200)}
        </div>
        <div className="text-[9pt]">
          <span className="font-semibold">ለ.</span> ሌሎች {dot(200)}
        </div>

      </div>

      {/* ── SIGNATURES ── */}
      <div className="flex justify-between mt-5 gap-8 text-[9pt]">
        <div className="flex-1">
          <div className="font-bold text-[9.5pt] mb-1.5">ተረካቢ</div>
          <div>
            <span className="font-bold">ስም:</span> {dotVal(r.employee_name, 160)}
          </div>
          <div>
            <span className="font-bold">ፊርማ:</span> {dot(160)}
          </div>
          <div>
            <span className="font-bold">ቀን:</span> {dot(160)}
          </div>
        </div>
        <div className="flex-1">
          <div className="font-bold text-[9.5pt] mb-1.5">አስረካቢ</div>
          <div>
            <span className="font-bold">ስም:</span> {dotVal(r.generated_by_name, 160)}
          </div>
          <div>
            <span className="font-bold">ፊርማ:</span> {dot(160)}
          </div>
          <div>
            <span className="font-bold">ቀን:</span> {dot(160)}
          </div>
        </div>
      </div>
    </div>
  );
}