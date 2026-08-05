import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  composeQrWithLabel,
  composeQrA4Sheet,
  LABEL_PRESETS,
  printImagesAsLabels,
} from "@/lib/qr";
import QRCode from "qrcode";
import { createQRCode, updateQRCode, type QRCode as SbQRCode } from "@/services/qrcodes";
import { logActivity } from "@/services/activity";
import { isDemoMode } from "@/lib/demo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: any[];
  selectedIds: Set<string>;
};

export default function QrExportModal({ open, onOpenChange, assets, selectedIds }: Props) {
  const [exportFmt, setExportFmt] = useState<"png" | "pdf" | "label">("png");
  const [exportOrientation, setExportOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");
  const [labelPresetId, setLabelPresetId] = useState<string>("4x6in");
  const [labelUseCustom, setLabelUseCustom] = useState<boolean>(false);
  const [labelCustomWidth, setLabelCustomWidth] = useState<string>("4");
  const [labelCustomHeight, setLabelCustomHeight] = useState<string>("6");
  const [labelUnits, setLabelUnits] = useState<"in" | "mm">("in");

  useEffect(() => {
    if (!open) return;
    setExportFmt("png");
    setExportOrientation("portrait");
    setLabelPresetId("4x6in");
    setLabelUseCustom(false);
    setLabelCustomWidth("4");
    setLabelCustomHeight("6");
    setLabelUnits("in");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-background border rounded-lg w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Export QR Sheet</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Format</label>
            <div className="mt-1 flex gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fmt"
                  checked={exportFmt === "png"}
                  onChange={() => setExportFmt("png")}
                />{" "}
                PNG
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fmt"
                  checked={exportFmt === "pdf"}
                  onChange={() => setExportFmt("pdf")}
                />{" "}
                PDF
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fmt"
                  checked={exportFmt === "label"}
                  onChange={() => setExportFmt("label")}
                />{" "}
                Label (roll printer)
              </label>
            </div>
          </div>
          {exportFmt !== "label" && (
            <div>
              <label className="text-sm font-medium">Orientation</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="orient"
                    checked={exportOrientation === "portrait"}
                    onChange={() => setExportOrientation("portrait")}
                  />{" "}
                  Portrait
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="orient"
                    checked={exportOrientation === "landscape"}
                    onChange={() => setExportOrientation("landscape")}
                  />{" "}
                  Landscape
                </label>
              </div>
            </div>
          )}
          {exportFmt === "label" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Label size</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <label className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="labelMode"
                      checked={!labelUseCustom}
                      onChange={() => setLabelUseCustom(false)}
                    />{" "}
                    Preset
                  </label>
                  <label className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="labelMode"
                      checked={labelUseCustom}
                      onChange={() => setLabelUseCustom(true)}
                    />{" "}
                    Custom
                  </label>
                </div>
                {!labelUseCustom ? (
                  <Select
                    value={labelPresetId}
                    onValueChange={(v) => {
                      setLabelPresetId(v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select label size" />
                    </SelectTrigger>
                    <SelectContent>
                      {LABEL_PRESETS.map((lp) => (
                        <SelectItem key={lp.id} value={lp.id}>
                          {lp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Width
                      </label>
                      <Input
                        value={labelCustomWidth}
                        onChange={(e) =>
                          setLabelCustomWidth(e.target.value)
                        }
                        placeholder={labelUnits === "in" ? "inches" : "mm"}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Height
                      </label>
                      <Input
                        value={labelCustomHeight}
                        onChange={(e) =>
                          setLabelCustomHeight(e.target.value)
                        }
                        placeholder={labelUnits === "in" ? "inches" : "mm"}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex gap-3">
                        <label className="inline-flex items-center gap-1 text-sm">
                          <input
                            type="radio"
                            name="labelUnits"
                            checked={labelUnits === "in"}
                            onChange={() => setLabelUnits("in")}
                          />{" "}
                          in
                        </label>
                        <label className="inline-flex items-center gap-1 text-sm">
                          <input
                            type="radio"
                            name="labelUnits"
                            checked={labelUnits === "mm"}
                            onChange={() => setLabelUnits("mm")}
                          />{" "}
                          mm
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Prints one label per page sized exactly to your label. Use
                your printer options for material and density.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const base =
                    (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL ||
                    "https://samsproject.in";
                  const normalizedBase = (base || "").replace(/\/$/, "");
                  // Only export explicitly selected asset IDs (no implicit group expansion)
                  const targets = assets.filter((a) =>
                    selectedIds.has(a.id),
                  );
                  if (!targets.length) {
                    toast.info("Nothing selected");
                    return;
                  }
                  const images: string[] = [];
                  // Generate one QR per target asset (grouped)
                  const createdIds: string[] = [];
                  for (let i = 0; i < targets.length; i++) {
                    const a = targets[i];
                    const url = `${normalizedBase}/assets/${a.id}`;
                    const raw = await QRCode.toDataURL(url, {
                      width: 512,
                      margin: 2,
                      color: { dark: "#000", light: "#FFF" },
                      errorCorrectionLevel: "M",
                    });
                    const labeled = await composeQrWithLabel(raw, {
                      assetId: a.id,
                      topText: a.name || "Scan to view asset",
                    });
                    images.push(labeled);
                    // Persist QR record so it appears in QR Codes page
                    try {
                      if (!isDemoMode()) {
                        const payload: SbQRCode = {
                          id: `QR-${a.id}-${Date.now()}`,
                          assetId: a.id,
                          property: a.property ?? null,
                          generatedDate: new Date()
                            .toISOString()
                            .slice(0, 10),
                          status: "Generated",
                          printed: false,
                          imageUrl: labeled,
                        } as any;
                        await createQRCode(payload);
                        createdIds.push(payload.id);
                      }
                    } catch {
                      // best effort — QR image still exported
                    }
                  }
                  // Log bulk activity summary
                  try {
                    await logActivity(
                      "qr_bulk_generated",
                      `Generated ${targets.length} QR code(s) for export`,
                    );
                  } catch {}
                  if (exportFmt === "png") {
                    const { dataUrl } = await composeQrA4Sheet(images, {
                      orientation: exportOrientation,
                    });
                    const aEl = document.createElement("a");
                    aEl.href = dataUrl;
                    aEl.download = `qr-selected-${new Date().toISOString().slice(0, 10)}.png`;
                    aEl.click();
                  } else if (exportFmt === "pdf") {
                    // Print-to-PDF via hidden iframe to avoid popup blockers
                    const { dataUrl } = await composeQrA4Sheet(images, {
                      orientation: exportOrientation,
                    });
                    const pageCss =
                      exportOrientation === "portrait"
                        ? "@page { size: A4 portrait; margin: 0; }"
                        : "@page { size: A4 landscape; margin: 0; }";
                    const iframe = document.createElement("iframe");
                    iframe.style.position = "fixed";
                    iframe.style.right = "0";
                    iframe.style.bottom = "0";
                    iframe.style.width = "0";
                    iframe.style.height = "0";
                    iframe.style.border = "0";
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow?.document;
                    doc?.open();
                    const pageDims =
                      exportOrientation === "portrait"
                        ? "width:210mm;height:297mm;"
                        : "width:297mm;height:210mm;";
                    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>QR Sheet</title>
    <style>
      ${pageCss}
      html, body { margin: 0; padding: 0; }
      .page { ${pageDims} margin: 0; display: flex; align-items: center; justify-content: center; }
      .page img { width: 100%; height: 100%; object-fit: contain; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body>
    <div class="page"><img id="sheet" src="${dataUrl}" /></div>
  </body>
</html>`;
                    doc?.write(html);
                    doc?.close();
                    const imgEl = doc?.getElementById(
                      "sheet",
                    ) as HTMLImageElement | null;
                    const triggerPrint = () => {
                      try {
                        iframe.contentWindow?.focus();
                        // slight delay ensures layout sizes are applied before printing
                        setTimeout(() => iframe.contentWindow?.print(), 50);
                      } finally {
                        // remove iframe after a short delay
                        setTimeout(() => {
                          try {
                            document.body.removeChild(iframe);
                          } catch {}
                        }, 1000);
                      }
                    };
                    if (imgEl && !imgEl.complete) {
                      imgEl.onload = () => setTimeout(triggerPrint, 50);
                    } else {
                      setTimeout(triggerPrint, 300);
                    }
                    // Mark printed in history for PDF path
                    try {
                      if (!isDemoMode() && createdIds.length) {
                        await Promise.all(
                          createdIds.map((id) =>
                            updateQRCode(id, {
                              printed: true,
                              status: "Printed",
                            } as any),
                          ),
                        );
                      }
                    } catch {}
                  } else if (exportFmt === "label") {
                    let widthIn = 4,
                      heightIn = 6;
                    if (!labelUseCustom) {
                      const preset =
                        LABEL_PRESETS.find((p) => p.id === labelPresetId) ||
                        LABEL_PRESETS[0];
                      widthIn = preset.widthIn;
                      heightIn = preset.heightIn;
                    } else {
                      const w = parseFloat(labelCustomWidth) || 1;
                      const h = parseFloat(labelCustomHeight) || 1;
                      if (labelUnits === "mm") {
                        widthIn = w / 25.4;
                        heightIn = h / 25.4;
                      } else {
                        widthIn = w;
                        heightIn = h;
                      }
                    }
                    await printImagesAsLabels(images, {
                      widthIn,
                      heightIn,
                      orientation: "portrait",
                      fit: "contain",
                    });
                    // Mark printed in history for Label path
                    try {
                      if (!isDemoMode() && createdIds.length) {
                        await Promise.all(
                          createdIds.map((id) =>
                            updateQRCode(id, {
                              printed: true,
                              status: "Printed",
                            } as any),
                          ),
                        );
                      }
                    } catch {}
                  }
                } finally {
                  onOpenChange(false);
                }
              }}
            >
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
