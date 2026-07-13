/**
 * User Access service – talks to Django REST /api/user-access/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";
import { listUserPermissions } from "./permissions";

const LS_KEY = "user_access"; // { [userId: string]: string[] }
const CURRENT_USER_KEY = "current_user_id";

export type UserPropertyAccess = {
  id: string;
  user_id: string;
  property_id: string;
  created_at?: string;
};

function readLocal(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(data: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

export async function listUserPropertyAccess(userId: string): Promise<string[]> {
  if (!userId) return [];

  // Try backend
  try {
    const res = await djangoRequest<any>(`/user-access/?user_id=${userId}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const ids: string[] = raw.map((r: any) => String(r.property_id));
      // Mirror to local
      const map = readLocal();
      map[userId] = ids;
      writeLocal(map);
      return ids;
    }
  } catch {}

  // Fallback to local
  const map = readLocal();
  return map[userId] || [];
}

export async function setUserPropertyAccess(
  userId: string,
  propertyIds: string[]
): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set(propertyIds));

  // Optimistic local update
  const map = readLocal();
  map[userId] = uniq;
  writeLocal(map);

  // Sync to backend
  try {
    await djangoRequest(`/user-access/set/`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, property_ids: uniq }),
    });
  } catch {
    // Local already saved
  }
}

export async function grantUserProperty(
  userId: string,
  propertyId: string
): Promise<void> {
  if (!userId || !propertyId) return;
  const current = await listUserPropertyAccess(userId);
  const next = Array.from(new Set([...current, propertyId]));
  await setUserPropertyAccess(userId, next);
}

export async function revokeUserProperty(
  userId: string,
  propertyId: string
): Promise<void> {
  if (!userId || !propertyId) return;
  const current = await listUserPropertyAccess(userId);
  await setUserPropertyAccess(userId, current.filter(p => p !== propertyId));
}

export async function getAccessiblePropertyIdsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem(CURRENT_USER_KEY);
    if (!uid) return new Set();

    // Check for "all_properties" permission
    const perms = await listUserPermissions(uid);
    if (perms.all_properties?.v || perms.all_properties?.e) {
      // Fetch all active property IDs
      try {
        const res = await djangoRequest<any>("/properties/?status=active&page_size=500");
        if (res.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          return new Set(raw.map((p: any) => String(p.id)));
        }
      } catch {}
    }

    const props = await listUserPropertyAccess(uid);
    return new Set(props);
  } catch {
    return new Set();
  }
}

export function setCurrentUserIdLocal(userId: string | null) {
  try {
    if (userId) localStorage.setItem(CURRENT_USER_KEY, userId);
    else localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}
