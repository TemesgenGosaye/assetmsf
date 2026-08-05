/**
 * Settings service – talks to Django REST /api/settings/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";

export type SystemSettings = {
  id: boolean;
  timezone: string | null;
  language: string | null;
  backup_frequency: "hourly" | "daily" | "weekly" | "monthly" | string | null;
  auto_backup: boolean | null;
  appearance: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  notifications: boolean | null;
  email_notifications: boolean | null;
  notification_types: Record<string, any> | null;
  dark_mode: boolean | null;
  dashboard_prefs: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

const SYS_LS_KEY = "system_settings_local";
const USER_LS_KEY = "user_settings_";

function sysDefaults(): SystemSettings {
  return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {} };
}

function userDefaults(userId: string): UserSettings {
  return {
    id: userId, user_id: userId, notifications: true, email_notifications: true,
    notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true },
    dark_mode: false, dashboard_prefs: {},
  };
}

// ── System Settings ────────────────────────────────────────────────────────

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const res = await djangoRequest<any>("/settings/system/");
    if (res.success && res.data) {
      try { localStorage.setItem(SYS_LS_KEY, JSON.stringify(res.data)); } catch {}
      return res.data as SystemSettings;
    }
  } catch {}
  try {
    const raw = localStorage.getItem(SYS_LS_KEY);
    if (raw) return JSON.parse(raw) as SystemSettings;
  } catch {}
  return sysDefaults();
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  try {
    const res = await djangoRequest<any>("/settings/system/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (res.success && res.data) {
      try { localStorage.setItem(SYS_LS_KEY, JSON.stringify(res.data)); } catch {}
      return res.data as SystemSettings;
    }
  } catch {}
  // Local fallback
  const cur = await getSystemSettings();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(SYS_LS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ── User Settings ──────────────────────────────────────────────────────────

export async function getUserSettings(userId: string): Promise<UserSettings> {
  try {
    const res = await djangoRequest<any>(`/settings/user/${userId}/`);
    if (res.success && res.data) {
      try { localStorage.setItem(USER_LS_KEY + userId, JSON.stringify(res.data)); } catch {}
      return res.data as UserSettings;
    }
  } catch {}
  try {
    const raw = localStorage.getItem(USER_LS_KEY + userId);
    if (raw) return JSON.parse(raw) as UserSettings;
  } catch {}
  return userDefaults(userId);
}

export async function upsertUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  // Optimistic local save
  const cur = await getUserSettings(userId);
  const next = { ...cur, ...patch, user_id: userId };
  try { localStorage.setItem(USER_LS_KEY + userId, JSON.stringify(next)); } catch {}
  // Sync to backend
  try {
    const res = await djangoRequest<any>(`/settings/user/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (res.success && res.data) {
      try { localStorage.setItem(USER_LS_KEY + userId, JSON.stringify(res.data)); } catch {}
      return res.data as UserSettings;
    }
  } catch {}
  return next;
}
