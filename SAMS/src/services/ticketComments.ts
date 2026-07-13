import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";

export type TicketComment = {
  id: string;
  ticketId: string;
  author: string; // user label (email/id)
  message: string;
  createdAt: string; // ISO
};

const DEMO_KEY = "demo_ticket_comments";
function loadDemo(): TicketComment[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]"); } catch { return []; }
}
function saveDemo(list: TicketComment[]) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {}
}

function djangoEventToComment(row: any): TicketComment {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    author: row.actor_name || row.author || "user",
    message: row.message || "",
    createdAt: row.created_at || new Date().toISOString()
  };
}

export async function listTicketComments(ticketId: string): Promise<TicketComment[]> {
  if (isDemoMode()) {
    const all = loadDemo();
    return all.filter(c => c.ticketId === ticketId).sort((a,b) => a.createdAt < b.createdAt ? -1 : 1);
  }

  try {
    const res = await djangoRequest(`/maintenance/${ticketId}/events/`);
    if (res.success) {
      const events = (Array.isArray(res.data) ? res.data : []) as any[];
      // Filter for comment events
      return events
        .filter(e => e.event_type === "comment")
        .map(djangoEventToComment);
    }
    return [];
  } catch (e) {
    console.warn('listTicketComments failed, returning empty', e);
    return [];
  }
}

export async function addTicketComment(ticketId: string, message: string, authorLabel?: string): Promise<TicketComment> {
  if (isDemoMode()) {
    const author = (() => {
      if (authorLabel) return authorLabel;
      try {
        const raw = sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user');
        const u = raw ? JSON.parse(raw) : null;
        return (u?.email || u?.id || 'user') as string;
      } catch { return 'user'; }
    })();
    const payload: TicketComment = {
      id: `CMT-${Math.floor(Math.random()*900000+100000)}`,
      ticketId,
      author,
      message,
      createdAt: new Date().toISOString(),
    };
    const list = loadDemo();
    saveDemo([...list, payload]);
    return payload;
  }

  const res = await djangoRequest(`/maintenance/${ticketId}/events/`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
  if (res.success && res.data) {
    return djangoEventToComment(res.data);
  }
  throw new Error(res.message || "Failed to add comment");
}
