/**
 * Properties service – talks to Django REST /api/properties/
 * Supabase removed: all CRUD via djangoRequest
 */
import { isDemoMode, getDemoProperties } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";
import { djangoRequest } from "./djangoAuth";

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  status: string;
  manager: string | null;
  created_at?: string;
  updated_at?: string;
};

const PROPERTY_CACHE_KEY = "properties:list";
const PROPERTY_CACHE_TTL = 60_000;

const TYPE_MAP: Record<string, string> = {
  office: "Office",
  storage: "Storage",
  manufacturing: "Manufacturing",
  site_office: "Site Office",
  other: "Other",
};

const STATUS_MAP: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  under_maintenance: "Under Maintenance",
};

const REVERSE_TYPE_MAP: Record<string, string> = {
  Office: "office",
  Storage: "storage",
  Manufacturing: "manufacturing",
  "Site Office": "site_office",
  Other: "other",
};

const REVERSE_STATUS_MAP: Record<string, string> = {
  Active: "active",
  Inactive: "inactive",
  "Under Maintenance": "under_maintenance",
};

function normalizeLabel(value: string | null | undefined, map: Record<string, string>, fallback: string): string {
  if (!value) return fallback;
  const key = value.toLowerCase().replace(/\s+/g, "_");
  return map[key] || fallback;
}

function denormalizeLabel(value: string | null | undefined, map: Record<string, string>, fallback: string): string {
  if (!value) return fallback;
  return map[value] || fallback;
}

function fromDjango(row: any): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    type: normalizeLabel(row.type, TYPE_MAP, "Office"),
    status: normalizeLabel(row.status, STATUS_MAP, "Active"),
    manager: row.manager_name ?? row.manager ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDjango(p: Partial<Property>) {
  const payload: Record<string, any> = {
    name: p.name,
    address: p.address ?? null,
    type: denormalizeLabel(p.type, REVERSE_TYPE_MAP, "office"),
    status: denormalizeLabel(p.status, REVERSE_STATUS_MAP, "active"),
  };
  return payload;
}

export async function listProperties(options?: { force?: boolean }): Promise<Property[]> {
  if (isDemoMode()) return getDemoProperties();
  return getCachedValue(
    PROPERTY_CACHE_KEY,
    async () => {
      const res = await djangoRequest<any>("/properties/?page_size=500");
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw.map(fromDjango);
      }
      throw new Error(res.message || "Failed to fetch properties");
    },
    { ttlMs: PROPERTY_CACHE_TTL, force: options?.force },
  );
}

export async function createProperty(p: Property): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const res = await djangoRequest<any>("/properties/", {
    method: "POST",
    body: JSON.stringify(toDjango(p)),
  });
  if (res.success) {
    invalidateCache(PROPERTY_CACHE_KEY);
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to create property");
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const res = await djangoRequest<any>(`/properties/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(toDjango(patch)),
  });
  if (res.success) {
    invalidateCache(PROPERTY_CACHE_KEY);
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to update property");
}

export async function deleteProperty(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const res = await djangoRequest<void>(`/properties/${id}/`, { method: "DELETE" });
  if (res.success) {
    invalidateCache(PROPERTY_CACHE_KEY);
    return;
  }
  throw new Error(res.message || "Failed to delete property");
}

export async function getProperty(id: string): Promise<Property> {
  if (isDemoMode()) {
    const list = getDemoProperties();
    const found = list.find(p => p.id === id);
    if (!found) throw new Error("Property not found");
    return found;
  }
  const res = await djangoRequest<any>(`/properties/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch property");
}

