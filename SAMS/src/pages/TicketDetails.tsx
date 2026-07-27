import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Ticket, Clock, User, AlertTriangle, Tag, FileText,
  Calendar, ShieldCheck, MessageSquare
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";
import { listTickets, type Ticket as TicketType, type TicketEvent } from "@/services/tickets";
import { djangoRequest } from "@/services/djangoAuth";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  low: "bg-muted text-muted-foreground border border-border",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function TicketDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketType | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const list = await listTickets({});
        const found = list.find((t) => t.id === id);
        if (found) {
          setTicket(found);
          try {
            const res = await djangoRequest<any>(`/tickets/${id}/events/?page_size=100`);
            if (res.success) {
              const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
              setEvents(rows.map((r: any) => ({
                id: r.id, ticketId: r.ticket_id || id, eventType: r.event_type,
                author: r.author, message: r.message, createdAt: r.created_at,
              })));
            }
          } catch {}
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to load ticket");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !ticket) {
    return (
      <DetailPage
        backTo="/tickets"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Tickets", to: "/tickets" }, { label: "Ticket Details" }]}
        title="Ticket"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading ticket details..."
        notFound={!loading && !ticket}
        notFoundTitle="Ticket Not Found"
      />
    );
  }

  return (
    <DetailPage
      backTo="/tickets"
      breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Tickets", to: "/tickets" }, { label: ticket.title }]}
      title="Ticket"
      hero={{
        icon: <Ticket className="h-7 w-7" />,
        name: ticket.title,
        subtitle: ticket.description?.slice(0, 120) || "No description",
        status: ticket.status,
        badges: (
          <>
            <Badge className={PRIORITY_COLORS[ticket.priority || "medium"]}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {(ticket.priority || "medium").charAt(0).toUpperCase() + (ticket.priority || "medium").slice(1)}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              <Tag className="h-3 w-3 mr-1" />{ticket.targetRole?.toUpperCase()}
            </Badge>
          </>
        ),
      }}
      sections={[
        {
          title: "Ticket Information",
          titleIcon: Ticket,
          fields: [
            { icon: Tag, label: "Status", value: <StatusChip status={ticket.status} /> },
            { icon: User, label: "Assigned To", value: ticket.assignee || "Unassigned" },
            { icon: AlertTriangle, label: "Priority", value: (ticket.priority || "medium").charAt(0).toUpperCase() + (ticket.priority || "medium").slice(1) },
            { icon: ShieldCheck, label: "Target Role", value: ticket.targetRole?.toUpperCase() },
          ],
        },
        {
          title: "Timeline",
          titleIcon: Clock,
          fields: [
            { icon: Calendar, label: "Created", value: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "—" },
            { icon: Clock, label: "Last Updated", value: ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "—" },
            { icon: Calendar, label: "SLA Due", value: ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : "No SLA" },
            { icon: User, label: "Created By", value: ticket.createdBy || "—" },
          ],
        },
      ]}
      sidebar={
        <div className="space-y-4">
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Activity ({events.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No activity yet</p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-xs">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="space-y-1">
                      <p className="text-foreground">{ev.message || ev.eventType}</p>
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
