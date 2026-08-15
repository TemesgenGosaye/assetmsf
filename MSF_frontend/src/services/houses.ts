/**
 * Houses service – talks to Django REST /api/houses/
 */
import { djangoRequest } from "./djangoAuth.ts";
import { invalidateCache, setCachedValue, peekCachedValue, getCachedValue } from "../lib/data-cache";

export type HouseType = "Staff" | "A" | "B" | "C" | "D" | "E";
export type HouseStatus = "Active" | "Inactive";
export type AllocationCategory = "R" | "G";
export type RoomStatus = "Vacant" | "Occupied" | "Reserved" | "Maintenance" | "";

export type RoomDetail = {
  label: string;
  index: number;
  status: RoomStatus;
  occupant_name: string;
  occupant_id: string;
  notes: string;
};

export type RoomsSummary = {
  total: number;
  occupied: number;
  vacant: number;
  reserved: number;
  maintenance: number;
  labels: string[];
  details: RoomDetail[];
};

export type DamagedItemKey = "damaged_door" | "damaged_windows" | "damaged_walls" | "damaged_switch" | "damaged_bulb" | "damaged_water";

export type House = {
  id: string;
  house_id: string;
  house_number: string;
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
  inside_items: string[];
  description: string;
  capacity: number;
  allocation_category: AllocationCategory;
  allocation_status?: string;
  assigned_employee_id?: string | null;
  assigned_employee_name?: string | null;
  assigned_application_no?: string | null;
  current_occupancy?: number;
  vacant?: number;
  is_available?: boolean;
  room_vacant_count?: number;
  available_rooms?: string[];
  is_fully_vacant?: boolean;
  room_count: number;
  room_labels: string[];
  r1_status: RoomStatus;
  r1_occupant_name: string;
  r1_occupant_id: string;
  r1_notes: string;
  r2_status: RoomStatus;
  r2_occupant_name: string;
  r2_occupant_id: string;
  r2_notes: string;
  r3_status: RoomStatus;
  r3_occupant_name: string;
  r3_occupant_id: string;
  r3_notes: string;
  rooms: RoomDetail[];
  rooms_summary: RoomsSummary;
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
  inside_items: string[];
  description: string;
  capacity: number;
  allocation_category: AllocationCategory;
  r1_status?: RoomStatus;
  r1_occupant_name?: string;
  r1_occupant_id?: string;
  r1_notes?: string;
  r2_status?: RoomStatus;
  r2_occupant_name?: string;
  r2_occupant_id?: string;
  r2_notes?: string;
  r3_status?: RoomStatus;
  r3_occupant_name?: string;
  r3_occupant_id?: string;
  r3_notes?: string;
};

const CACHE_KEY = "houses:list";

function fromDjango(row: any): House {
  return {
    id:             String(row.id),
    house_id:       row.house_id       ?? "",
    house_number:   row.house_number   ?? "",
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
    inside_items:    row.inside_items    ?? [],
    description:    row.description    ?? "",
    capacity:       row.capacity       ?? 1,
    allocation_category: row.allocation_category ?? "R",
    allocation_status: row.allocation_status ?? "Unassigned",
    assigned_employee_id: row.assigned_employee_id ?? null,
    assigned_employee_name: row.assigned_employee_name ?? null,
    assigned_application_no: row.assigned_application_no ?? null,
    current_occupancy: row.current_occupancy ?? 0,
    vacant: row.vacant ?? row.capacity ?? 1,
    is_available: row.is_available ?? (row.status === "Active"),
    room_vacant_count: row.room_vacant_count ?? row.vacant ?? 0,
    available_rooms: row.available_rooms ?? [],
    is_fully_vacant: row.is_fully_vacant ?? false,
    room_count: row.room_count ?? 1,
    room_labels: row.room_labels ?? ["R1"],
    r1_status: row.r1_status ?? "Vacant",
    r1_occupant_name: row.r1_occupant_name ?? "",
    r1_occupant_id: row.r1_occupant_id ?? "",
    r1_notes: row.r1_notes ?? "",
    r2_status: row.r2_status ?? "Vacant",
    r2_occupant_name: row.r2_occupant_name ?? "",
    r2_occupant_id: row.r2_occupant_id ?? "",
    r2_notes: row.r2_notes ?? "",
    r3_status: row.r3_status ?? "Vacant",
    r3_occupant_name: row.r3_occupant_name ?? "",
    r3_occupant_id: row.r3_occupant_id ?? "",
    r3_notes: row.r3_notes ?? "",
    rooms: row.rooms ?? [],
    rooms_summary: row.rooms_summary ?? { total: 1, occupied: 0, vacant: 1, reserved: 0, maintenance: 0, labels: ["R1"], details: [] },
    created_at:     row.created_at,
    updated_at:     row.updated_at,
    is_active:      row.is_active,
  };
}

export async function listHouses(options?: { force?: boolean }): Promise<House[]> {
  return getCachedValue(CACHE_KEY, async () => {
    const res = await djangoRequest<any>("/houses/?page_size=500");
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      return raw.map(fromDjango);
    }
    throw new Error(res.message || "Failed to fetch houses");
  }, { force: options?.force });
}

export async function getHouse(id: string): Promise<House> {
  const res = await djangoRequest<any>(`/houses/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch house");
}

export async function createHouse(data: HouseFormData): Promise<House> {
  const payload = data;
  const res = await djangoRequest<any>("/houses/", {
    method: "POST",
    body: JSON.stringify(payload),
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
  const payload = data;
  const res = await djangoRequest<any>(`/houses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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
export const ROOM_STATUSES: RoomStatus[] = ["Vacant", "Occupied", "Reserved", "Maintenance"];
export const ALLOCATION_CATEGORY_OPTIONS: { value: AllocationCategory; label: string }[] = [
  { value: "R", label: "Regular" },
  { value: "G", label: "Guest" },
];
export const HOUSE_TYPE_ROOMS: Record<HouseType, number> = {
  Staff: 3,
  A: 3,
  B: 3,
  C: 2,
  D: 1,
  E: 1,
};
export const HOUSE_TYPE_ROOM_LABELS: Record<HouseType, string[]> = {
  Staff: ["R1", "R2", "R3"],
  A:     ["R1", "R2", "R3"],
  B:     ["R1", "R2", "R3"],
  C:     ["R1", "R2"],
  D:     ["R1"],
  E:     ["R1"],
};
export const ROOM_STATUS_STYLES: Record<string, string> = {
  Vacant:   "border-emerald-300/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800/60 dark:text-emerald-400",
  Occupied: "border-rose-300/40 bg-rose-500/10 text-rose-700 dark:border-rose-800/60 dark:text-rose-400",
  Reserved: "border-amber-300/40 bg-amber-500/10 text-amber-700 dark:border-amber-800/60 dark:text-amber-400",
  Maintenance: "border-slate-300/40 bg-slate-500/10 text-slate-700 dark:border-slate-800/60 dark:text-slate-400",
};
export const DAMAGE_OPTIONS: { key: DamagedItemKey; label: string }[] = [
  { key: "damaged_door",    label: "Door" },
  { key: "damaged_windows", label: "Windows" },
  { key: "damaged_walls",   label: "Walls" },
  { key: "damaged_switch",  label: "Switch" },
  { key: "damaged_bulb",    label: "Bulb" },
  { key: "damaged_water",   label: "Water" },
];
