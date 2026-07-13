import { isDemoMode, getDemoUsers } from "@/lib/demo";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import { djangoRequest } from "./djangoAuth";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  last_login: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
  password_changed_at?: string | null;
  active_session_id?: string | null;
  password_hash?: string | null;
};

const USERS_CACHE_KEY = "users:list";
const USERS_CACHE_TTL = 30_000;

// Helper to convert Django user to frontend AppUser
function djangoUserToFrontend(row: any): AppUser {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    phone: row.phone,
    last_login: row.updated_at, // backend doesn't have last_login? Let's use updated_at for now
    status: row.status,
    avatar_url: row.profile_image,
  };
}

// Helper to convert frontend AppUser to Django payload
function frontendUserToDjango(user: Partial<AppUser>): any {
  const row: any = {};
  if ("name" in user) row.name = user.name;
  if ("email" in user) row.email = user.email;
  if ("role" in user) row.role = user.role;
  if ("department" in user) row.department = user.department;
  if ("phone" in user) row.phone = user.phone;
  if ("status" in user) row.status = user.status;
  return row;
}

export async function listUsers(options?: { force?: boolean }): Promise<AppUser[]> {
  if (isDemoMode()) return getDemoUsers() as any;
  return getCachedValue(
    USERS_CACHE_KEY,
    async () => {
      const response = await djangoRequest<any[]>('/auth/users/');
      if (response.success) {
        return (response.data || []).map(djangoUserToFrontend);
      }
      return [];
    },
    { ttlMs: USERS_CACHE_TTL, force: options?.force }
  );
}

// Optionally accept a password for local fallback; DB uses auth for real password handling
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const djangoPayload = {
    ...frontendUserToDjango(payload),
    password: payload.password,
    password_confirm: payload.password,
  };
  const response = await djangoRequest<any>('/auth/users/', {
    method: 'POST',
    body: JSON.stringify(djangoPayload),
  });
  if (response.success) {
    invalidateCacheByPrefix(USERS_CACHE_KEY);
    return djangoUserToFrontend(response.data);
  }
  throw new Error(response.message || "Failed to create user");
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const djangoPayload = frontendUserToDjango(patch);
  const response = await djangoRequest<any>(`/auth/users/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(djangoPayload),
  });
  if (response.success) {
    invalidateCacheByPrefix(USERS_CACHE_KEY);
    return djangoUserToFrontend(response.data);
  }
  throw new Error(response.message || "Failed to update user");
}

export async function deleteUser(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const response = await djangoRequest<void>(`/auth/users/${id}/`, {
    method: 'DELETE',
  });
  if (response.success) {
    invalidateCacheByPrefix(USERS_CACHE_KEY);
    return;
  }
  throw new Error(response.message || "Failed to delete user");
}

export async function getUser(id: string): Promise<AppUser> {
  if (isDemoMode()) {
    const list = getDemoUsers();
    const found = list.find(u => String(u.id) === id);
    if (!found) throw new Error("User not found");
    return found as any;
  }
  const response = await djangoRequest<any>(`/auth/users/${id}/`);
  if (response.success) return djangoUserToFrontend(response.data);
  throw new Error(response.message || "Failed to fetch user");
}

