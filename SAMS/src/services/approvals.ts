/**
 * Approvals service – talks to Django REST /api/approvals/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { updateAsset } from "@/services/assets";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import {
  sendApprovalSubmittedEmail,
  sendApprovalForwardedEmail,
  sendApprovalDecisionEmail,
  getManagerEmails,
  getAdminEmails,
} from "@/services/email";
import { djangoRequest } from "./djangoAuth";

export type ApprovalAction = "create" | "edit" | "decommission";
export type ApprovalStatus =
  | "pending_manager"
  | "pending_admin"
  | "approved"
  | "rejected";

export type ApprovalRequest = {
  id: string;
  assetId: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  patch?: Record<string, any> | null;
  department?: string | null;
};

export type ApprovalEvent = {
  id: string;
  approvalId: string;
  eventType: string;
  message?: string | null;
  author?: string | null;
  createdAt: string;
};

const LS_KEY = "approvals";
const EV_LS_KEY = "approval_events";
const APPROVAL_CACHE_PREFIX = "approvals:list";
const APPROVAL_CACHE_TTL = 30_000;

// ── Local storage helpers ──────────────────────────────────────────────────

function loadLocal(): ApprovalRequest[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list: ApprovalRequest[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}
function loadLocalEvents(): ApprovalEvent[] {
  try { return JSON.parse(localStorage.getItem(EV_LS_KEY) || "[]"); } catch { return []; }
}
function saveLocalEvents(list: ApprovalEvent[]) {
  try { localStorage.setItem(EV_LS_KEY, JSON.stringify(list)); } catch {}
}

// ── Mappers ────────────────────────────────────────────────────────────────

function fromDjango(row: any): ApprovalRequest {
  return {
    id: row.id,
    assetId: row.asset_id,
    action: row.action,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    notes: row.notes ?? null,
    patch: row.patch ?? null,
    department: row.department ?? null,
  };
}

function toDjango(input: Partial<ApprovalRequest>): any {
  const row: any = {};
  if ("id" in input) row.id = input.id;
  if ("assetId" in input) row.asset_id = input.assetId;
  if ("action" in input) row.action = input.action;
  if ("status" in input) row.status = input.status;
  if ("requestedBy" in input) row.requested_by = input.requestedBy;
  if ("requestedAt" in input) row.requested_at = input.requestedAt;
  if ("reviewedBy" in input) row.reviewed_by = input.reviewedBy ?? null;
  if ("reviewedAt" in input) row.reviewed_at = input.reviewedAt ?? null;
  if ("notes" in input) row.notes = input.notes ?? null;
  if ("patch" in input) row.patch = input.patch ?? null;
  if ("department" in input) row.department = input.department ?? null;
  return row;
}

function cacheKey(
  status?: ApprovalStatus,
  department?: string | null,
  requestedBy?: string | null,
  assetIds?: string[] | null
): string {
  return `${APPROVAL_CACHE_PREFIX}:${[
    status || "all",
    (department || "").toLowerCase() || "all",
    (requestedBy || "").toLowerCase() || "all",
    assetIds?.length ? assetIds.map(String).sort().join(",") : "all",
  ].join("|")}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function resyncApprovalDepartments(): Promise<{
  updated: number;
  total: number;
  errors: number;
}> {
  try {
    const res = await djangoRequest<any>("/approvals/resync-departments/", {
      method: "POST",
    });
    if (res.success) return res.data;
  } catch {}
  return { updated: 0, total: 0, errors: 0 };
}

export async function listApprovals(
  status?: ApprovalStatus,
  department?: string | null,
  requestedBy?: string | null,
  assetIds?: string[] | null,
  options?: { force?: boolean }
): Promise<ApprovalRequest[]> {
  const key = cacheKey(status, department, requestedBy, assetIds);
  try {
    return await getCachedValue(
      key,
      async () => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (department) params.set("department", department);
        if (requestedBy) params.set("requested_by", requestedBy);
        if (assetIds?.length) params.set("asset_ids", assetIds.join(","));
        params.set("page_size", "500");
        const res = await djangoRequest<any>(`/approvals/?${params.toString()}`);
        if (res.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          return raw.map(fromDjango);
        }
        throw new Error(res.message || "Failed to fetch approvals");
      },
      { ttlMs: APPROVAL_CACHE_TTL, force: options?.force }
    );
  } catch {
    let out = loadLocal();
    if (status) out = out.filter(a => a.status === status);
    if (department) out = out.filter(a => (a.department || "").toLowerCase() === department.toLowerCase());
    if (requestedBy) out = out.filter(a => (a.requestedBy || "").toLowerCase() === requestedBy.toLowerCase());
    if (assetIds?.length) {
      const set = new Set(assetIds.map(x => String(x).toLowerCase()));
      out = out.filter(a => set.has(String(a.assetId).toLowerCase()));
    }
    return out;
  }
}

export async function submitApproval(
  input: Omit<ApprovalRequest, "id" | "status" | "requestedAt" | "reviewedBy" | "reviewedAt">
): Promise<ApprovalRequest> {
  // Resolve department from auth
  let dept: string | null = null;
  try {
    const raw =
      (isDemoMode()
        ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
        : null) || localStorage.getItem("auth_user");
    if (raw) { const u = JSON.parse(raw); dept = u?.department || null; }
  } catch {}

  const payload: ApprovalRequest = {
    id: `APR-${Math.floor(Math.random() * 900000 + 100000)}`,
    assetId: input.assetId,
    action: input.action,
    status: "pending_manager",
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    notes: input.notes ?? null,
    patch: input.patch ?? null,
    department: input.department ?? dept,
  };

  // Optimistic local save
  saveLocal([payload, ...loadLocal()]);
  invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);

  // Sync to backend
  try {
    const res = await djangoRequest<any>("/approvals/", {
      method: "POST",
      body: JSON.stringify(toDjango(payload)),
    });
    if (res.success) {
      const created = fromDjango(res.data);
      // Replace local optimistic entry with server response
      const list = loadLocal();
      saveLocal([created, ...list.filter(a => a.id !== payload.id)]);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);

      // Send email notification
      try {
        const managerEmails = await getManagerEmails(created.department ?? undefined);
        if (managerEmails.length) {
          let requesterName = created.requestedBy;
          try {
            const raw = localStorage.getItem("auth_user");
            if (raw) { const u = JSON.parse(raw); requesterName = u?.name || u?.email || requesterName; }
          } catch {}
          await sendApprovalSubmittedEmail({
            approvalId: created.id,
            requesterName,
            assetName: `Asset ${created.assetId}`,
            action: created.action,
            notes: created.notes ?? undefined,
            managersToNotify: managerEmails,
          });
        }
      } catch {}
      return created;
    }
  } catch {}

  return payload;
}

export async function forwardApprovalToAdmin(
  id: string,
  manager: string,
  notes?: string
): Promise<ApprovalRequest | null> {
  const patch = {
    status: "pending_admin" as ApprovalStatus,
    reviewedBy: manager,
    reviewedAt: new Date().toISOString(),
    notes: notes ?? null,
  };

  // Optimistic
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    saveLocal(list);
  }
  invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);

  try {
    const res = await djangoRequest<any>(`/approvals/${id}/forward/`, {
      method: "POST",
      body: JSON.stringify({ manager, notes }),
    });
    if (res.success) {
      const updated = fromDjango(res.data);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      // Email admins
      try {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length) {
          let managerName = manager;
          try {
            const raw = localStorage.getItem("auth_user");
            if (raw) { const u = JSON.parse(raw); managerName = u?.name || u?.email || manager; }
          } catch {}
          await sendApprovalForwardedEmail({
            approvalId: updated.id,
            managerName,
            assetName: `Asset ${updated.assetId}`,
            action: updated.action,
            notes: notes ?? undefined,
            adminsToNotify: adminEmails,
          });
        }
      } catch {}
      return updated;
    }
  } catch {}

  return idx >= 0 ? list[idx] : null;
}

export async function decideApprovalFinal(
  id: string,
  decision: Exclude<ApprovalStatus, "pending_manager" | "pending_admin">,
  admin: string,
  notes?: string
): Promise<ApprovalRequest | null> {
  const patch = {
    status: decision,
    reviewedBy: admin,
    reviewedAt: new Date().toISOString(),
    notes: notes ?? null,
  };

  // Optimistic
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch } as ApprovalRequest;
    saveLocal(list);
  }
  invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);

  try {
    const res = await djangoRequest<any>(`/approvals/${id}/decide/`, {
      method: "POST",
      body: JSON.stringify({ decision, admin, notes }),
    });
    if (res.success) {
      const updated = fromDjango(res.data);
      // Apply patch to asset if approved edit
      if (decision === "approved" && updated.action === "edit" && updated.patch && Object.keys(updated.patch).length) {
        try { await updateAsset(updated.assetId, updated.patch as any); } catch {}
      }
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      // Email requester
      try {
        let adminName = admin;
        try {
          const raw = localStorage.getItem("auth_user");
          if (raw) { const u = JSON.parse(raw); adminName = u?.name || u?.email || admin; }
        } catch {}
        await sendApprovalDecisionEmail({
          approvalId: updated.id,
          approverName: adminName,
          requesterEmail: updated.requestedBy,
          assetName: `Asset ${updated.assetId}`,
          action: updated.action,
          decision: decision === "approved" ? "approved" : "rejected",
          notes: notes ?? undefined,
          department: updated.department,
        });
      } catch {}
      return updated;
    }
  } catch {}

  return idx >= 0 ? list[idx] : null;
}

export async function adminOverrideApprove(
  id: string,
  admin: string,
  notes?: string
): Promise<ApprovalRequest | null> {
  const msg = notes?.trim() || "admin approved without level 1 approval";
  return decideApprovalFinal(id, "approved", admin, msg);
}

export async function updateApprovalPatch(
  id: string,
  manager: string,
  patchData: Record<string, any>
): Promise<ApprovalRequest | null> {
  // Optimistic
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], patch: patchData };
    saveLocal(list);
  }
  invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);

  try {
    const res = await djangoRequest<any>(`/approvals/${id}/patch/`, {
      method: "PATCH",
      body: JSON.stringify({ manager, patch: patchData }),
    });
    if (res.success) {
      const updated = fromDjango(res.data);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      return updated;
    }
  } catch {}

  return idx >= 0 ? list[idx] : null;
}

export async function listApprovalEvents(
  approvalId: string
): Promise<ApprovalEvent[]> {
  try {
    const res = await djangoRequest<any>(`/approvals/${approvalId}/events/`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const remote: ApprovalEvent[] = raw.map((ev: any) => ({
        id: ev.id,
        approvalId: ev.approval_id,
        eventType: ev.event_type,
        message: ev.message ?? null,
        author: ev.author ?? null,
        createdAt: ev.created_at,
      }));
      // Merge with any local events
      const local = loadLocalEvents().filter(ev => ev.approvalId === approvalId);
      const all = [...remote];
      for (const le of local) {
        if (!all.find(r => r.id === le.id)) all.push(le);
      }
      return all.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    }
  } catch {}
  return loadLocalEvents()
    .filter(ev => ev.approvalId === approvalId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export async function addApprovalComment(
  approvalId: string,
  author: string,
  field: string,
  message: string
): Promise<void> {
  const msg = `${field}: ${message}`;
  const ev: ApprovalEvent = {
    id: `AEV-${Math.floor(Math.random() * 900000 + 100000)}`,
    approvalId,
    eventType: "comment",
    author,
    message: msg,
    createdAt: new Date().toISOString(),
  };
  // Local save
  saveLocalEvents([...loadLocalEvents(), ev]);

  // Backend (best effort)
  try {
    djangoRequest(`/approvals/${approvalId}/events/`, {
      method: "POST",
      body: JSON.stringify({ event_type: "comment", author, message: msg }),
    }).catch(() => {});
  } catch {}
}
