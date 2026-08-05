/**
 * Audit service – talks to Django REST /api/audit/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";
import { listAssets, type Asset } from "@/services/assets";
import { playNotificationSound } from "@/lib/sound";

export type AuditSession = {
  id: string;
  started_at: string;
  frequency_months: 1 | 3 | 6;
  initiated_by?: string | null;
  is_active: boolean;
  property_id?: string | null;
};

export type AuditAssignment = {
  session_id: string;
  department: string;
  status: "pending" | "submitted";
  submitted_at?: string | null;
  submitted_by?: string | null;
};

export type AuditReview = {
  session_id: string;
  asset_id: string;
  department: string;
  status: "verified" | "missing" | "damaged";
  comment?: string | null;
  updated_at?: string;
};

export type AuditReport = {
  id: string;
  session_id: string;
  generated_at: string;
  generated_by?: string | null;
  payload: any;
};

export type AuditIncharge = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

// ── Local storage helpers ──────────────────────────────────────────────────

const AI_LS_KEY = "audit_incharge_map";
const SESSIONS_LS_KEY = "audit_sessions_local";
const ASSIGNMENTS_LS_KEY = "audit_assignments_local";
const REVIEWS_LS_KEY = "audit_reviews_local";

function readLocalAI(): Record<string, { user_id: string; user_name?: string | null }> {
  try { return JSON.parse(localStorage.getItem(AI_LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocalAI(data: Record<string, { user_id: string; user_name?: string | null }>) {
  try { localStorage.setItem(AI_LS_KEY, JSON.stringify(data)); } catch {}
}
function readLocalSessions(): AuditSession[] {
  try { return JSON.parse(localStorage.getItem(SESSIONS_LS_KEY) || "[]"); } catch { return []; }
}
function writeLocalSessions(list: AuditSession[]) {
  try { localStorage.setItem(SESSIONS_LS_KEY, JSON.stringify(list)); } catch {}
}
function readLocalAssignments(): AuditAssignment[] {
  try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_LS_KEY) || "[]"); } catch { return []; }
}
function writeLocalAssignments(list: AuditAssignment[]) {
  try { localStorage.setItem(ASSIGNMENTS_LS_KEY, JSON.stringify(list)); } catch {}
}
function readLocalReviews(): AuditReview[] {
  try { return JSON.parse(localStorage.getItem(REVIEWS_LS_KEY) || "[]"); } catch { return []; }
}
function writeLocalReviews(list: AuditReview[]) {
  try { localStorage.setItem(REVIEWS_LS_KEY, JSON.stringify(list)); } catch {}
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function isAuditActive(): Promise<boolean> {
  try {
    const res = await djangoRequest<any>("/audit/sessions/?is_active=true&page_size=1");
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw.length > 0;
    }
  } catch {}
  return readLocalSessions().some(s => s.is_active);
}

export async function getActiveSession(): Promise<AuditSession | null> {
  try {
    const res = await djangoRequest<any>("/audit/sessions/?is_active=true&page_size=1");
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw[0] ?? null;
    }
  } catch {}
  return readLocalSessions().find(s => s.is_active) ?? null;
}

export async function startAuditSession(
  freq: 1 | 3 | 6,
  initiated_by?: string | null,
  property_id?: string | null
): Promise<AuditSession> {
  try {
    const res = await djangoRequest<any>("/audit/sessions/start/", {
      method: "POST",
      body: JSON.stringify({ frequency_months: freq, initiated_by: initiated_by ?? null, property_id: property_id ?? null }),
    });
    if (res.success) {
      const session = res.data as AuditSession;
      const list = readLocalSessions();
      writeLocalSessions([session, ...list.map(s => ({ ...s, is_active: false }))]);
      try { playNotificationSound(); } catch {}
      return session;
    }
    throw new Error(res.message || "Failed to start audit session");
  } catch (e) {
    // Local fallback
    const session: AuditSession = {
      id: `AUD-${Date.now()}`,
      started_at: new Date().toISOString(),
      frequency_months: freq,
      initiated_by: initiated_by ?? null,
      is_active: true,
      property_id: property_id ?? null,
    };
    const list = readLocalSessions().map(s => ({ ...s, is_active: false }));
    writeLocalSessions([session, ...list]);
    try { playNotificationSound(); } catch {}
    return session;
  }
}

export async function endAuditSession(): Promise<void> {
  const current = await getActiveSession();
  if (!current) return;
  try {
    await djangoRequest(`/audit/sessions/${current.id}/end/`, { method: "POST" });
  } catch {}
  const list = readLocalSessions();
  writeLocalSessions(list.map(s => s.id === current.id ? { ...s, is_active: false } : s));
}

export async function listSessions(limit = 200): Promise<AuditSession[]> {
  try {
    const res = await djangoRequest<any>(`/audit/sessions/?page_size=${limit}&ordering=-started_at`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      writeLocalSessions(raw.slice(0, 200));
      return raw;
    }
  } catch {}
  return readLocalSessions().slice(0, limit);
}

export async function getSessionById(id: string): Promise<AuditSession | null> {
  try {
    const res = await djangoRequest<any>(`/audit/sessions/${id}/`);
    if (res.success) return res.data as AuditSession;
  } catch {}
  return readLocalSessions().find(s => s.id === id) ?? null;
}

// ── Assignments ───────────────────────────────────────────────────────────

export async function getAssignment(
  sessionId: string,
  department: string
): Promise<AuditAssignment> {
  try {
    const res = await djangoRequest<any>(
      `/audit/assignments/?session_id=${sessionId}&department=${encodeURIComponent(department)}`
    );
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      if (raw[0]) return raw[0] as AuditAssignment;
    }
  } catch {}
  // Create local if not found
  const local = readLocalAssignments();
  const existing = local.find(a => a.session_id === sessionId && a.department === department);
  if (existing) return existing;
  const created: AuditAssignment = { session_id: sessionId, department, status: "pending" };
  writeLocalAssignments([created, ...local]);
  return created;
}

export async function listAssignments(sessionId: string): Promise<AuditAssignment[]> {
  try {
    const res = await djangoRequest<any>(`/audit/assignments/?session_id=${sessionId}&page_size=500`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditAssignment[];
    }
  } catch {}
  return readLocalAssignments().filter(a => a.session_id === sessionId);
}

export async function submitAssignment(
  sessionId: string,
  department: string,
  submitted_by?: string | null
): Promise<void> {
  // Local update
  const list = readLocalAssignments();
  const idx = list.findIndex(a => a.session_id === sessionId && a.department === department);
  const updated: AuditAssignment = {
    session_id: sessionId,
    department,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    submitted_by: submitted_by ?? null,
  };
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  writeLocalAssignments(list);

  try {
    await djangoRequest(`/audit/assignments/submit/`, {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, department, submitted_by: submitted_by ?? null }),
    });
  } catch {}
}

export async function getProgress(
  sessionId: string,
  departments: string[]
): Promise<{ total: number; submitted: number }> {
  try {
    const res = await djangoRequest<any>(`/audit/sessions/${sessionId}/progress/`);
    if (res.success && res.data) return res.data;
  } catch {}
  const assignments = await listAssignments(sessionId);
  const norm = (s: string) => (s || "").toLowerCase();
  const total = departments.length;
  const submitted = departments.filter(d =>
    assignments.find(a => norm(a.department) === norm(d) && a.status === "submitted")
  ).length;
  return { total, submitted };
}

// ── Reviews ────────────────────────────────────────────────────────────────

export async function getReviewsFor(
  sessionId: string,
  department: string
): Promise<AuditReview[]> {
  try {
    const res = await djangoRequest<any>(
      `/audit/reviews/?session_id=${sessionId}&department=${encodeURIComponent(department)}&page_size=500`
    );
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditReview[];
    }
  } catch {}
  return readLocalReviews().filter(r => r.session_id === sessionId && r.department === department);
}

export async function saveReviewsFor(
  sessionId: string,
  department: string,
  rows: AuditReview[]
): Promise<void> {
  // Local update
  const all = readLocalReviews().filter(r => !(r.session_id === sessionId && r.department === department));
  writeLocalReviews([...rows, ...all]);

  try {
    await djangoRequest(`/audit/reviews/save/`, {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        department,
        rows: rows.map(r => ({ asset_id: r.asset_id, status: r.status, comment: r.comment ?? null })),
      }),
    });
  } catch {}
}

export async function listReviewsForSession(sessionId: string): Promise<AuditReview[]> {
  try {
    const res = await djangoRequest<any>(`/audit/reviews/?session_id=${sessionId}&page_size=1000`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditReview[];
    }
  } catch {}
  return readLocalReviews().filter(r => r.session_id === sessionId);
}

export async function getDepartmentReviewSummary(
  sessionId: string
): Promise<Record<string, { verified: number; missing: number; damaged: number }>> {
  const reviews = await listReviewsForSession(sessionId);
  const summary: Record<string, { verified: number; missing: number; damaged: number }> = {};
  reviews.forEach(r => {
    const dept = (r.department || "").toString();
    if (!summary[dept]) summary[dept] = { verified: 0, missing: 0, damaged: 0 };
    if (r.status === "verified") summary[dept].verified++;
    else if (r.status === "missing") summary[dept].missing++;
    else if (r.status === "damaged") summary[dept].damaged++;
  });
  return summary;
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function createAuditReport(
  sessionId: string,
  generated_by?: string | null
): Promise<AuditReport> {
  const res = await djangoRequest<any>("/audit/reports/", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, generated_by: generated_by ?? null }),
  });
  if (res.success) return res.data as AuditReport;
  throw new Error(res.message || "Failed to create audit report");
}

export async function listAuditReports(sessionId: string): Promise<AuditReport[]> {
  try {
    const res = await djangoRequest<any>(`/audit/reports/?session_id=${sessionId}&ordering=-generated_at`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditReport[];
    }
  } catch {}
  return [];
}

export async function getAuditReport(id: string): Promise<AuditReport | null> {
  try {
    const res = await djangoRequest<any>(`/audit/reports/${id}/`);
    if (res.success) return res.data as AuditReport;
  } catch {}
  return null;
}

export async function listRecentAuditReports(limit = 20): Promise<AuditReport[]> {
  try {
    const res = await djangoRequest<any>(`/audit/reports/?ordering=-generated_at&page_size=${limit}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditReport[];
    }
  } catch {}
  return [];
}

// ── Helpers ────────────────────────────────────────────────────────────────

export async function listDepartmentAssets(
  department: string,
  propertyId?: string
): Promise<Asset[]> {
  const all = await listAssets();
  const norm = (s: string) => (s || "").toLowerCase();
  const pid = norm(String(propertyId || ""));
  return all
    .filter(a => norm(a.department || "") === norm(department || ""))
    .filter(a => {
      if (!propertyId) return true;
      const apid = norm(String(a.property_id || ""));
      const aprop = norm(String(a.property || ""));
      return apid === pid || aprop === pid;
    });
}

// ── Audit Incharge ─────────────────────────────────────────────────────────

export async function getAuditIncharge(propertyId: string): Promise<AuditIncharge | null> {
  if (!propertyId) return null;
  try {
    const res = await djangoRequest<any>(`/audit/incharge/${propertyId}/`);
    if (res.success && res.data) {
      const ai = { property_id: propertyId, user_id: res.data.user_id, user_name: res.data.user_name ?? null };
      const map = readLocalAI();
      map[propertyId] = { user_id: ai.user_id, user_name: ai.user_name };
      writeLocalAI(map);
      return ai;
    }
  } catch {}
  const map = readLocalAI();
  const v = map[propertyId];
  return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
}

export async function setAuditIncharge(
  propertyId: string,
  userId: string,
  userName?: string | null
): Promise<void> {
  if (!propertyId || !userId) return;
  const map = readLocalAI();
  map[propertyId] = { user_id: userId, user_name: userName ?? null };
  writeLocalAI(map);
  try {
    await djangoRequest(`/audit/incharge/`, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, user_id: userId, user_name: userName ?? null }),
    });
  } catch {}
}

export async function listAuditInchargeForUser(
  userId: string,
  userEmail?: string | null
): Promise<string[]> {
  if (!userId) return [];
  try {
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.set("email", userEmail);
    const res = await djangoRequest<any>(`/audit/incharge/?${params.toString()}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const ids = raw.map((r: any) => String(r.property_id));
      // Mirror to local
      const map = readLocalAI();
      raw.forEach((r: any) => { map[r.property_id] = { user_id: userId, user_name: r.user_name ?? null }; });
      writeLocalAI(map);
      return ids;
    }
  } catch {}
  const map = readLocalAI();
  return Object.entries(map)
    .filter(([, v]) => String(v.user_id) === String(userId))
    .map(([pid]) => pid);
}

export async function setAuditInchargeForUser(
  userId: string,
  userName: string | null,
  propertyIds: string[]
): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  // Local update
  const map = readLocalAI();
  Object.keys(map).forEach(pid => {
    if (String(map[pid].user_id) === String(userId) && !uniq.includes(pid)) delete map[pid];
  });
  uniq.forEach(pid => { map[pid] = { user_id: userId, user_name: userName ?? map[pid]?.user_name ?? null }; });
  writeLocalAI(map);
  try {
    await djangoRequest(`/audit/incharge/set/`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, user_name: userName, property_ids: uniq }),
    });
  } catch {}
}

// ── Display helpers ────────────────────────────────────────────────────────

export function formatAuditSessionName(s: Partial<AuditSession> | null | undefined): string {
  if (!s) return "";
  const prop = String((s as any).property_id || "").trim() || "UNK";
  const dt = (() => {
    try { return s.started_at ? new Date(s.started_at) : new Date(); } catch { return new Date(); }
  })();
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  const freq = (s as any).frequency_months ?? "?";
  return `${prop}-${dd}-${mm}-${yyyy}-${freq}`;
}
