/**
 * Activity service – talks to Django REST /api/activity/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";

export type Activity = {
  id: number;
  type: string;
  message: string;
  user_name: string | null;
  created_at: string;
};

const DEMO_LS_KEY = "demo_recent_activity";
const LOCAL_LS_KEY = "recent_activity_local";

// ── Demo helpers ──────────────────────────────────────────────────────────

function loadDemoActivity(): Activity[] {
  try {
    const raw = localStorage.getItem(DEMO_LS_KEY);
    const parsed: Activity[] = raw ? JSON.parse(raw) : [];
    if (parsed.length > 0) return parsed;
    const now = new Date();
    const base: Activity[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      type: ["system", "asset_created", "qr_generated", "report"][i % 4],
      message:
        i % 4 === 1
          ? `Created demo asset AST-${100 + i}`
          : i % 4 === 2
          ? `Generated QR codes for Property ${((i % 5) + 1).toString().padStart(3, "0")}`
          : i % 4 === 3
          ? "Report export completed"
          : "Welcome to SAMS Demo",
      user_name: i % 3 === 0 ? "Admin" : i % 3 === 1 ? "Manager" : "System",
      created_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + i, (i * 7) % 60).toISOString(),
    }));
    saveDemoActivity(base);
    return base;
  } catch {
    return [];
  }
}

function saveDemoActivity(list: Activity[]) {
  try { localStorage.setItem(DEMO_LS_KEY, JSON.stringify(list)); } catch {}
}

// ── Local fallback helpers ─────────────────────────────────────────────────

function loadLocal(): Activity[] {
  try {
    const raw = localStorage.getItem(LOCAL_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(list: Activity[]) {
  try { localStorage.setItem(LOCAL_LS_KEY, JSON.stringify(list.slice(0, 200))); } catch {}
}

// ── API ───────────────────────────────────────────────────────────────────

export async function listActivity(limit = 20): Promise<Activity[]> {
  if (isDemoMode()) {
    return loadDemoActivity()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }
  try {
    const uid = getCurrentUserId();
    const qs = uid ? `?user_id=${uid}&limit=${limit}` : `?limit=${limit}`;
    const res = await djangoRequest<any>(`/activity/${qs}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as Activity[];
    }
  } catch {}
  // Local fallback
  return loadLocal().slice(0, limit);
}

export async function logActivity(
  type: string,
  message: string,
  user_name?: string | null
) {
  let derivedName: string | null = null;
  try {
    const raw =
      (isDemoMode()
        ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
        : null) || localStorage.getItem("auth_user");
    if (raw) {
      const u = JSON.parse(raw);
      derivedName = u?.name || u?.email || u?.id || null;
    }
  } catch {}

  const actorName = user_name ?? derivedName;

  if (isDemoMode()) {
    const list = loadDemoActivity();
    const next: Activity = {
      id: (list[0]?.id ?? 0) + 1,
      type,
      message,
      user_name: actorName ?? null,
      created_at: new Date().toISOString(),
    };
    saveDemoActivity([next, ...list]);
    return;
  }

  // Optimistic local save
  const local = loadLocal();
  const entry: Activity = {
    id: Date.now(),
    type,
    message,
    user_name: actorName ?? null,
    created_at: new Date().toISOString(),
  };
  saveLocal([entry, ...local]);

  // Sync to backend (best effort, non-blocking)
  try {
    const uid = getCurrentUserId();
    djangoRequest("/activity/", {
      method: "POST",
      body: JSON.stringify({
        type,
        message,
        user_name: actorName ?? null,
        user_id: uid ?? null,
      }),
    }).catch(() => {});
  } catch {}
}

// No realtime subscription without Supabase — return no-op unsubscribe
export function subscribeActivity(_onInsert: (a: Activity) => void) {
  return () => {};
}
