/**
 * Notifications service – talks to Django REST /api/notifications/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";
import { playNotificationSound } from "@/lib/sound";
import { djangoRequest } from "./djangoAuth";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

export type CRUDOperation = "create" | "update" | "delete" | "view";
export type EntityType =
  | "asset"
  | "property"
  | "user"
  | "ticket"
  | "approval"
  | "qr_code"
  | "report"
  | "audit"
  | "setting"
  | "house"
  | "newsletter"
  | "allocation"
  | "license"
  | "department"
  | "scan";

const LS_KEY = "notifications";

function loadLocal(): Notification[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Notification[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: Notification[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function getActorName(): string | null {
  try {
    const raw =
      (isDemoMode()
        ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
        : null) || localStorage.getItem("auth_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.name || u?.email || u?.id || null;
  } catch {
    return null;
  }
}

// ── API ───────────────────────────────────────────────────────────────────

export async function listNotifications(limit = 50): Promise<Notification[]> {
  try {
    const uid = getCurrentUserId();
    if (!uid) return loadLocal().slice(0, limit);
    const res = await djangoRequest<any>(`/notifications/?user_id=${uid}&limit=${limit}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as Notification[];
    }
  } catch {}
  return loadLocal().slice(0, limit);
}

export async function addNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random() * 900000 + 100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };

  // Optimistic local save
  const list = loadLocal();
  saveLocal([payload, ...list]);
  try { if (!opts?.silent) playNotificationSound(); } catch {}

  // Sync to backend (best effort)
  try {
    const uid = getCurrentUserId();
    const user_name = getActorName();
    djangoRequest("/notifications/", {
      method: "POST",
      body: JSON.stringify({
        id: payload.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: payload.read,
        created_at: payload.created_at,
        user_id: uid ?? null,
        user_name,
      }),
    }).catch(() => {});
  } catch {}

  return payload;
}

export async function addUserNotification(
  userId: string,
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random() * 900000 + 100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };

  try { if (!opts?.silent) playNotificationSound(); } catch {}

  // Sync to backend
  try {
    djangoRequest("/notifications/", {
      method: "POST",
      body: JSON.stringify({
        id: payload.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: payload.read,
        created_at: payload.created_at,
        user_id: userId,
        user_name: getActorName(),
      }),
    }).catch(() => {});
  } catch {}

  return payload;
}

export async function addRoleNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  role: "admin" | "manager",
  opts?: { silent?: boolean }
): Promise<void> {
  const payload = {
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
    role,
    user_name: getActorName(),
  };

  try { if (!opts?.silent) playNotificationSound(); } catch {}

  // Optimistic local save
  const localNote: Notification = {
    id: `NTF-${Math.floor(Math.random() * 900000 + 100000)}`,
    ...input,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };
  saveLocal([localNote, ...loadLocal()]);

  // Sync to backend (best effort)
  try {
    djangoRequest("/notifications/role/", {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

export async function markAllRead(): Promise<void> {
  // Local update
  saveLocal(loadLocal().map(n => ({ ...n, read: true })));
  // Sync to backend
  try {
    const uid = getCurrentUserId();
    if (uid) {
      djangoRequest("/notifications/mark-all-read/", {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      }).catch(() => {});
    }
  } catch {}
}

export async function clearAllNotifications(): Promise<void> {
  saveLocal([]);
  try {
    const uid = getCurrentUserId();
    if (uid) {
      djangoRequest("/notifications/clear/", {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      }).catch(() => {});
    }
  } catch {}
}

// ── CRUD Activity Tracking ────────────────────────────────────────────────

export async function trackActivity(
  entity: EntityType,
  operation: CRUDOperation,
  details: {
    entityName?: string;
    entityId?: string | number;
    changes?: string[];
    oldValue?: string;
    newValue?: string;
  },
  opts: { silent?: boolean } = {}
): Promise<Notification> {
  const opLabels: Record<CRUDOperation, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    view: "Viewed",
  };
  const entLabels: Record<EntityType, string> = {
    asset: "Asset",
    property: "Property",
    user: "User",
    ticket: "Ticket",
    approval: "Approval",
    qr_code: "QR Code",
    report: "Report",
    audit: "Audit",
    setting: "Setting",
    house: "House",
    newsletter: "Newsletter",
    allocation: "Allocation",
    license: "License",
    department: "Department",
    scan: "Scan",
  };

  let message = "";
  if (details.entityName) {
    message = `${entLabels[entity]} "${details.entityName}" was ${operation}d`;
  } else if (details.entityId) {
    message = `${entLabels[entity]} #${details.entityId} was ${operation}d`;
  } else {
    message = `${entLabels[entity]} was ${operation}d`;
  }
  if (details.changes?.length) message += ` – Changes: ${details.changes.join(", ")}`;
  if (details.oldValue && details.newValue)
    message += ` (${details.oldValue} → ${details.newValue})`;
  const actorName = getActorName();
  if (actorName && operation !== "view") message += ` by ${actorName}`;

  return addNotification(
    { title: `${opLabels[operation]} ${entLabels[entity]}`, message, type: entity, read: false },
    opts
  );
}
