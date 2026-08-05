/**
 * Final Approver service – talks to Django REST /api/final-approvers/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";

export type FinalApprover = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

const LS_KEY = "final_approvers_map"; // { [property_id]: { user_id, user_name } }

function readLocal(): Record<string, { user_id: string; user_name?: string | null }> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, { user_id: string; user_name?: string | null }>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function getFinalApprover(propertyId: string): Promise<FinalApprover | null> {
  if (!propertyId) return null;
  try {
    const res = await djangoRequest<any>(`/final-approvers/${propertyId}/`);
    if (res.success && res.data) {
      const fa = { property_id: res.data.property_id, user_id: res.data.user_id, user_name: res.data.user_name ?? null };
      const map = readLocal();
      map[propertyId] = { user_id: fa.user_id, user_name: fa.user_name };
      writeLocal(map);
      return fa;
    }
  } catch {}
  const map = readLocal();
  const v = map[propertyId];
  return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
}

export async function listFinalApproverPropsForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const res = await djangoRequest<any>(`/final-approvers/?user_id=${userId}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const ids = raw.map((r: any) => String(r.property_id));
      // Mirror to local
      const map = readLocal();
      ids.forEach((pid: string) => {
        const row = raw.find((r: any) => r.property_id === pid);
        if (row) map[pid] = { user_id: userId, user_name: row.user_name ?? null };
      });
      writeLocal(map);
      return ids;
    }
  } catch {}
  const map = readLocal();
  return Object.entries(map).filter(([, v]) => String(v.user_id) === String(userId)).map(([pid]) => pid);
}

export async function listFinalApproverPropsForEmail(email: string): Promise<string[]> {
  const em = (email || "").trim();
  if (!em) return [];
  try {
    const res = await djangoRequest<any>(`/final-approvers/?email=${encodeURIComponent(em)}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw.map((r: any) => String(r.property_id));
    }
  } catch {}
  return [];
}

export async function setFinalApproverForProperty(
  propertyId: string,
  userId: string,
  userName?: string | null
): Promise<void> {
  if (!propertyId || !userId) return;
  // Optimistic local save
  const map = readLocal();
  map[propertyId] = { user_id: userId, user_name: userName ?? null };
  writeLocal(map);
  try {
    await djangoRequest("/final-approvers/", {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, user_id: userId, user_name: userName ?? null }),
    });
  } catch {}
}

export async function setFinalApproverPropsForUser(
  userId: string,
  userName: string | null,
  propertyIds: string[]
): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  // Optimistic local
  const map = readLocal();
  // Remove old assignments for this user not in new list
  Object.keys(map).forEach(pid => {
    if (String(map[pid].user_id) === String(userId) && !uniq.includes(pid)) delete map[pid];
  });
  uniq.forEach(pid => { map[pid] = { user_id: userId, user_name: userName ?? map[pid]?.user_name ?? null }; });
  writeLocal(map);
  try {
    await djangoRequest("/final-approvers/set/", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, user_name: userName, property_ids: uniq }),
    });
  } catch {}
}

export async function setFinalApproverPropsForEmail(
  email: string,
  userName: string | null,
  propertyIds: string[]
): Promise<void> {
  const em = (email || "").trim();
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  if (!em) return;
  try {
    await djangoRequest("/final-approvers/set-by-email/", {
      method: "POST",
      body: JSON.stringify({ email: em, user_name: userName, property_ids: uniq }),
    });
  } catch {}
}

export async function isFinalApprover(userId: string, propertyId: string): Promise<boolean> {
  if (!userId || !propertyId) return false;
  const list = await listFinalApproverPropsForUser(userId);
  return list.includes(String(propertyId));
}
