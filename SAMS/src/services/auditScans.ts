/**
 * Audit Scans service – talks to Django REST /api/audit/scans/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";
import { getCurrentUserId } from "@/services/permissions";

export type AuditScan = {
  id: string;
  session_id: string;
  asset_id: string;
  property_id?: string | null;
  department: string;
  status: "verified" | "damaged";
  scanned_by: string;
  scanned_by_name?: string | null;
  scanned_by_email?: string | null;
  scanned_at: string;
};

const LS_KEY = "audit_scans_local";

function readLocal(): AuditScan[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list: AuditScan[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export async function verifyAssetViaScan(params: {
  sessionId: string;
  assetId: string;
  status: "verified" | "damaged";
  comment?: string | null;
}): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not signed in");

  // Optimistic local save
  const scan: AuditScan = {
    id: `SCN-${Date.now()}`,
    session_id: params.sessionId,
    asset_id: params.assetId,
    property_id: null,
    department: "",
    status: params.status,
    scanned_by: userId,
    scanned_at: new Date().toISOString(),
  };
  saveLocal([scan, ...readLocal()]);

  const res = await djangoRequest("/audit/scans/verify/", {
    method: "POST",
    body: JSON.stringify({
      session_id: params.sessionId,
      asset_id: params.assetId,
      status: params.status,
      scanned_by: userId,
      comment: params.comment ?? null,
    }),
  });
  if (!res.success) throw new Error(res.message || "Scan verification failed");
}

export async function listMyScansForSession(sessionId: string): Promise<AuditScan[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  try {
    const res = await djangoRequest<any>(
      `/audit/scans/?session_id=${sessionId}&scanned_by=${userId}&page_size=500`
    );
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw as AuditScan[];
    }
  } catch {}

  return readLocal().filter(s => s.session_id === sessionId && s.scanned_by === userId);
}
