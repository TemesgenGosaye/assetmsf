/**
 * Departments service – talks to Django REST /api/departments/
 * Supabase removed: all CRUD via djangoRequest
 */
import { djangoRequest } from "./djangoAuth";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";

export type Department = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
};

const CACHE_KEY = "departments:list";
const CACHE_TTL = 120_000;
const LS_FALLBACK = "departments_fallback";

// ── Canonical constant department list ────────────────────────────────────
// Metahara Sugar Factory official departments (name -> code). This mirrors the
// backend `departments.constants.CONSTANT_DEPARTMENTS` and is used as the
// offline fallback so every department field stays locked to the official list.

export const CONSTANT_DEPARTMENTS: ReadonlyArray<{ name: string; code: string }> = [
  { name: "Accounts", code: "FIN" },
  { name: "Procurement & Warehouse", code: "STORE" },
  { name: "Quality Control & Lab", code: "LAB" },
  { name: "Distillery / Ethanol", code: "DIST" },
  { name: "Infrastructure & Irrigation", code: "CIVIL" },
  { name: "Transport & Logistics", code: "LOG" },
  { name: "Information Technology", code: "IT" },
  { name: "Safety & Health", code: "SHE" },
  { name: "Security", code: "SEC" },
  { name: "Sales & Marketing", code: "SALES" },
  { name: "Livestock & Plantation Development", code: "LPCD" },
  { name: "Agricultural Research Station", code: "AGRI-RES" },
  { name: "Diversity, Equity & Inclusion", code: "DIVERSITY" },
  { name: "Club Caffe", code: "CLUB-CAFFE" },
  { name: "Community Relations & CSR", code: "COMMUNITY" },
  { name: "Executive Management Office", code: "GM-OFFICE" },
  { name: "Factory Process Management", code: "PROC-MGR" },
  { name: "Legal & Compliance", code: "LEGAL" },
  { name: "Internal Audit", code: "AUDIT" },
  { name: "Corporate Communications & PR", code: "PR" },
];

// ── Local fallback helpers ─────────────────────────────────────────────────

function readLocal(): Department[] {
  try {
    const raw = localStorage.getItem(LS_FALLBACK);
    if (raw) return JSON.parse(raw) as Department[];
  } catch {}
  const seeded: Department[] = CONSTANT_DEPARTMENTS.map((d, i) => ({
    id: `DEP-${String(i + 1).padStart(3, "0")}`,
    name: d.name,
    code: d.code,
    is_active: true,
    created_at: new Date().toISOString(),
  }));
  try { localStorage.setItem(LS_FALLBACK, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function writeLocal(list: Department[]) {
  try { localStorage.setItem(LS_FALLBACK, JSON.stringify(list)); } catch {}
}

// ── Mapper ─────────────────────────────────────────────────────────────────

function fromDjango(row: any): Department {
  return {
    id: String(row.id),
    name: row.name ?? "",
    code: row.code ?? null,
    is_active: row.is_active !== false,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function listDepartments(): Promise<Department[]> {
  try {
    return await getCachedValue(
      CACHE_KEY,
      async () => {
        const res = await djangoRequest<any>("/departments/?page_size=500");
        if (res.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          const remote = raw.map(fromDjango);
          // Mirror to local as fallback
          writeLocal(remote);
          return remote;
        }
        throw new Error(res.message || "Failed to fetch departments");
      },
      { ttlMs: CACHE_TTL }
    );
  } catch {
    return readLocal();
  }
}

export async function createDepartment(payload: {
  name: string;
  code?: string | null;
  is_active?: boolean;
  id?: string;
}): Promise<Department> {
  try {
    const res = await djangoRequest<any>("/departments/", {
      method: "POST",
      body: JSON.stringify({
        id: payload.id,
        name: payload.name,
        code: payload.code ?? null,
        is_active: payload.is_active ?? true,
      }),
    });
    if (res.success) {
      invalidateCache(CACHE_KEY);
      const created = fromDjango(res.data);
      const local = readLocal();
      writeLocal([created, ...local.filter(d => d.id !== created.id)]);
      return created;
    }
    throw new Error(res.message || "Failed to create department");
  } catch (e) {
    // Local fallback
    const now = new Date().toISOString();
    const created: Department = {
      id: payload.id || String(Date.now()),
      name: payload.name,
      code: payload.code ?? null,
      is_active: payload.is_active ?? true,
      created_at: now,
    };
    const list = readLocal();
    writeLocal([created, ...list]);
    return created;
  }
}

export async function updateDepartment(
  id: string,
  patch: Partial<Pick<Department, "name" | "code" | "is_active">>
): Promise<Department> {
  try {
    const res = await djangoRequest<any>(`/departments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (res.success) {
      invalidateCache(CACHE_KEY);
      const updated = fromDjango(res.data);
      const list = readLocal();
      const idx = list.findIndex(d => d.id === id);
      if (idx >= 0) { list[idx] = updated; writeLocal([...list]); }
      return updated;
    }
    throw new Error(res.message || "Failed to update department");
  } catch {
    const list = readLocal();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Not found");
    const updated = { ...list[idx], ...patch } as Department;
    list[idx] = updated;
    writeLocal(list);
    return updated;
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  try {
    const res = await djangoRequest<void>(`/departments/${id}/`, { method: "DELETE" });
    if (res.success) {
      invalidateCache(CACHE_KEY);
      writeLocal(readLocal().filter(d => d.id !== id));
      return;
    }
    throw new Error(res.message || "Failed to delete department");
  } catch {
    writeLocal(readLocal().filter(d => d.id !== id));
  }
}
