import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileBarChart, User, Calendar, Download, Filter,
  Building2, Package, ClipboardCheck, Database
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";
import { djangoRequest } from "@/services/djangoAuth";

export default function ReportDetails() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await djangoRequest<any>(`/reports/?page_size=1000`);
        if (res.success) {
          const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          const found = rows.find((r: any) => r.id === id);
          if (found) {
            setReport({
              id: found.id, name: found.name, type: found.type, format: found.format,
              status: found.status, dateFrom: found.date_from, dateTo: found.date_to,
              fileUrl: found.file_url, filterSessionId: found.filter_session_id,
              filterDepartment: found.filter_department, filterProperty: found.filter_property,
              filterAssetType: found.filter_asset_type, createdBy: found.created_by,
              createdAt: found.created_at,
            });
          }
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !report) {
    return (
      <DetailPage
        backTo="/reports"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Reports", to: "/reports" }, { label: "Report Details" }]}
        title="Report"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading report details..."
        notFound={!loading && !report}
        notFoundTitle="Report Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/reports"
      breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Reports", to: "/reports" }, { label: report.name }]}
      title="Report"
      hero={{
        icon: <FileBarChart className="h-7 w-7" />,
        name: report.name,
        subtitle: `${report.type} · ${report.format}`,
        status: report.status,
        badges: (
          <Badge variant="outline" className="text-[10px] font-mono">
            <FileBarChart className="h-3 w-3 mr-1" />{report.type}
          </Badge>
        ),
      }}
      sections={[
        {
          title: "Report Information",
          titleIcon: FileBarChart,
          fields: [
            { icon: Database, label: "Type", value: report.type },
            { icon: Filter, label: "Format", value: report.format?.toUpperCase() },
            { icon: Calendar, label: "Date Range", value: report.dateFrom && report.dateTo ? `${new Date(report.dateFrom).toLocaleDateString()} – ${new Date(report.dateTo).toLocaleDateString()}` : "—" },
            { icon: Calendar, label: "Generated", value: report.createdAt ? new Date(report.createdAt).toLocaleString() : "—" },
          ],
        },
        {
          title: "Filters Applied",
          titleIcon: Filter,
          fields: [
            { icon: ClipboardCheck, label: "Session", value: report.filterSessionId || "—" },
            { icon: Building2, label: "Property", value: report.filterProperty || "All" },
            { icon: Package, label: "Asset Type", value: report.filterAssetType || "All" },
            { icon: User, label: "Created By", value: report.createdBy || "—" },
          ],
        },
      ]}
      sidebar={
        report.fileUrl ? (
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Download</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Button asChild variant="outline" className="w-full gap-1.5">
                <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 text-primary" /> Download Report
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : undefined
      }
    />
  );
}
