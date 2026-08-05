/**
 * Residential Allocations service – talks to Django REST /api/residential-allocations/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { isDemoMode } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";
import { djangoRequest } from "./djangoAuth";

// ── Types ─────────────────────────────────────────────────────────────────

export type AllocationCategory = "permanent" | "seasonal" | "guest";
export type Gender = "Male" | "Female" | "Other";
export type AllocationStatus = "Active" | "Pending" | "Vacated" | "Suspended";

export type ResidentAllocation = {
  id: string;
  category: AllocationCategory;
  emp_id: string;
  full_name: string;
  gender: Gender;
  national_id: string;
  job_title: string;
  job_grade: string;
  service_years: number;
  has_disability: boolean;
  unit_number: string;
  building: string | null;
  floor: string | null;
  room_type: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  lease_end_date: string | null;
  status: AllocationStatus;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AllocationFormData = Omit<ResidentAllocation, "id" | "created_at" | "updated_at">;

// ── Cache keys ─────────────────────────────────────────────────────────────

const CACHE_KEYS: Record<AllocationCategory, string> = {
  permanent: "residential:permanent",
  seasonal: "residential:seasonal",
  guest: "residential:guest",
};
const CACHE_TTL = 60_000;
const LS_KEY = "residential_allocations";

// ── Local helpers ──────────────────────────────────────────────────────────

function readLocalAll(): ResidentAllocation[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function writeLocalAll(data: ResidentAllocation[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function generateId(category: AllocationCategory): string {
  const prefix = category === "permanent" ? "PERM" : category === "seasonal" ? "SEAS" : "GUST";
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── Mapper ─────────────────────────────────────────────────────────────────

function fromDjango(row: any): ResidentAllocation {
  return {
    id: String(row.id),
    category: row.category,
    emp_id: row.emp_id ?? "",
    full_name: row.full_name ?? "",
    gender: row.gender ?? "Male",
    national_id: row.national_id ?? "",
    job_title: row.job_title ?? "",
    job_grade: row.job_grade ?? "",
    service_years: row.service_years ?? 0,
    has_disability: !!row.has_disability,
    unit_number: row.unit_number ?? "",
    building: row.building ?? null,
    floor: row.floor ?? null,
    room_type: row.room_type ?? null,
    move_in_date: row.move_in_date ?? null,
    move_out_date: row.move_out_date ?? null,
    lease_end_date: row.lease_end_date ?? null,
    status: row.status ?? "Active",
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function listAllocations(
  category: AllocationCategory,
  opts?: { force?: boolean }
): Promise<ResidentAllocation[]> {
  if (isDemoMode()) {
    return readLocalAll().filter(r => r.category === category);
  }
  return getCachedValue(
    CACHE_KEYS[category],
    async () => {
      const res = await djangoRequest<any>(
        `/residential-allocations/?category=${category}&page_size=500`
      );
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw.map(fromDjango);
      }
      throw new Error(res.message || "Failed to fetch allocations");
    },
    { ttlMs: CACHE_TTL, force: opts?.force }
  );
}

export async function createAllocation(data: AllocationFormData): Promise<ResidentAllocation> {
  if (isDemoMode()) {
    const record: ResidentAllocation = {
      ...data,
      id: generateId(data.category),
      created_at: new Date().toISOString(),
    };
    writeLocalAll([record, ...readLocalAll()]);
    return record;
  }

  const res = await djangoRequest<any>("/residential-allocations/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) {
    invalidateCache(CACHE_KEYS[data.category]);
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to create allocation");
}

export async function updateAllocation(
  id: string,
  data: AllocationFormData
): Promise<ResidentAllocation> {
  if (isDemoMode()) {
    const all = readLocalAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Record not found");
    const updated: ResidentAllocation = {
      ...all[idx],
      ...data,
      id,
      updated_at: new Date().toISOString(),
    };
    all[idx] = updated;
    writeLocalAll(all);
    return updated;
  }

  const res = await djangoRequest<any>(`/residential-allocations/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (res.success) {
    invalidateCache(CACHE_KEYS[data.category]);
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to update allocation");
}

export async function deleteAllocation(
  id: string,
  category: AllocationCategory
): Promise<void> {
  if (isDemoMode()) {
    writeLocalAll(readLocalAll().filter(r => r.id !== id));
    return;
  }

  const res = await djangoRequest<void>(`/residential-allocations/${id}/`, {
    method: "DELETE",
  });
  if (res.success) {
    invalidateCache(CACHE_KEYS[category]);
    return;
  }
  throw new Error(res.message || "Failed to delete allocation");
}
