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
  parent: string | null;
  parent_name: string | null;
  level: number;
  sort_order: number;
  children_count: number;
  hierarchy: string;
  is_active: boolean;
  created_at: string;
};

export type DepartmentTreeNode = {
  id: string;
  name: string;
  code: string | null;
  level: number;
  sort_order: number;
  parent: string | null;
  head_name: string | null;
  children: DepartmentTreeNode[];
};

const CACHE_KEY = "departments:list";
const CACHE_TTL = 120_000;
const LS_FALLBACK = "departments_fallback";

// ── Official Metahara Sugar Factory department master ──────────────────────
// This mirrors the backend `departments.constants.OFFICIAL_DEPARTMENTS`.
// Used as offline fallback so every department field stays locked to the
// official list. Code is the stable business identifier.

export const CONSTANT_DEPARTMENTS: ReadonlyArray<{
  name: string;
  code: string;
  parent_code: string | null;
  level: number;
  sort_order: number;
}> = [
  { name: "CIVIL WORK",                                    code: "12",    parent_code: null,    level: 0, sort_order: 100 },
  { name: "L.P.C.D",                                       code: "13",    parent_code: null,    level: 0, sort_order: 200 },
  { name: "CULTIVATION",                                   code: "14",    parent_code: null,    level: 0, sort_order: 300 },
  { name: "TILLAGE",                                       code: "14.1",  parent_code: "14",    level: 1, sort_order: 310 },
  { name: "CULTIVATION",                                   code: "14.2",  parent_code: "14",    level: 1, sort_order: 320 },
  { name: "PLANTATION",                                    code: "15",    parent_code: null,    level: 0, sort_order: 400 },
  { name: "ABADIR A",                                      code: "15.1",  parent_code: "15",    level: 1, sort_order: 401 },
  { name: "ABADIR B",                                      code: "15.2",  parent_code: "15",    level: 1, sort_order: 402 },
  { name: "ABADIR C",                                      code: "15.3",  parent_code: "15",    level: 1, sort_order: 403 },
  { name: "ABADIR EXTENSION",                              code: "15.4",  parent_code: "15",    level: 1, sort_order: 404 },
  { name: "ABADIR FRUIT",                                  code: "15.5",  parent_code: "15",    level: 1, sort_order: 405 },
  { name: "MERTI 1ST EAST",                                code: "15.6",  parent_code: "15",    level: 1, sort_order: 406 },
  { name: "MERTI 1ST AWASH",                               code: "15.7",  parent_code: "15",    level: 1, sort_order: 407 },
  { name: "MERTI 2ND CHORE",                               code: "15.8",  parent_code: "15",    level: 1, sort_order: 408 },
  { name: "MERTI 2ND G/GOLLA",                             code: "15.9",  parent_code: "15",    level: 1, sort_order: 409 },
  { name: "MERTI 2ND KENIFA",                              code: "15.10", parent_code: "15",    level: 1, sort_order: 410 },
  { name: "MERTI 3RD KIKAN",                               code: "15.11", parent_code: "15",    level: 1, sort_order: 411 },
  { name: "MERTI 3RD SOUTH",                               code: "15.12", parent_code: "15",    level: 1, sort_order: 412 },
  { name: "MERTI 3RD R.LAND",                              code: "15.13", parent_code: "15",    level: 1, sort_order: 413 },
  { name: "NORTH",                                         code: "15.14", parent_code: "15",    level: 1, sort_order: 414 },
  { name: "RATU CULTURE",                                  code: "15.15", parent_code: "15",    level: 1, sort_order: 415 },
  { name: "AGRICULTURE RESEARCH",                          code: "16",    parent_code: null,    level: 0, sort_order: 500 },
  { name: "HARVESTING",                                    code: "17",    parent_code: null,    level: 0, sort_order: 600 },
  { name: "SEED CANE & IRRIGATION",                        code: "17.1",  parent_code: "17",    level: 1, sort_order: 601 },
  { name: "CANE CUTTING",                                  code: "17.2",  parent_code: "17",    level: 1, sort_order: 602 },
  { name: "HAULAGE",                                       code: "17.3",  parent_code: "17",    level: 1, sort_order: 603 },
  { name: "F.E.S",                                         code: "18",    parent_code: null,    level: 0, sort_order: 700 },
  { name: "ESTATE CAR & MOTORCYCLE",                       code: "18.1",  parent_code: "18",    level: 1, sort_order: 701 },
  { name: "HEAVY EQUIPMENT",                               code: "18.2",  parent_code: "18",    level: 1, sort_order: 702 },
  { name: "WHEEL TRACTOR",                                 code: "18.3",  parent_code: "18",    level: 1, sort_order: 703 },
  { name: "COMMERCIAL DEPARTMENT",                         code: "19",    parent_code: null,    level: 0, sort_order: 800 },
  { name: "TECHNICAL",                                     code: "21",    parent_code: null,    level: 0, sort_order: 900 },
  { name: "PREVENTIVE MAINTENANCE, EXTRACTION AND POWER PLANT", code: "21.1", parent_code: "21", level: 1, sort_order: 910 },
  { name: "INSTRUMENT WORKSHOP",                           code: "21.2",  parent_code: "21",    level: 1, sort_order: 920 },
  { name: "ELECTRICAL WORKSHOP",                           code: "21.3",  parent_code: "21",    level: 1, sort_order: 930 },
  { name: "MECHANICAL WORKSHOP",                           code: "21.4",  parent_code: "21",    level: 1, sort_order: 940 },
  { name: "FABRICATION WORKSHOP",                          code: "21.5",  parent_code: "21",    level: 1, sort_order: 950 },
  { name: "PRODUCTION",                                    code: "22",    parent_code: null,    level: 0, sort_order: 1000 },
  { name: "MANAGER OFFICE",                                code: "23",    parent_code: null,    level: 0, sort_order: 1100 },
  { name: "LEGAL SERVICE",                                 code: "23.1",  parent_code: "23",    level: 1, sort_order: 1110 },
  { name: "MANAGEMENT SERVICE",                            code: "23.2",  parent_code: "23",    level: 1, sort_order: 1120 },
  { name: "ORGANIZATION AND METHODS",                      code: "23.2.1", parent_code: "23.2", level: 2, sort_order: 1121 },
  { name: "PLANNING, BUSINESS DEVELOPMENT AND BUDGET PREPARATION", code: "23.2.2", parent_code: "23.2", level: 2, sort_order: 1122 },
  { name: "MANAGEMENT INFORMATION SYSTEM",                 code: "23.2.3", parent_code: "23.2", level: 2, sort_order: 1123 },
  { name: "ESTATE SERVICE",                                code: "23.3",  parent_code: "23",    level: 1, sort_order: 1130 },
  { name: "GENERAL SERVICE",                               code: "23.3.1", parent_code: "23.3", level: 2, sort_order: 1131 },
  { name: "PUBLIC RELATION",                               code: "23.3.2", parent_code: "23.3", level: 2, sort_order: 1132 },
  { name: "BOARD OF DIRECTORS",                            code: "23.4",  parent_code: "23",    level: 1, sort_order: 1140 },
  { name: "FINANCE DEPARTMENT",                            code: "24",    parent_code: null,    level: 0, sort_order: 1200 },
  { name: "GENERAL ACCOUNTING",                            code: "24.1",  parent_code: "24",    level: 1, sort_order: 1210 },
  { name: "COST ACCOUNTING",                               code: "24.2",  parent_code: "24",    level: 1, sort_order: 1220 },
  { name: "BUDGET CONTROL AND FINANCIAL ANALYSIS",         code: "24.3",  parent_code: "24",    level: 1, sort_order: 1230 },
  { name: "LOGISTICS",                                     code: "25",    parent_code: null,    level: 0, sort_order: 1300 },
  { name: "MATERIAL REQUIREMENT PLANNING",                 code: "25.1",  parent_code: "25",    level: 1, sort_order: 1310 },
  { name: "STORE ADMINISTRATION",                          code: "25.2",  parent_code: "25",    level: 1, sort_order: 1320 },
  { name: "HUMAN RESOURCE DEPARTMENT",                     code: "26",    parent_code: null,    level: 0, sort_order: 1400 },
  { name: "MANPOWER PLANNING AND TRAINING",                code: "26.2",  parent_code: "26",    level: 1, sort_order: 1420 },
  { name: "EMPLOYMENT AND ADMINISTRATION",                 code: "26.3",  parent_code: "26",    level: 1, sort_order: 1430 },
  { name: "EMPLOYEE RELATION",                             code: "26.4",  parent_code: "26",    level: 1, sort_order: 1440 },
  { name: "GUEST HOUSE",                                   code: "27",    parent_code: null,    level: 0, sort_order: 1500 },
  { name: "BUILDING",                                      code: "28",    parent_code: null,    level: 0, sort_order: 1600 },
  { name: "PARK AND LANSE",                                code: "29",    parent_code: null,    level: 0, sort_order: 1700 },
  { name: "MEDICAL SERVICE",                               code: "30",    parent_code: null,    level: 0, sort_order: 1800 },
  { name: "MEDICAL SECTION",                               code: "30.1",  parent_code: "30",    level: 1, sort_order: 1810 },
  { name: "PUBLIC HEALTH",                                 code: "30.2",  parent_code: "30",    level: 1, sort_order: 1820 },
  { name: "W.P.E — WORKERS PARTY OF ETHIOPIA",             code: "31",    parent_code: null,    level: 0, sort_order: 1900 },
  { name: "LABOUR UNION",                                  code: "32",    parent_code: null,    level: 0, sort_order: 2000 },
  { name: "WORKERS CONTROL COMMITTEE",                     code: "33",    parent_code: null,    level: 0, sort_order: 2100 },
  { name: "ANTI-CORRUPTION OFFICE",                        code: "33.1",  parent_code: "33",    level: 1, sort_order: 2110 },
  { name: "SECURITY",                                      code: "34",    parent_code: null,    level: 0, sort_order: 2200 },
  { name: "T.D.C",                                         code: "35",    parent_code: null,    level: 0, sort_order: 2300 },
  { name: "REWA",                                          code: "36",    parent_code: null,    level: 0, sort_order: 2400 },
  { name: "REYA",                                          code: "37",    parent_code: null,    level: 0, sort_order: 2500 },
  { name: "POLICE",                                        code: "38",    parent_code: null,    level: 0, sort_order: 2600 },
  { name: "FRUIT",                                         code: "39",    parent_code: null,    level: 0, sort_order: 2700 },
  { name: "CUSTOMS",                                       code: "40",    parent_code: null,    level: 0, sort_order: 2800 },
  { name: "WORKER CLUB",                                   code: "50",    parent_code: null,    level: 0, sort_order: 2900 },
  { name: "FAMILY CLUB",                                   code: "51",    parent_code: null,    level: 0, sort_order: 3000 },
  { name: "COMMUNITY CENTER",                              code: "52",    parent_code: null,    level: 0, sort_order: 3100 },
  { name: "CO-OPERATIVE SHOP",                             code: "53",    parent_code: null,    level: 0, sort_order: 3200 },
  { name: "WONJI-SHOA TRAINING CENTER",                    code: "54",    parent_code: null,    level: 0, sort_order: 3300 },
  { name: "AUDIT SERVICE",                                 code: "55",    parent_code: null,    level: 0, sort_order: 3400 },
  { name: "PROJECT AND PRODUCTIVITY IMPROVEMENT OFFICE",   code: "56",    parent_code: null,    level: 0, sort_order: 3500 },
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
    parent: d.parent_code,
    parent_name: null,
    level: d.level,
    sort_order: d.sort_order,
    children_count: 0,
    hierarchy: d.name,
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
    parent: row.parent ?? null,
    parent_name: row.parent_name ?? null,
    level: row.level ?? 0,
    sort_order: row.sort_order ?? 0,
    children_count: row.children_count ?? 0,
    hierarchy: row.hierarchy ?? row.name ?? "",
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

export async function listDepartmentTree(): Promise<DepartmentTreeNode[]> {
  try {
    const res = await djangoRequest<any>("/departments/tree/");
    if (res.success) {
      return Array.isArray(res.data) ? res.data : [];
    }
    throw new Error(res.message || "Failed to fetch department tree");
  } catch {
    // Build tree from local data
    const all = readLocal();
    const byId = new Map<string, Department>();
    all.forEach(d => byId.set(d.id, d));

    const roots: DepartmentTreeNode[] = [];
    const childMap = new Map<string, DepartmentTreeNode[]>();

    all.forEach(d => {
      const node: DepartmentTreeNode = {
        id: d.id,
        name: d.name,
        code: d.code,
        level: d.level,
        sort_order: d.sort_order,
        parent: d.parent,
        head_name: null,
        children: [],
      };
      if (d.parent && byId.has(d.parent)) {
        const siblings = childMap.get(d.parent) ?? [];
        siblings.push(node);
        childMap.set(d.parent, siblings);
      } else {
        roots.push(node);
      }
    });

    function attachChildren(nodes: DepartmentTreeNode[]) {
      nodes.forEach(n => {
        const children = childMap.get(n.id) ?? [];
        n.children = children.sort((a, b) => a.sort_order - b.sort_order);
        attachChildren(children);
      });
    }
    attachChildren(roots);
    return roots.sort((a, b) => a.sort_order - b.sort_order);
  }
}

export async function createDepartment(payload: {
  name: string;
  code?: string | null;
  parent?: string | null;
  is_active?: boolean;
  id?: string;
  sort_order?: number;
}): Promise<Department> {
  try {
    const res = await djangoRequest<any>("/departments/", {
      method: "POST",
      body: JSON.stringify({
        id: payload.id,
        name: payload.name,
        code: payload.code ?? null,
        parent: payload.parent ?? null,
        is_active: payload.is_active ?? true,
        sort_order: payload.sort_order ?? 0,
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
    const now = new Date().toISOString();
    const created: Department = {
      id: payload.id || String(Date.now()),
      name: payload.name,
      code: payload.code ?? null,
      parent: payload.parent ?? null,
      parent_name: null,
      level: 0,
      sort_order: payload.sort_order ?? 0,
      children_count: 0,
      hierarchy: payload.name,
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
  patch: Partial<Pick<Department, "name" | "code" | "is_active" | "sort_order" | "parent">>
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
