/**
 * Permissions service – talks to Django REST /api/permissions/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";

export type PageKey =
  | "assets"
  | "properties"
  | "residential_hub"
  | "houses"
  | "qrcodes"
  | "users"
  | "reports"
  | "settings"
  | "audit"
  | "all_properties"
  | "all_departments"
  | "employees";

export type UserPermission = {
  id?: string;
  user_id: string;
  page: PageKey;
  can_view: boolean;
  can_edit: boolean;
};

const LS_KEY = "user_permissions";
const CURRENT_USER_KEY = "current_user_id";

type LocalPermMap = Record<string, Record<PageKey, { v: boolean; e: boolean }>>;

function readLocal(): LocalPermMap {
  try {
    const key = isDemoMode() ? "demo_user_permissions" : LS_KEY;
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(data: LocalPermMap) {
  try {
    const key = isDemoMode() ? "demo_user_permissions" : LS_KEY;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function getCurrentUserId(): string | null {
  try {
    const key = isDemoMode() ? "demo_current_user_id" : CURRENT_USER_KEY;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function listUserPermissions(
  userId: string
): Promise<Record<PageKey, { v: boolean; e: boolean }>> {
  if (!userId) return {} as any;

  // Always check local first for quick reads
  const localAll = readLocal();
  const local = (localAll[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;

  try {
    const res = await djangoRequest<any>(`/permissions/?user_id=${userId}`);
    if (res.success) {
      const rows: UserPermission[] = Array.isArray(res.data)
        ? res.data
        : (res.data?.results ?? []);
      const remote: Record<PageKey, { v: boolean; e: boolean }> = {} as any;
      rows.forEach((row: any) => {
        remote[row.page as PageKey] = {
          v: !!row.can_view,
          e: !!row.can_edit,
        };
      });
      // Merge remote with local (remote wins, local fills gaps)
      const merged: Record<PageKey, { v: boolean; e: boolean }> = { ...remote } as any;
      (Object.keys(local) as PageKey[]).forEach((p) => {
        if (!(p in merged)) merged[p] = local[p];
      });
      // Cache in local
      localAll[userId] = merged;
      writeLocal(localAll);
      return merged;
    }
  } catch {
    // Fall through to local
  }

  return local;
}

export async function setUserPermissions(
  userId: string,
  perms: Record<PageKey, { v?: boolean; e?: boolean }>
): Promise<void> {
  if (!userId) return;

  const rows = (Object.keys(perms) as PageKey[]).map((page) => ({
    page,
    can_view: !!perms[page].v,
    can_edit: !!perms[page].e,
  }));

  // Persist locally immediately (optimistic)
  const map = readLocal();
  const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
  rows.forEach((r) => {
    cur[r.page] = { v: r.can_view, e: r.can_edit };
  });
  map[userId] = cur;
  writeLocal(map);

  // Sync to backend (best effort)
  try {
    await djangoRequest(`/permissions/set/`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, permissions: rows }),
    });
  } catch {
    // Local already saved; backend will sync next time
  }
}

export async function canUserView(
  userId: string,
  page: PageKey
): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.v;
}

export async function canUserEdit(
  userId: string,
  page: PageKey
): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.e;
}

// ── Role-based defaults ────────────────────────────────────────────────────

// Normalize a raw role string into the lowercase role keys used by defaults
// and gates. SUPER_ADMIN (Django superusers) is treated as admin.
export function normalizeRole(roleRaw?: string): string {
  const r = (roleRaw || "").toLowerCase().replace(/[\s-]+/g, "_").trim();
  if (r === "super_admin" || r === "superadmin") return "admin";
  return r;
}

export function roleDefaults(
  roleRaw?: string
): Record<PageKey, { v: boolean; e: boolean }> {
  const role = normalizeRole(roleRaw);
  const base: Record<PageKey, { v: boolean; e: boolean }> = {
    assets: { v: false, e: false },
    properties: { v: false, e: false },
    residential_hub: { v: false, e: false },
    houses: { v: false, e: false },
    qrcodes: { v: false, e: false },
    users: { v: false, e: false },
    reports: { v: false, e: false },
    settings: { v: false, e: false },
    audit: { v: false, e: false },
    all_properties: { v: false, e: false },
    all_departments: { v: false, e: false },
    employees: { v: false, e: false },
  };

  if (role === "admin") {
    (Object.keys(base) as Array<keyof typeof base>).forEach((k) => {
      base[k] = { v: true, e: true };
    });
  } else if (role === "manager") {
    base.assets = { v: true, e: true };
    base.properties = { v: true, e: true };
    base.residential_hub = { v: true, e: true };
    base.houses = { v: true, e: false };
    base.qrcodes = { v: true, e: true };
    base.reports = { v: true, e: false };
    base.settings = { v: true, e: false };
    base.employees = { v: true, e: false };
  } else if (role === "requester") {
    base.houses = { v: true, e: false };
    base.residential_hub = { v: true, e: false };
    base.qrcodes = { v: true, e: true };
    base.settings = { v: true, e: false };
  } else {
    // default user
    base.assets = { v: true, e: true };
    base.residential_hub = { v: true, e: false };
    base.houses = { v: true, e: false };
    base.qrcodes = { v: true, e: true };
    base.settings = { v: true, e: false };
  }
  return base;
}

export function mergeDefaultsWithOverrides(
  roleRaw: string | undefined,
  overrides: Record<PageKey, { v: boolean; e: boolean }>
): Record<PageKey, { v: boolean; e: boolean }> {
  const d = roleDefaults(roleRaw);
  // Admins always have full page access; explicit per-page rows (including
  // stale can_view=false) can never downgrade them.
  if (normalizeRole(roleRaw) === "admin") return d;
  const out: Record<PageKey, { v: boolean; e: boolean }> = { ...d };
  (Object.keys(overrides) as PageKey[]).forEach((k) => {
    out[k] = {
      v: overrides[k].v ?? d[k].v,
      e: overrides[k].e ?? d[k].e,
    };
  });
  return out;
}
