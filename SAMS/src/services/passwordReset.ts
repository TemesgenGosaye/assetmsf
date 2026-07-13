import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";
import { sendPasswordResetCodeEmail } from "@/services/email";

const PASSWORD_RESET_LOCAL_KEY = "password_reset_requests_local";
const LOCAL_USERS_KEY = "app_users_fallback";
export const PASSWORD_RESET_MAX_ATTEMPTS = 3;
export const PASSWORD_RESET_CODE_TTL_MINUTES = 10;
const PASSWORD_RESET_SESSION_MINUTES = 15;

type VerifyResult =
  | { status: "ok"; resetToken: string }
  | { status: "mismatch"; attemptsRemaining: number }
  | { status: "resend"; attemptsRemaining?: number; reason?: string };

type RequestResult = { delivered: boolean; maskedEmail: string | null; userFound: boolean };

type LocalResetEntry = {
  email: string;
  userId: string;
  userName: string;
  code: string | null;
  expiresAt: number;
  attempts: number;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  consumed?: boolean;
};

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cryptoUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadLocalResets(): Record<string, LocalResetEntry> {
  try {
    const raw = localStorage.getItem(PASSWORD_RESET_LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalResets(store: Record<string, LocalResetEntry>): void {
  try {
    localStorage.setItem(PASSWORD_RESET_LOCAL_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function loadLocalUsers(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: any[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function maskEmailAddress(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) return normalized.replace(/.(?=.*@)/g, "*");
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const maskedLocal =
    local.length <= 2
      ? `${local[0] || ""}***`
      : `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}`;
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return `${maskedLocal}@${domain}`;
  }
  const maskedDomain = `${domainParts[0][0]}***.${domainParts.slice(1).join(".")}`;
  return `${maskedLocal}@${maskedDomain}`;
}

export async function requestPasswordReset(email: string): Promise<RequestResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("EMAIL_REQUIRED");
  }

  if (isDemoMode()) {
    const users = loadLocalUsers();
    const user = users.find((u) => normalizeEmail(u.email || "") === normalized);
    const code = generateOtp();
    const ttl = PASSWORD_RESET_CODE_TTL_MINUTES;

    if (user) {
      const store = loadLocalResets();
      store[normalized] = {
        email: normalized,
        userId: user.id,
        userName: user.name || normalized,
        code,
        expiresAt: Date.now() + ttl * 60_000,
        attempts: 0,
        sessionToken: null,
        sessionExpiresAt: null,
        consumed: false,
      };
      saveLocalResets(store);
      await sendPasswordResetCodeEmail({
        userName: store[normalized].userName,
        userEmail: normalized,
        code,
        expiresInMinutes: ttl,
        attemptsAllowed: PASSWORD_RESET_MAX_ATTEMPTS,
      });
      return { delivered: true, maskedEmail: maskEmailAddress(normalized), userFound: true };
    }
    return { delivered: false, maskedEmail: maskEmailAddress(normalized), userFound: false };
  }

  // Use Django backend
  const response = await djangoRequest("/auth/password-reset/request/", {
    method: "POST",
    body: JSON.stringify({ email: normalized }),
  });

  if (response.success) {
    return { delivered: true, maskedEmail: maskEmailAddress(normalized), userFound: true };
  }
  
  // Handle specific error for email not found
  if (response.status === 404) {
    throw new Error("EMAIL_NOT_FOUND");
  }
  
  throw new Error(response.message || "Failed to request password reset");
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<VerifyResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("EMAIL_REQUIRED");
  if (!code) throw new Error("CODE_REQUIRED");

  if (isDemoMode()) {
    const store = loadLocalResets();
    const entry = store[normalized];
    if (!entry || entry.consumed) {
      return { status: "resend", reason: "missing" };
    }
    if (!entry.code || entry.expiresAt <= Date.now()) {
      entry.code = null;
      entry.expiresAt = 0;
      saveLocalResets(store);
      return { status: "resend", reason: "expired" };
    }
    if (entry.code === code) {
      const token = entry.sessionToken || cryptoUuid();
      entry.sessionToken = token;
      entry.sessionExpiresAt = Date.now() + PASSWORD_RESET_SESSION_MINUTES * 60_000;
      entry.attempts = 0;
      saveLocalResets(store);
      return { status: "ok", resetToken: token };
    }
    entry.attempts += 1;
    if (entry.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      entry.code = null;
      entry.expiresAt = 0;
      entry.sessionToken = null;
      entry.sessionExpiresAt = null;
      entry.attempts = 0;
      saveLocalResets(store);
      return { status: "resend", attemptsRemaining: 0 };
    }
    saveLocalResets(store);
    return { status: "mismatch", attemptsRemaining: PASSWORD_RESET_MAX_ATTEMPTS - entry.attempts };
  }

  // For now just return ok with reset token
  return { status: "ok", resetToken: `${normalized}|${code}` };
}

export async function completePasswordReset(resetToken: string, newPassword: string): Promise<boolean> {
  if (!resetToken) throw new Error("RESET_TOKEN_REQUIRED");
  if (!newPassword || newPassword.trim().length < 6) throw new Error("PASSWORD_TOO_SHORT");

  if (isDemoMode()) {
    const store = loadLocalResets();
    const key = Object.keys(store).find((k) => {
      const entry = store[k];
      return (
        entry &&
        entry.sessionToken === resetToken &&
        entry.sessionExpiresAt !== null &&
        entry.sessionExpiresAt >= Date.now() &&
        !entry.consumed
      );
    });
    if (!key) {
      throw new Error("INVALID_OR_EXPIRED_TOKEN");
    }
    const entry = store[key];
    const users = loadLocalUsers();
    const idx = users.findIndex((u) => normalizeEmail(u.email || "") === entry.email);
    if (idx === -1) {
      throw new Error("USER_NOT_FOUND");
    }
    users[idx].must_change_password = false;
    saveLocalUsers(users);

    entry.consumed = true;
    entry.code = null;
    entry.expiresAt = 0;
    entry.sessionToken = null;
    entry.sessionExpiresAt = null;
    entry.attempts = 0;
    store[key] = entry;
    saveLocalResets(store);
    return true;
  }

  // Use Django backend
  const [email, code] = resetToken.split("|");
  const response = await djangoRequest("/auth/password-reset/verify/", {
    method: "POST",
    body: JSON.stringify({
      email,
      otp: code,
      new_password: newPassword,
    }),
  });

  if (response.success) {
    return true;
  }
  throw new Error(response.message || "Password reset failed");
}

export type PasswordResetVerifyResult = VerifyResult;
export type PasswordResetRequestResult = RequestResult;
