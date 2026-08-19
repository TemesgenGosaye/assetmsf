import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { type TerminationTransaction } from "@/services/houseApplication";
import {
  printClearanceSlip,
  downloadClearanceSlipPdf,
} from "@/lib/clearanceSlipPdf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slip: TerminationTransaction;
};

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function ClearanceSlipModal({ open, onOpenChange, slip }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadClearanceSlipPdf(slip);
      toast.success("Clearance slip PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }, [slip]);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    try {
      printClearanceSlip(slip);
    } catch (e: any) {
      toast.error(e?.message || "Failed to print");
    } finally {
      setPrinting(false);
    }
  }, [slip]);

  const statusColor =
    slip.status === "Completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 border-slate-800/10">
        {/* ── Header ── */}
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-gradient-to-b from-emerald-600/20 to-emerald-900/20 shadow-inner">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="flex items-center gap-2 text-slate-50 text-base">
                    <span className="truncate">Clearance Slip</span>
                    <span className="inline-flex items-center gap-1 rounded border border-slate-600/60 bg-slate-950/40 px-1.5 py-0.5 text-[11px] font-mono tracking-wide text-emerald-300">
                      {slip.termination_no || "—"}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs mt-0.5 truncate">
                    {slip.employee_name} · House {slip.house_number}
                  </DialogDescription>
                </div>
              </div>
              <div className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium bg-white ${statusColor}`}>
                {slip.status}
              </div>
            </div>
          </DialogHeader>

          {/* Metadata strip */}
          <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
            <span>Effective: {fmtDate(slip.effective_date)}</span>
            {slip.case_name && <span>Case: {slip.case_name}</span>}
            {slip.damage_costs && (
              <span className="text-amber-400">Damages: ETB {slip.damage_costs}</span>
            )}
          </div>
        </div>

        {/* ── Preview ── */}
        <ScrollArea className="flex-1">
          <div className="p-4 bg-slate-100/60">
            <div className="mx-auto max-w-[680px] rounded-sm border border-slate-300 bg-white shadow-sm">
              <ClearanceSlipPreview slip={slip} />
            </div>
          </div>
        </ScrollArea>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-2 border-t bg-muted/30 px-6 py-3">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
          <Button onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Reprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Inline A4 preview ─────────────────────────────────────────────── */

function ClearanceSlipPreview({ slip: t }: { slip: TerminationTransaction }) {
  const dot = (w = 160) => (
    <span
      className="inline-block border-b border-dotted border-slate-400 px-0.5"
      style={{ minWidth: w }}
    >
      &nbsp;
    </span>
  );

  const dotVal = (val: string | null | undefined, w = 160) => (
    <span
      className="inline-block border-b border-dotted border-slate-400 font-semibold text-slate-900 px-0.5"
      style={{ minWidth: w }}
    >
      {val || "\u00A0"}
    </span>
  );

  const fmtCurrency = (v?: number | string | null) =>
    v ? `ETB ${v}` : "0.00";

  return (
    <div
      className="p-5 text-[9pt] leading-[1.7] text-slate-800"
      style={{ fontFamily: '"Noto Sans Ethiopic", "Noto Sans", Arial, sans-serif' }}
    >
      {/* Header table */}
      <table className="w-full border-collapse border border-slate-900 text-[8pt] mb-0">
        <tbody>
          <tr>
            <td className="border border-slate-900 p-1.5 w-[12%] text-center align-middle">
              <img
                src="/msf_logo.jpg"
                alt="MSF"
                className="w-[52px] h-[52px] object-contain mx-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </td>
            <td className="border border-slate-900 p-1.5 w-[58%] text-center align-middle">
              <div className="text-[8pt] text-slate-500 font-medium">የድርጅቱ ስም / Company Name:</div>
              <div className="text-[12pt] font-bold text-slate-900 leading-tight my-0.5">
                መተሐራ ስኳር ፋብሪካ
              </div>
              <div className="text-[10pt] font-bold text-slate-800 tracking-wide">
                METAHARA SUGAR FACTORY
              </div>
            </td>
            <td className="border border-slate-900 p-1.5 w-[30%] align-middle text-[8pt]">
              <div className="flex justify-between mb-1">
                <span className="font-bold">Form No:</span>
                <span>OF/MSF/HRSM/293</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="font-bold">Issue No:</span>
                <span>2</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Page:</span>
                <span>1 of 1</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Title bar */}
      <table className="w-full border-collapse border border-slate-900 border-t-0 text-[9pt] mb-4">
        <tbody>
          <tr>
            <td className="border border-slate-900 p-1.5 text-center font-bold text-[10pt]">
              የቤ.ት ርክክብ ማረጋገጫ እና ክሊራንስ ፎርም
              <span className="font-normal text-slate-600 ml-2">(Housing Clearance &amp; Handover Slip)</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Body */}
      <div className="text-[9.5pt] leading-[2] text-justify">
        <p>
          <strong>ለሰው ሃብት ሥራ አመራር ቡድን</strong><br />
          <strong>መድረክ፡</strong>
        </p>
        <br />
        <p>
          ይህ መረጃ የተሰጠው አቶ/ወ/ሮ {dotVal(t.employee_name, 220)} ከድርጅቱ ጋር
          የነበራቸው የሥራ ሁኔታ ({dotVal(t.case_name || t.case_category, 140)}) በመቋረጡ/በመዘዋወሩ
          የድርጅቱ ቤት ቁጥር {dotVal(t.house_number, 100)} ያስረከቡ መሆናቸውን እናረጋግጣለን።
        </p>
        <br />
        <p>
          በመሆኑም ሲያስረክብ የተረጋገጠው የጉዳት ግምገማ ድምር{" "}
          {dotVal(fmtCurrency(t.damage_costs), 120)} እና ቀሪ ጉዳዮች (
          {dotVal(t.outstanding_issues || "None", 180)}) መኖራቸውን/አለመኖራቸውን
          አረጋግጠን ንብረቱ ጸድቆ ተረክበናል።
        </p>
        <br />
        <p>
          <strong>ውጤታማ ቀን / Effective Date:</strong>{" "}
          {dotVal(fmtDate(t.effective_date), 140)}
          &nbsp;&nbsp;
          <strong>ማጣቀሻ / Ref:</strong>{" "}
          {dotVal(t.termination_no, 140)}
        </p>
      </div>

      {/* Signature */}
      <div className="flex justify-end mt-8">
        <div className="w-64 text-[9pt]">
          <div className="font-bold mb-1">ከሰላምታ ጋር</div>
          <div className="border-b border-slate-900 pb-6 mb-1" />
          <div className="font-bold text-slate-900">ሰቦታ ጀርቤ</div>
          <div className="text-slate-600">የፋ.ሲ.ቲ ማኔጅመንት ቡድኑ መሪ</div>
        </div>
      </div>

      {/* CC */}
      <div className="mt-6 border-t border-dashed border-slate-300 pt-3 text-[9pt]">
        <div className="font-bold mb-0.5">ግልባጭ:-</div>
        <div>ለቤቶች አስተዳደር መድረክ</div>
      </div>

      {/* Footer */}
      <div className="mt-6 border-t-2 border-b-2 border-slate-900 text-center py-1.5 text-[8pt] font-bold tracking-wide uppercase bg-slate-50">
        PLEASE MAKE SURE THAT THIS IS THE CORRECT ISSUE BEFORE USE
      </div>
    </div>
  );
}
