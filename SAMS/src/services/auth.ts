import { API_BASE_URL, loginWithDjango, logoutFromDjango, type DjangoUser } from "./djangoAuth";

export type MinimalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
};

const LS_USERS_KEY = "app_users_fallback";
const HASH_VERSION_PREFIX = "v1$";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function legacyHash(password: string): string {
  if (!password) return "";
  try {
    return btoa(unescape(encodeURIComponent(password))).slice(0, 32);
  } catch {
    return "";
  }
}

const hexTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

function bufferToHex(buffer: ArrayBufferLike): string {
  const view = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += hexTable[view[i]];
  }
  return out;
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (typeof globalThis.crypto?.subtle === "undefined") return null;
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return bufferToHex(digest);
  } catch {
    return null;
  }
}

function randomSalt(size = 16): Uint8Array {
  const salt = new Uint8Array(size);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < salt.length; i += 1) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return salt;
}

export async function createPasswordHash(password: string): Promise<string | null> {
  if (!password) return null;
  const saltHex = bufferToHex(randomSalt().buffer);
  const digest = await sha256Hex(`${saltHex}::${password}`);
  if (!digest) {
    return legacyHash(password) || null;
  }
  return `${HASH_VERSION_PREFIX}${saltHex}$${digest}`;
}

function isModernHash(hash: string | null | undefined): boolean {
  return Boolean(hash && hash.startsWith(HASH_VERSION_PREFIX));
}

async function hashesMatch(password: string, storedHash: string): Promise<"match" | "legacy" | "nomatch"> {
  if (!storedHash) return "nomatch";
  if (isModernHash(storedHash)) {
    const [, saltHex, digest] = storedHash.split("$");
    if (!saltHex || !digest) return "nomatch";
    const computed = await sha256Hex(`${saltHex}::${password}`);
    if (!computed) {
      return legacyHash(password) === storedHash ? "legacy" : "nomatch";
    }
    return computed === digest ? "match" : "nomatch";
  }
  return legacyHash(password) === storedHash ? "legacy" : "nomatch";
}

function readLocalUsers(): any[] {
  try {
    const raw = localStorage.getItem(LS_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: any[]): void {
  try {
    localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  } catch {}
}

function sanitizeUser(row: any): MinimalUser | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: (row.email || "").toLowerCase(),
    role: row.role,
    department: row.department ?? null,
    phone: row.phone ?? null,
    status: row.status ?? "inactive",
    avatar_url: row.avatar_url ?? row.profile_image ?? null,
    must_change_password: row.must_change_password ?? false,
  };
}

function djangoUserToMinimal(dj: DjangoUser): MinimalUser {
  return {
    id: String(dj.id),
    name: dj.name,
    email: dj.email,
    role: dj.role,
    department: dj.department,
    phone: dj.phone,
    status: dj.status,
    avatar_url: dj.profile_image,
    must_change_password: false,
  };
}

export async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  const input = (identifier || "").trim().toLowerCase();
  if (!input) return null;
  if (input.includes("@")) return normalizeEmail(input);

  const token = localStorage.getItem("django_access_token");
  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users/?search=${encodeURIComponent(input)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const users = json?.data || json?.results || [];
      if (users.length === 0) return null;
      const active = users.find((u: any) => (u.status || "").toLowerCase() === "active");
      const target = active || users[0];
      return normalizeEmail((target.email || "").trim());
    } catch {
      return null;
    }
  }

  const users = readLocalUsers();
  const matches = users.filter((u) => {
    const email = (u?.email || "").toLowerCase();
    const local = email.split("@")[0] || "";
    return local === input;
  });
  if (matches.length === 0) return null;
  const active = matches.find((u) => (u?.status || "").toLowerCase() === "active");
  const target = active || matches[0];
  return normalizeEmail(target.email || "");
}

export async function loginWithPassword(email: string, password: string): Promise<MinimalUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;

  const djUser = await loginWithDjango(normalized, password);
  if (djUser) return djangoUserToMinimal(djUser);

  const localUsers = readLocalUsers();
  const local = localUsers.find((u) => normalizeEmail(u.email || "") === normalized);
  if (!local || !local.password_hash) return null;
  const outcome = await hashesMatch(password, local.password_hash);
  if (outcome === "nomatch") return null;
  return sanitizeUser(local);
}

export async function loginWithUsernameOrEmail(identifier: string, password: string): Promise<MinimalUser | null> {
  const email = await resolveIdentifierToEmail(identifier);
  if (!email) return null;
  return loginWithPassword(email, password);
}

export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  try {
    if (!password) return false;
    const token = localStorage.getItem("django_access_token");
    if (token) {
      const res = await fetch(`${API_BASE_URL}/auth/verify-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      return json?.success === true && json?.data?.valid === true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized || !currentPassword || !newPassword) throw new Error("Missing fields");

  const token = localStorage.getItem("django_access_token");
  if (token) {
    const res = await fetch(`${API_BASE_URL}/auth/change-password/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const json = await res.json();
    if (!json?.success) throw new Error(json?.message || "Failed to change password");
    return;
  }

  const users = readLocalUsers();
  const idx = users.findIndex((u) => normalizeEmail(u.email || "") === normalized);
  if (idx === -1) throw new Error("User not found");
  const hashed = await createPasswordHash(newPassword);
  if (!hashed) throw new Error("Invalid new password");
  users[idx].password_hash = hashed;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

export async function adminSetUserPassword(
  adminEmail: string,
  adminPassword: string,
  targetUserId: string,
  newPassword: string
): Promise<void> {
  if (!targetUserId || !newPassword) throw new Error("Missing fields");

  const token = localStorage.getItem("django_access_token");
  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: adminPassword }),
      });
      const verifyJson = await res.json();
      if (!verifyJson?.success || !verifyJson?.data?.valid) {
        throw new Error("Admin password verification failed");
      }
    } catch {
      throw new Error("Admin password verification failed");
    }

    const res = await fetch(`${API_BASE_URL}/auth/users/${targetUserId}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    const json = await res.json();
    if (!json?.success) throw new Error(json?.message || "Failed to set password");
    return;
  }

  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.id === targetUserId);
  if (idx === -1) throw new Error("User not found");
  const hashed = await createPasswordHash(newPassword);
  if (!hashed) throw new Error("Invalid new password");
  users[idx].password_hash = hashed;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

export async function logout(): Promise<void> {
  await logoutFromDjango();
  try {
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("auth_user");
  } catch {}
}

export async function updateLastLogin(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const token = localStorage.getItem("django_access_token");
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/me/update/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: normalized, last_login: new Date().toISOString() }),
      });
    } catch {}
    return;
  }

  const localUsers = readLocalUsers();
  const idx = localUsers.findIndex((u) => normalizeEmail(u.email || "") === normalized);
  if (idx === -1) return;
  localUsers[idx].last_login = new Date().toISOString();
  writeLocalUsers(localUsers);
}
