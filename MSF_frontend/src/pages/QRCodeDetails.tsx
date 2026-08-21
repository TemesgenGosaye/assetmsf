import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  QrCode, Package, Building2, Calendar, Printer, Image,
  MapPin, Hash, Layers, FileText,
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";
import { djangoRequest } from "@/services/djangoAuth";

export default function QRCodeDetails() {
  const { id } = useParams<{ id: string }>();
  const [qr, setQr] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await djangoRequest<any>("/qr-codes/?page_size=1000");
        if (res.success) {
          const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          const found = rows.find((r: any) => r.id === id);
          if (found) {
            setQr({
              id: found.id,
              asset: found.asset,
              assetCode: found.asset_code || found.assetCode || '',
              assetIdentifier: found.asset_identifier || found.assetIdentifier || '',
              assetId: found.asset_code || found.asset_identifier || found.asset_id || found.id,
              assetName: found.asset_name || found.assetName,
              property: found.property,
              department: found.department,
              generatedDate: found.generated_date || found.created_at,
              status: found.status,
              printed: found.printed,
              imageUrl: found.image_url || found.imageUrl,
              assetDetail: found.asset_detail || null,
            });
          }
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load QR code");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !qr) {
    return (
      <DetailPage
        backTo="/qr-codes"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "QR Codes", to: "/qr-codes" }, { label: "QR Code Details" }]}
        title="QR Code"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading QR code details..."
        notFound={!loading && !qr}
        notFoundTitle="QR Code Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/qr-codes"
      breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "QR Codes", to: "/qr-codes" }, { label: qr.assetCode || qr.assetName || qr.assetId }]}
      title="QR Code"
      hero={{
        icon: <QrCode className="h-7 w-7" />,
        name: qr.assetName || "QR Code",
        subtitle: qr.assetCode ? `PID: ${qr.assetCode}` : `Asset: ${qr.assetId}`,
        status: qr.status,
        badges: (
          <>
            {qr.assetCode && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {qr.assetCode}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-mono">
              <QrCode className="h-3 w-3 mr-1" />{qr.id?.slice(0, 8)}
            </Badge>
          </>
        ),
      }}
      sections={[
        {
          title: "Asset Identity",
          titleIcon: Hash,
          fields: [
            { icon: Hash, label: "PID", value: qr.assetCode || "—" },
            { icon: FileText, label: "Asset Identifier", value: qr.assetIdentifier || "—" },
            { icon: Package, label: "Asset Name", value: qr.assetName || "—" },
            { icon: Layers, label: "Status", value: <StatusChip status={qr.status} size="sm" /> },
          ],
        },
        {
          title: "Location",
          titleIcon: Building2,
          fields: [
            { icon: Building2, label: "Property", value: qr.property || "—" },
            { icon: MapPin, label: "Department", value: qr.department || qr.assetDetail?.department || "—" },
          ],
        },
        {
          title: "QR Code Info",
          titleIcon: QrCode,
          fields: [
            { icon: Printer, label: "Printed", value: qr.printed ? "Yes" : "No" },
            { icon: Calendar, label: "Generated", value: qr.generatedDate ? new Date(qr.generatedDate).toLocaleString() : "—" },
          ],
        },
      ]}
      sidebar={
        <div className="space-y-4">
          {qr.imageUrl && (
            <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  QR Image
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex justify-center">
                <img src={qr.imageUrl} alt={`QR for ${qr.assetName}`} className="max-h-48 rounded-lg border border-border/60" />
              </CardContent>
            </Card>
          )}

          {qr.assetDetail && (
            <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
              <CardHeader className="py-4 border-b border-border/60">
                <CardTitle className="text-sm font-semibold">Linked Asset</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{qr.assetDetail.name}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-mono font-medium">{qr.assetDetail.asset_code}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-medium">{qr.assetDetail.department}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      }
    />
  );
}
