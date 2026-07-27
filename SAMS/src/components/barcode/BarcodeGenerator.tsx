import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Barcode, Download, Printer, Copy } from "lucide-react";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";

interface BarcodeGeneratorProps {
  open: boolean;
  onClose: () => void;
  value: string; // string to encode
}

export function BarcodeGenerator({ open, onClose, value }: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [generated, setGenerated] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 80,
        margin: 5,
        background: "#ffffff",
        lineColor: "#000000",
      });
      const svg = svgRef.current.outerHTML;
      const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      setGenerated(dataUrl);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate barcode");
    }
  }, [open, value]);

  const downloadBarcode = () => {
    if (!generated) return;
    const link = document.createElement("a");
    link.href = generated;
    link.download = `barcode-${value}.svg`;
    link.click();
    toast.success("Barcode downloaded");
  };

  const printBarcode = () => {
    if (!generated) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<img src="${generated}" alt="Barcode"/>`);
      win.print();
      win.close();
      toast.success("Print dialog opened");
    }
  };

  const copyBarcode = async () => {
    if (!generated) return;
    try {
      const response = await fetch(generated);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/svg+xml": blob })]);
      toast.success("Barcode copied to clipboard");
    } catch (e) {
      console.error(e);
      toast.error("Failed to copy barcode");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Barcode for {value}</DialogTitle>
          <DialogDescription>Generated barcode can be downloaded, printed or copied.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Hidden SVG used for generation */}
          <svg ref={svgRef} className="hidden" />
          {generated && (
            <img src={generated} alt="Barcode" className="h-32" />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadBarcode}>
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button variant="outline" onClick={printBarcode}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" onClick={copyBarcode}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
