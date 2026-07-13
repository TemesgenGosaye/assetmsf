/**
 * Houses service – talks to Django REST /api/houses/
 */
import { djangoRequest } from "./djangoAuth";
import { invalidateCache, setCachedValue, peekCachedValue } from "@/lib/data-cache";

export type HouseType = "Staff" | "A" | "B" | "C" | "D" | "E";
export type HouseStatus = "Active" | "Inactive";

export type DamagedItemKey = "damaged_door" | "damaged_windows" | "damaged_walls" | "damaged_switch" | "damaged_bulb" | "damaged_water";

export type House = {
  id: string;
  house_id: string;
  location: string;
  house_type: HouseType;
  status: HouseStatus;
  damaged_door: boolean;
  damaged_windows: boolean;
  damaged_walls: boolean;
  damaged_switch: boolean;
  damaged_bulb: boolean;
  damaged_water: boolean;
  damaged_items: string[];
  description: string;
  capacity: number;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
};

export type HouseFormData = {
  location: string;
  house_type: HouseType;
  status: HouseStatus;
  damaged_door: boolean;
  damaged_windows: boolean;
  damaged_walls: boolean;
  damaged_switch: boolean;
  damaged_bulb: boolean;
  damaged_water: boolean;
  description: string;
  capacity: number;
};

const CACHE_KEY = "houses:list";

function fromDjango(row: any): House {
  return {
    id:             String(row.id),
    house_id:       row.house_id       ?? "",
    location:       row.location       ?? "",
    house_type:     row.house_type     ?? "Staff",
    status:         row.status         ?? "Active",
    damaged_door:    row.damaged_door    ?? false,
    damaged_windows: row.damaged_windows ?? false,
    damaged_walls:   row.damaged_walls   ?? false,
    damaged_switch:  row.damaged_switch  ?? false,
    damaged_bulb:    row.damaged_bulb    ?? false,
    damaged_water:   row.damaged_water   ?? false,
    damaged_items:   row.damaged_items   ?? [],
    description:    row.description    ?? "",
    capacity:       row.capacity       ?? 1,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
    is_active:      row.is_active,
  };
}

export async function listHouses(): Promise<House[]> {
  const res = await djangoRequest<any>("/houses/?page_size=500");
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw.map(fromDjango);
  }
  throw new Error(res.message || "Failed to fetch houses");
}

export async function getHouse(id: string): Promise<House> {
  const res = await djangoRequest<any>(`/houses/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch house");
}

export async function createHouse(data: HouseFormData): Promise<House> {
  const res = await djangoRequest<any>("/houses/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) {
    const house = fromDjango(res.data);
    const existing = peekCachedValue<House[]>(CACHE_KEY);
    if (existing) {
      setCachedValue(CACHE_KEY, [house, ...existing]);
    } else {
      invalidateCache(CACHE_KEY);
    }
    return house;
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to create house");
}

export async function updateHouse(id: string, data: HouseFormData): Promise<House> {
  const res = await djangoRequest<any>(`/houses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (res.success) {
    const house = fromDjango(res.data);
    const existing = peekCachedValue<House[]>(CACHE_KEY);
    if (existing) {
      setCachedValue(CACHE_KEY, existing.map(h => h.id === house.id ? house : h));
    } else {
      invalidateCache(CACHE_KEY);
    }
    return house;
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to update house");
}

export async function deleteHouse(id: string): Promise<void> {
  const res = await djangoRequest<void>(`/houses/${id}/`, { method: "DELETE" });
  if (res.success) {
    const existing = peekCachedValue<House[]>(CACHE_KEY);
    if (existing) {
      setCachedValue(CACHE_KEY, existing.filter(h => h.id !== id));
    } else {
      invalidateCache(CACHE_KEY);
    }
    return;
  }
  throw new Error(res.message || "Failed to delete house");
}

export const HOUSE_TYPES: HouseType[] = ["Staff", "A", "B", "C", "D", "E"];
export const HOUSE_STATUSES: HouseStatus[] = ["Active", "Inactive"];
export const DAMAGE_OPTIONS: { key: DamagedItemKey; label: string }[] = [
  { key: "damaged_door",    label: "Door" },
  { key: "damaged_windows", label: "Windows" },
  { key: "damaged_walls",   label: "Walls" },
  { key: "damaged_switch",  label: "Switch" },
  { key: "damaged_bulb",    label: "Bulb" },
  { key: "damaged_water",   label: "Water" },
];
