/**
 * User Preferences service – talks to Django REST /api/preferences/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";

export type UserPreferences = {
  user_id: string;
  user_email?: string | null;
  show_newsletter: boolean;
  show_help_center?: boolean;
  compact_mode: boolean;
  enable_beta_features: boolean;
  default_landing_page: string | null;
  feature_flags: Record<string, any>;
  sidebar_collapsed?: boolean;
  enable_sounds?: boolean;
  density?: "comfortable" | "compact" | "ultra";
  auto_theme?: boolean;
  show_announcements?: boolean;
  sticky_header?: boolean;
  top_nav_mode?: boolean;
  created_at?: string;
  updated_at?: string;
};

const LS_KEY = "user_preferences_";

function loadLocal(userId: string): UserPreferences | null {
  try { return JSON.parse(localStorage.getItem(LS_KEY + userId) || "null"); } catch { return null; }
}
function saveLocal(p: UserPreferences) {
  try { localStorage.setItem(LS_KEY + p.user_id, JSON.stringify(p)); } catch {}
}

function defaults(userId: string): UserPreferences {
  return {
    user_id: userId,
    user_email: null,
    show_newsletter: false,
    show_help_center: true,
    compact_mode: false,
    enable_beta_features: false,
    default_landing_page: null,
    feature_flags: {},
    sidebar_collapsed: false,
    enable_sounds: true,
    density: "comfortable",
    auto_theme: false,
    show_announcements: true,
    sticky_header: false,
    top_nav_mode: false,
  };
}

function applyDefaults(p: UserPreferences): UserPreferences {
  const d = defaults(p.user_id);
  return { ...d, ...p };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  if (!userId) return defaults("local");

  try {
    const res = await djangoRequest<any>(`/preferences/${userId}/`);
    if (res.success && res.data) {
      const prefs = applyDefaults(res.data as UserPreferences);
      saveLocal(prefs);
      return prefs;
    }
  } catch {}

  const local = loadLocal(userId);
  if (local) return applyDefaults(local);
  return defaults(userId);
}

export async function upsertUserPreferences(
  userId: string,
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  // Optimistic local save
  const cur = loadLocal(userId) || defaults(userId);
  const next = applyDefaults({ ...cur, ...patch, user_id: userId });
  saveLocal(next);

  // Sync to backend (non-blocking)
  if (!isDemoMode()) {
    try {
      djangoRequest(`/preferences/${userId}/`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).catch(() => {});
    } catch {}
  }

  return next;
}

export function peekCachedUserPreferences(userId?: string | null): UserPreferences | null {
  if (!userId) return null;
  const cached = loadLocal(userId);
  return cached ? applyDefaults(cached) : null;
}
