/**
 * Reports service – talks to Django REST /api/reports/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";

export type Report = {
  id: string;
  name: string;
  type: string;
  format: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  file_url: string | null;
  filter_session_id?: string | null;
  filter_department?: string | null;
  filter_property?: string | null;
  filter_asset_type?: string | null;
  created_by?: string | null;
  created_by_id?: string | null;
  created_at?: string;
};

const DEMO_LS_KEY = "demo_reports";
const LOCAL_LS_KEY = "reports_local";

function loadLocalDemo(): Report[] {
  try { return JSON.parse(localStorage.getItem(DEMO_LS_KEY) || "[]"); } catch { return []; }
}
function saveLocalDemo(list: Report[]) {
  try { localStorage.setItem(DEMO_LS_KEY, JSON.stringify(list)); } catch {}
}
function loadLocal(): Report[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list: Report[]) {
  try { localStorage.setItem(LOCAL_LS_KEY, JSON.stringify(list)); } catch {}
}

export async function listReports(): Promise<Report[]> {
  if (isDemoMode()) {
    return loadLocalDemo().sort((a, b) => (a.created_at || "") < (b.created_at || "") ? 1 : -1);
  }

  try {
    const res = await djangoRequest<any>("/reports/?ordering=-created_at&page_size=500");
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      saveLocal(raw);
      return raw as Report[];
    }
  } catch {}

  return loadLocal().sort((a, b) => (a.created_at || "") < (b.created_at || "") ? 1 : -1);
}

export async function createReport(
  payload: Omit<Report, "id" | "created_at">
): Promise<Report> {
  const report: Report = {
    id: `RPT-${Math.floor(Math.random() * 900000 + 100000)}`,
    name: payload.name,
    type: payload.type,
    format: payload.format,
    status: payload.status ?? "Completed",
    date_from: payload.date_from ?? null,
    date_to: payload.date_to ?? null,
    file_url: payload.file_url ?? null,
    filter_department: (payload as any).filter_department ?? null,
    filter_property: (payload as any).filter_property ?? null,
    filter_asset_type: (payload as any).filter_asset_type ?? null,
    filter_session_id: (payload as any).filter_session_id ?? null,
    created_by: (payload as any).created_by ?? null,
    created_by_id: (payload as any).created_by_id ?? null,
    created_at: new Date().toISOString(),
  };

  if (isDemoMode()) {
    saveLocalDemo([report, ...loadLocalDemo()]);
    return report;
  }

  // Optimistic local save
  saveLocal([report, ...loadLocal()]);

  try {
    const res = await djangoRequest<any>("/reports/", {
      method: "POST",
      body: JSON.stringify(report),
    });
    if (res.success) {
      const created = res.data as Report;
      saveLocal([created, ...loadLocal().filter(r => r.id !== report.id)]);
      return created;
    }
  } catch {}

  return report;
}

export async function clearReports(): Promise<void> {
  if (isDemoMode()) {
    try { localStorage.setItem(DEMO_LS_KEY, JSON.stringify([])); } catch {}
    return;
  }

  saveLocal([]);

  try {
    await djangoRequest("/reports/clear/", { method: "DELETE" });
  } catch {}
}
