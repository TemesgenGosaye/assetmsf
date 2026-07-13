/**
 * Tickets service – talks to Django REST /api/tickets/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { addNotification, addRoleNotification } from "@/services/notifications";
import { listUsers } from "@/services/users";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import { sendTicketAssignedEmail, sendTicketStatusUpdateEmail } from "@/services/email";
import { djangoRequest } from "./djangoAuth";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: string;
  title: string;
  description: string;
  targetRole: "admin" | "manager";
  status: TicketStatus;
  assignee?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  slaDueAt?: string | null;
  closeNote?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
  propertyId?: string | null;
};

export type TicketEvent = {
  id: string;
  ticketId: string;
  eventType: "created" | "status_change" | "comment" | "closed";
  author: string;
  message: string;
  createdAt: string;
};

const LS_KEY = "tickets";
const LS_EVENTS_KEY = "ticket_events";
const DEMO_TICKETS_KEY = "demo_tickets";
const DEMO_TICKET_EVENTS_KEY = "demo_ticket_events";
const TICKET_CACHE_PREFIX = "tickets:list";
const TICKET_CACHE_TTL = 30_000;

// ── Local helpers ──────────────────────────────────────────────────────────

function loadLocal(): Ticket[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list: Ticket[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}
function loadLocalEvents(): TicketEvent[] {
  try { return JSON.parse(localStorage.getItem(LS_EVENTS_KEY) || "[]"); } catch { return []; }
}
function saveLocalEvents(list: TicketEvent[]) {
  try { localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(list)); } catch {}
}
function loadDemoTickets(): Ticket[] {
  try { return JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY) || "[]"); } catch { return []; }
}
function saveDemoTickets(list: Ticket[]) {
  try { localStorage.setItem(DEMO_TICKETS_KEY, JSON.stringify(list)); } catch {}
}
function loadDemoEvents(): TicketEvent[] {
  try { return JSON.parse(localStorage.getItem(DEMO_TICKET_EVENTS_KEY) || "[]"); } catch { return []; }
}
function saveDemoEvents(list: TicketEvent[]) {
  try { localStorage.setItem(DEMO_TICKET_EVENTS_KEY, JSON.stringify(list)); } catch {}
}

// ── Demo seeding ──────────────────────────────────────────────────────────

let demoSeeded = false;
function seedDemoTicketsOnce() {
  if (demoSeeded) return;
  demoSeeded = true;
  if (loadDemoTickets().length > 0) return;
  const now = new Date();
  const mkDate = (daysAgo: number, hours: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hours, (hours * 7) % 60, 0, 0);
    return d.toISOString();
  };
  const titles = [
    "Printer not working in Floor 2",
    "Air conditioning maintenance - Warehouse",
    "Laptop battery replacement request",
    "Network switch reboot required",
    "Office chairs inspection",
    "Security camera offline - Loading Bay",
  ];
  const descs = [
    "Observed intermittent errors while printing.",
    "Temperature fluctuations during the afternoon.",
    "Battery health below 70%.",
    "Periodic reboot to restore connectivity.",
    "Please assess wear and tear.",
    "Camera #3 is offline since this morning.",
  ];
  const statuses: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];
  const seed: Ticket[] = Array.from({ length: 8 }, (_, i) => ({
    id: `TCK-${100100 + i}`,
    title: titles[i % titles.length],
    description: descs[i % descs.length],
    targetRole: i % 2 === 0 ? "admin" : "manager",
    status: statuses[i % statuses.length],
    assignee: i % 3 === 0 ? "admin@sams.demo" : i % 3 === 1 ? "manager@sams.demo" : null,
    priority: (["low", "medium", "high", "urgent"] as const)[i % 4],
    slaDueAt: i % 2 === 0 ? mkDate(-(i % 3), 18) : null,
    createdBy: i % 2 === 0 ? "demo.user1@example.com" : "demo.user2@example.com",
    createdAt: mkDate(i % 5, 9 + (i % 4)),
    updatedAt: mkDate(i % 4, 12 + (i % 6)),
    propertyId: null,
  }));
  saveDemoTickets(seed);
}

// ── Mappers ────────────────────────────────────────────────────────────────

function fromDjango(row: any): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetRole: row.target_role,
    status: row.status,
    assignee: row.assignee ?? null,
    priority: row.priority ?? "medium",
    slaDueAt: row.sla_due_at ?? null,
    closeNote: row.close_note ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    propertyId: row.property_id ?? null,
  };
}

function toDjango(input: Partial<Ticket>): any {
  const obj: any = {};
  if ("id" in input) obj.id = input.id;
  if ("title" in input) obj.title = input.title;
  if ("description" in input) obj.description = input.description;
  if ("targetRole" in input) obj.target_role = input.targetRole;
  if ("status" in input) obj.status = input.status;
  if ("priority" in input) obj.priority = input.priority;
  if ("slaDueAt" in input) obj.sla_due_at = input.slaDueAt ?? null;
  if ("closeNote" in input) obj.close_note = input.closeNote ?? null;
  if ("createdBy" in input) obj.created_by = input.createdBy;
  if ("createdAt" in input) obj.created_at = input.createdAt;
  if ("updatedAt" in input) obj.updated_at = input.updatedAt ?? null;
  if ("propertyId" in input) obj.property_id = input.propertyId ?? null;
  if (Object.prototype.hasOwnProperty.call(input, "assignee")) obj.assignee = input.assignee ?? null;
  Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
  return obj;
}

function getActorInfo() {
  try {
    const raw =
      (isDemoMode()
        ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
        : null) || localStorage.getItem("auth_user");
    const u = raw ? JSON.parse(raw) : null;
    return { id: u?.id, email: u?.email, label: u?.email || u?.id || "system" };
  } catch {
    return { id: undefined, email: undefined, label: "system" };
  }
}

// ── Assignee helper ────────────────────────────────────────────────────────

export async function listAssigneesForProperty(
  propertyId: string
): Promise<Array<{ id: string; label: string; role: "admin" | "manager" }>> {
  try {
    const users = await listUsers();
    const norm = (s: string) => (s || "").toLowerCase();
    const managers = users.filter(u => norm(u.role) === "manager" && norm(u.status) !== "inactive");
    const admins = users.filter(u => norm(u.role) === "admin" && norm(u.status) !== "inactive");
    const out: Array<{ id: string; label: string; role: "admin" | "manager" }> = [];

    // Try to get property-specific access
    try {
      const res = await djangoRequest<any>(`/user-access/?property_id=${propertyId}`);
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        const allowedIds = new Set<string>(raw.map((r: any) => String(r.user_id)));
        managers.forEach(m => {
          if (allowedIds.has(m.id)) out.push({ id: m.id, label: m.name || m.email || m.id, role: "manager" });
        });
      }
    } catch {
      managers.forEach(m => out.push({ id: m.id, label: m.name || m.email || m.id, role: "manager" }));
    }
    admins.forEach(a => out.push({ id: a.id, label: `${a.name || a.email || a.id} (Admin)`, role: "admin" }));
    return out;
  } catch {
    return [];
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function listTickets(
  filter?: Partial<Pick<Ticket, "status" | "assignee" | "targetRole" | "createdBy">>,
  options?: { force?: boolean }
): Promise<Ticket[]> {
  if (isDemoMode()) {
    seedDemoTicketsOnce();
    return loadDemoTickets()
      .filter(t => (
        (!filter?.status || t.status === filter.status) &&
        (!filter?.assignee || t.assignee === filter.assignee) &&
        (!filter?.targetRole || t.targetRole === filter.targetRole) &&
        (!filter?.createdBy || t.createdBy === filter.createdBy)
      ))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  const key = `${TICKET_CACHE_PREFIX}:${JSON.stringify(filter || {})}`;
  try {
    return await getCachedValue(
      key,
      async () => {
        const params = new URLSearchParams({ page_size: "500" });
        if (filter?.status) params.set("status", filter.status);
        if (filter?.assignee) params.set("assignee", filter.assignee);
        if (filter?.targetRole) params.set("target_role", filter.targetRole);
        if (filter?.createdBy) params.set("created_by", filter.createdBy);
        const res = await djangoRequest<any>(`/tickets/?${params.toString()}`);
        if (res.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          return raw.map(fromDjango);
        }
        throw new Error(res.message || "Failed to fetch tickets");
      },
      { ttlMs: TICKET_CACHE_TTL, force: options?.force }
    );
  } catch {
    return loadLocal().filter(t => (
      (!filter?.status || t.status === filter.status) &&
      (!filter?.assignee || t.assignee === filter.assignee) &&
      (!filter?.targetRole || t.targetRole === filter.targetRole) &&
      (!filter?.createdBy || t.createdBy === filter.createdBy)
    ));
  }
}

export type NewTicketInput = {
  title: string;
  description: string;
  targetRole?: "admin" | "manager";
  createdBy: string;
  status?: TicketStatus;
  assignee?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  slaDueAt?: string | null;
  propertyId: string;
};

export async function createTicket(input: NewTicketInput): Promise<Ticket> {
  let assignee = input.assignee ?? null;
  let targetRole: "admin" | "manager" = input.targetRole || "manager";

  if (!assignee) {
    try {
      const candidates = await listAssigneesForProperty(input.propertyId);
      const filtered = candidates.filter(c => c.role === targetRole);
      const chosen = filtered[0] || candidates[0];
      if (chosen) { assignee = chosen.id; targetRole = chosen.role; }
    } catch {}
  }

  const payload: Ticket = {
    id: `TCK-${Math.floor(Math.random() * 900000 + 100000)}`,
    title: input.title,
    description: input.description,
    targetRole,
    status: input.status ?? "open",
    assignee,
    priority: input.priority ?? "medium",
    slaDueAt: input.slaDueAt ?? null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
    propertyId: input.propertyId,
  };

  if (isDemoMode()) {
    seedDemoTicketsOnce();
    saveDemoTickets([payload, ...loadDemoTickets()]);
    saveDemoEvents([{
      id: `EV-${Math.floor(Math.random() * 900000 + 100000)}`,
      ticketId: payload.id,
      eventType: "created",
      author: input.createdBy,
      message: payload.title,
      createdAt: new Date().toISOString(),
    }, ...loadDemoEvents()]);
    await addRoleNotification({ title: `New ticket for ${payload.targetRole}`, message: `${payload.id}: ${payload.title}`, type: `ticket-${payload.targetRole}` }, payload.targetRole);
    invalidateCacheByPrefix(TICKET_CACHE_PREFIX);
    return payload;
  }

  // Optimistic local save
  saveLocal([payload, ...loadLocal()]);
  invalidateCacheByPrefix(TICKET_CACHE_PREFIX);

  try {
    const res = await djangoRequest<any>("/tickets/", {
      method: "POST",
      body: JSON.stringify(toDjango(payload)),
    });
    if (res.success) {
      const created = fromDjango(res.data);
      saveLocal([created, ...loadLocal().filter(t => t.id !== payload.id)]);
      invalidateCacheByPrefix(TICKET_CACHE_PREFIX);
      await addRoleNotification({ title: `New ticket for ${created.targetRole}`, message: `${created.id}: ${created.title}`, type: `ticket-${created.targetRole}` }, created.targetRole);
      if (created.assignee) {
        try {
          let creatorName = input.createdBy;
          try {
            const raw = localStorage.getItem("auth_user");
            if (raw) { const u = JSON.parse(raw); creatorName = u?.name || u?.email || creatorName; }
          } catch {}
          await sendTicketAssignedEmail({
            ticketId: created.id, title: created.title, description: created.description,
            priority: created.priority || "medium", assignedBy: creatorName, assignedToEmail: created.assignee,
          });
        } catch {}
      }
      return created;
    }
  } catch {}

  await addRoleNotification({ title: `New ticket for ${payload.targetRole}`, message: `${payload.id}: ${payload.title}`, type: `ticket-${payload.targetRole}` }, payload.targetRole);
  return payload;
}

export async function updateTicket(
  id: string,
  patch: Partial<Ticket>,
  opts?: { message?: string }
): Promise<Ticket | null> {
  const toUpdate = { ...patch, updatedAt: new Date().toISOString() };
  const actor = getActorInfo();

  if (isDemoMode()) {
    const list = loadDemoTickets();
    const idx = list.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], ...toUpdate } as Ticket;
      list[idx] = updated;
      saveDemoTickets(list);
      if (patch.status) {
        saveDemoEvents([{
          id: `EV-${Math.floor(Math.random() * 900000 + 100000)}`,
          ticketId: id,
          eventType: patch.status === "closed" ? "closed" : "status_change",
          author: actor.label,
          message: opts?.message || `Status → ${patch.status}`,
          createdAt: new Date().toISOString(),
        }, ...loadDemoEvents()]);
        await addNotification({ title: `Ticket ${id} ${patch.status}`, message: opts?.message || `Status → ${patch.status}`, type: "ticket-status" });
      }
      invalidateCacheByPrefix(TICKET_CACHE_PREFIX);
      return updated;
    }
    return null;
  }

  // Optimistic local
  const list = loadLocal();
  const idx = list.findIndex(t => t.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...toUpdate } as Ticket;
    saveLocal(list);
  }
  invalidateCacheByPrefix(TICKET_CACHE_PREFIX);

  try {
    const res = await djangoRequest<any>(`/tickets/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(toDjango(toUpdate)),
    });
    if (res.success) {
      const updated = fromDjango(res.data);
      if (idx >= 0) { list[idx] = updated; saveLocal(list); }
      invalidateCacheByPrefix(TICKET_CACHE_PREFIX);
      if (patch.status) {
        await addNotification({ title: `Ticket ${id} ${patch.status}`, message: opts?.message || `Status → ${patch.status}`, type: "ticket-status" });
        try {
          const recipients = [updated.createdBy, updated.assignee].filter(Boolean) as string[];
          if (recipients.length) {
            await sendTicketStatusUpdateEmail({
              ticketId: updated.id, title: updated.title, oldStatus: "unknown",
              newStatus: patch.status, updatedBy: actor.label, comment: opts?.message,
              recipientEmails: Array.from(new Set(recipients)),
            });
          }
        } catch {}
      }
      return updated;
    }
  } catch {}

  return idx >= 0 ? list[idx] : null;
}

export async function listTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  if (isDemoMode()) {
    return loadDemoEvents().filter(e => e.ticketId === ticketId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  try {
    const res = await djangoRequest<any>(`/tickets/${ticketId}/events/`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw.map((r: any) => ({
        id: r.id,
        ticketId: r.ticket_id,
        eventType: r.event_type,
        author: r.author,
        message: r.message,
        createdAt: r.created_at,
      })).sort((a: TicketEvent, b: TicketEvent) => (a.createdAt < b.createdAt ? 1 : -1));
    }
  } catch {}
  return loadLocalEvents().filter(e => e.ticketId === ticketId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
