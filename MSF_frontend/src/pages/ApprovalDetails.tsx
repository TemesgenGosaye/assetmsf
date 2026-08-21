import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ClipboardCheck, User, Calendar, FileText, MessageSquare,
  ArrowRight, CheckCircle, XCircle, Clock
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";
import { listApprovals, type ApprovalRequest, type ApprovalEvent } from "@/services/approvals";
import { djangoRequest } from "@/services/djangoAuth";

const ACTION_LABELS: Record<string, string> = {
  create: "New Asset",
  edit: "Edit Asset",
  decommission: "Decommission",
};

export default function ApprovalDetails() {
  const { id } = useParams<{ id: string }>();
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const statuses: Array<ApprovalRequest["status"]> = ["pending_manager", "pending_admin", "approved", "rejected"];
        for (const s of statuses) {
          const list = await listApprovals(s);
          const found = list.find((a) => a.id === id);
          if (found) {
            setApproval(found);
            try {
              const res = await djangoRequest<any>(`/approvals/${id}/events/`);
              if (res.success) {
                const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
                setEvents(rows.map((r: any) => ({
                  id: r.id, approvalId: r.approval_id || id, eventType: r.event_type,
                  message: r.message, author: r.author, createdAt: r.created_at,
                })));
              }
            } catch {}
            return;
          }
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load approval");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !approval) {
    return (
      <DetailPage
        backTo="/approvals"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Approvals", to: "/approvals" }, { label: "Approval Details" }]}
        title="Approval"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading approval details..."
        notFound={!loading && !approval}
        notFoundTitle="Approval Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/approvals"
      breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Approvals", to: "/approvals" }, { label: ACTION_LABELS[approval.action] || approval.action }]}
      title="Approval"
      hero={{
        icon: <ClipboardCheck className="h-7 w-7" />,
        name: ACTION_LABELS[approval.action] || approval.action,
        subtitle: `Asset request by ${approval.requestedBy}`,
        status: approval.status,
        badges: (
          <Badge variant="outline" className="text-[10px] font-mono">
            <FileText className="h-3 w-3 mr-1" />{approval.action.toUpperCase()}
          </Badge>
        ),
      }}
      sections={[
        {
          title: "Request Details",
          titleIcon: ClipboardCheck,
          fields: [
            { icon: User, label: "Requested By", value: approval.requestedBy },
            { icon: Calendar, label: "Requested At", value: approval.requestedAt ? new Date(approval.requestedAt).toLocaleString() : "—" },
            { icon: User, label: "Reviewed By", value: approval.reviewedBy || "Pending" },
            { icon: Clock, label: "Reviewed At", value: approval.reviewedAt ? new Date(approval.reviewedAt).toLocaleString() : "—" },
          ],
        },
        {
          title: "Asset & Notes",
          titleIcon: FileText,
          fields: [
            { icon: FileText, label: "PID", value: <span className="font-mono text-xs">{approval.assetId}</span> },
            { icon: MessageSquare, label: "Notes", value: approval.notes || "No notes" },
            { icon: ArrowRight, label: "Department", value: approval.department || "—" },
          ],
        },
      ]}
      sidebar={
        <div className="space-y-4">
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Approval Timeline ({events.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No events yet</p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-xs">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="space-y-1">
                      <p className="text-foreground flex items-center gap-1.5">
                        {ev.eventType === "approved" && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                        {ev.eventType === "rejected" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                        {ev.message || ev.eventType}
                      </p>
                      <p className="text-muted-foreground">{ev.author} · {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}
