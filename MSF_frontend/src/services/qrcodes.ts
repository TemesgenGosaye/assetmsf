/**
 * QR Codes service – talks to Django REST /api/qr-codes/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import { djangoRequest } from "./djangoAuth";

export type QRCode = {
  id: string;
  assetId: string;
  assetName?: string | null;
  property: string | null;
  generatedDate: string;
  status: string;
  printed: boolean;
  imageUrl: string | null;
  created_at?: string;
};

const QR_CACHE_KEY = "qrcodes:list";
const QR_CACHE_TTL = 30_000;
const DEMO_LS_KEY = "demo_qr_codes";
const LOCAL_LS_KEY = "qr_codes_local";

// ── Local helpers ──────────────────────────────────────────────────────────

function loadLocalDemo(): QRCode[] {
  try { return JSON.parse(localStorage.getItem(DEMO_LS_KEY) || "[]"); } catch { return []; }
}
function saveLocalDemo(list: QRCode[]) {
  try { localStorage.setItem(DEMO_LS_KEY, JSON.stringify(list)); } catch {}
}
function loadLocal(): QRCode[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list: QRCode[]) {
  try { localStorage.setItem(LOCAL_LS_KEY, JSON.stringify(list)); } catch {}
}

// ── Mapper ─────────────────────────────────────────────────────────────────

function fromDjango(row: any): QRCode {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? null,
    property: row.property ?? null,
    generatedDate: row.generated_date,
    status: row.status,
    printed: !!row.printed,
    imageUrl: row.image_url ?? null,
    created_at: row.created_at,
  };
}

function toDjango(qr: Partial<QRCode>): any {
  return {
    id: qr.id,
    asset_id: qr.assetId,
    property: qr.property ?? null,
    generated_date: qr.generatedDate,
    status: qr.status,
    printed: qr.printed,
    image_url: qr.imageUrl ?? null,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function listQRCodes(options?: { force?: boolean }): Promise<QRCode[]> {
  if (isDemoMode()) {
    return loadLocalDemo();
  }
  return getCachedValue(
    QR_CACHE_KEY,
    async () => {
      const res = await djangoRequest<any>("/qr-codes/?page_size=500");
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw.map(fromDjango);
      }
      throw new Error(res.message || "Failed to fetch QR codes");
    },
    { ttlMs: QR_CACHE_TTL, force: options?.force }
  );
}

export async function createQRCode(qr: QRCode): Promise<QRCode> {
  if (isDemoMode()) {
    const list = loadLocalDemo();
    list.unshift(qr);
    saveLocalDemo(list);
    invalidateCacheByPrefix(QR_CACHE_KEY);
    return qr;
  }

  // Optimistic local save
  saveLocal([qr, ...loadLocal()]);
  invalidateCacheByPrefix(QR_CACHE_KEY);

  try {
    const res = await djangoRequest<any>("/qr-codes/", {
      method: "POST",
      body: JSON.stringify(toDjango(qr)),
    });
    if (res.success) {
      const created = fromDjango(res.data);
      // Replace optimistic entry
      const list = loadLocal();
      saveLocal([created, ...list.filter(q => q.id !== qr.id)]);
      invalidateCacheByPrefix(QR_CACHE_KEY);
      return created;
    }
  } catch {}

  return qr;
}

export async function updateQRCode(id: string, patch: Partial<QRCode>): Promise<QRCode> {
  if (isDemoMode()) {
    const list = loadLocalDemo();
    const idx = list.findIndex(q => q.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch } as QRCode;
      saveLocalDemo(list);
      invalidateCacheByPrefix(QR_CACHE_KEY);
      return list[idx];
    }
    throw new Error("NOT_FOUND");
  }

  // Optimistic local update
  const list = loadLocal();
  const idx = list.findIndex(q => q.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch } as QRCode;
    saveLocal(list);
  }
  invalidateCacheByPrefix(QR_CACHE_KEY);

  try {
    const res = await djangoRequest<any>(`/qr-codes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(toDjango(patch)),
    });
    if (res.success) {
      const updated = fromDjango(res.data);
      if (idx >= 0) { list[idx] = updated; saveLocal(list); }
      invalidateCacheByPrefix(QR_CACHE_KEY);
      return updated;
    }
  } catch {}

  if (idx >= 0) return list[idx];
  throw new Error("NOT_FOUND");
}

export async function deleteAllQRCodes(): Promise<void> {
  if (isDemoMode()) {
    try { localStorage.removeItem(DEMO_LS_KEY); } catch {}
    invalidateCacheByPrefix(QR_CACHE_KEY);
    return;
  }

  saveLocal([]);
  invalidateCacheByPrefix(QR_CACHE_KEY);

  try {
    await djangoRequest("/qr-codes/clear/", { method: "DELETE" });
  } catch {}
}
