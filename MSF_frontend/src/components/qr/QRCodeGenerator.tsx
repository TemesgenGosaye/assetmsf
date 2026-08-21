import { useState } from "react";
import { generateQrPng, downloadDataUrl, printImagesOnA4Grid } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Printer, Copy } from "lucide-react";
import { toast } from "sonner";

interface QRCodeGeneratorProps {
  asset: any;
  onGenerated?: (qrCodeUrl: string) => void;
}

const canCopyImages =
  typeof navigator !== "undefined" &&
  !!navigator.clipboard &&
  typeof (window as any).ClipboardItem !== "undefined";

export function QRCodeGenerator({ asset, onGenerated }: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

    const generateQRCode = async () => {
      if (!asset) {
        toast.error("No asset selected");
        return;
      }

      setIsGenerating(true);
      try {
        const composed = await generateQrPng({ assetData: asset });
        setQrCodeUrl(composed);
        onGenerated?.(composed);
        toast.success("QR code generated successfully!");
      } catch (error) {
        console.error("Error generating QR code:", error);
        toast.error("Failed to generate QR code")
     } finally {
       setIsGenerating(false);
     }
   };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !asset) return;
    downloadDataUrl(qrCodeUrl, `qr-code-${asset.asset_code || asset.id}.png`);
    toast.success("QR code downloaded!");
  };

  const printQRCode = async () => {
    if (!qrCodeUrl) return;
    try {
      await printImagesOnA4Grid([qrCodeUrl]);
      toast.success("Sent to printer");
    } catch (e) {
      console.error(e);
      toast.error("Failed to print");
    }
  };

  const copyQRCode = async () => {
    if (!qrCodeUrl || !canCopyImages) return;
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("QR code copied to clipboard!");
    } catch (error) {
      console.error("Error copying QR code:", error);
      toast.error("Failed to copy QR code");
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-lg">
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <QrCode className="h-5 w-5 text-primary" />
          QR Code Generator
        </CardTitle>
        <CardDescription>Generate a unique QR code for this asset</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {asset && (
          <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PID
                </Label>
                <p className="font-mono text-sm font-medium text-foreground">{asset.asset_code || asset.id}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Asset Name
                </Label>
                <p className="text-sm font-medium text-foreground">{asset.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Property
                </Label>
                <p className="text-sm font-medium text-foreground">{asset.property}</p>
              </div>
            </div>
          </div>
        )}

        {!qrCodeUrl && (
          <Button
            onClick={generateQRCode}
            disabled={isGenerating || !asset}
            className="w-full h-12 text-base gap-2 shadow-md transition-all hover:shadow-lg"
          >
            <QrCode className="h-5 w-5" />
            {isGenerating ? "Generating..." : "Generate QR Code"}
          </Button>
        )}

        {qrCodeUrl && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border/50 bg-muted/10 p-8">
              <div className="relative rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <img src={qrCodeUrl} alt="Generated QR Code" className="h-48 w-48 object-contain" />
              </div>

              <div className="flex flex-wrap gap-3 justify-center w-full">
                <Button onClick={downloadQRCode} variant="outline" className="gap-2 min-w-[100px]">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button onClick={printQRCode} variant="outline" className="gap-2 min-w-[100px]">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                {canCopyImages && (
                  <Button onClick={copyQRCode} variant="outline" className="gap-2 min-w-[100px]">
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                )}
                <Button
                  onClick={generateQRCode}
                  disabled={isGenerating}
                  variant="ghost"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  {isGenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
