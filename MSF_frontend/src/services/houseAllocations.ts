/**
 * House Allocations service – talks to Django REST /api/houses/allocations/
 *
 * The Allocated House module is powered by authoritative `Allocation` records
 * (single source of truth for occupancy, availability and audit).
 */
import { djangoRequest } from "./djangoAuth.ts";
import {
  getCachedValue,
  invalidateCacheByPrefix,
  setCachedValue,
  peekCachedValue,
} from "@/lib/data-cache";

export type AllocationStatus = "Active" | "Terminated" | "Reallocated";
export type OccupancyStatus = "Pending" | "Occupied" | "Vacated";
export type AllocationType = "Auto" | "Manual" | "Override";

export type AllocationEmployee = { id: string; name: string } | null;

export type HouseAllocation = {
  id: string;
  allocation_no: string;
  application: string;
  application_no: string;
  house: string;
  house_id: string;
  house_number: string;
  house_type: string;
  house_location: string;
  employee: AllocationEmployee;
  employee_id: string;
  employee_name: string;
  allocation_type: AllocationType;
  priority_score: number;
  recommendation_score: number;
  confidence: number;
  recommendation_reason: string;
  status: AllocationStatus;
  occupancy_status: OccupancyStatus;
  allocated_at: string;
  effective_date: string | null;
  allocated_by: string | null;
  allocated_by_name: string;
  override_reason: string;
  notes: string;
  previous_allocation: string | null;
  terminated_at: string | null;
  terminated_by: string | null;
  terminated_by_name: string;
  termination_reason: string;
  opportunity_id: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type AllocationFilters = {
  search?: string;
  status?: AllocationStatus;
  allocation_type?: AllocationType;
  occupancy_status?: OccupancyStatus;
  ordering?: string;
};

export type AllocatePayload = {
  house_id: string;
  application_id: string;
  allocation_type?: AllocationType;
  notes?: string;
  override_reason?: string;
};

const CACHE_KEY = "houses:allocations";

function fromDjango(row: any): HouseAllocation {
  return {
    id: String(row.id),
    allocation_no: row.allocation_no ?? "",
    application: String(row.application ?? ""),
    application_no: row.application_no ?? "",
    house: String(row.house ?? ""),
    house_id: row.house_id ?? "",
    house_number: row.house_number ?? "",
    house_type: row.house_type ?? "",
    house_location: row.house_location ?? "",
    employee: row.employee ?? null,
    employee_id: row.employee_id ?? "",
    employee_name: row.employee_name ?? "",
    allocation_type: row.allocation_type ?? "Manual",
    priority_score: Number(row.priority_score ?? 0),
    recommendation_score: Number(row.recommendation_score ?? 0),
    confidence: Number(row.confidence ?? 0),
    recommendation_reason: row.recommendation_reason ?? "",
    status: row.status ?? "Active",
    occupancy_status: row.occupancy_status ?? "Pending",
    allocated_at: row.allocated_at ?? "",
    effective_date: row.effective_date ?? null,
    allocated_by: row.allocated_by ?? null,
    allocated_by_name: row.allocated_by_name ?? "",
    override_reason: row.override_reason ?? "",
    notes: row.notes ?? "",
    previous_allocation: row.previous_allocation ?? null,
    terminated_at: row.terminated_at ?? null,
    terminated_by: row.terminated_by ?? null,
    terminated_by_name: row.terminated_by_name ?? "",
    termination_reason: row.termination_reason ?? "",
    opportunity_id: row.opportunity_id ?? null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    is_active: row.is_active ?? true,
  };
}

function buildQuery(filters?: AllocationFilters): string {
  const qs = new URLSearchParams();
  qs.set("page_size", "500");
  if (filters?.search) qs.set("search", filters.search);
  if (filters?.status) qs.set("status", filters.status);
  if (filters?.allocation_type) qs.set("allocation_type", filters.allocation_type);
  if (filters?.occupancy_status) qs.set("occupancy_status", filters.occupancy_status);
  if (filters?.ordering) qs.set("ordering", filters.ordering);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

export async function listAllocations(options?: {
  filters?: AllocationFilters;
  force?: boolean;
}): Promise<HouseAllocation[]> {
  const query = buildQuery(options?.filters);
  return getCachedValue(
    `${CACHE_KEY}:${query}`,
    async () => {
      const res = await djangoRequest<any>(`/houses/allocations/${query}`);
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw.map(fromDjango);
      }
      throw new Error(res.message || "Failed to fetch allocations");
    },
    { force: options?.force },
  );
}

export async function getAllocation(id: string): Promise<HouseAllocation> {
  const res = await djangoRequest<any>(`/houses/allocations/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch allocation");
}

export async function allocateHouse(payload: AllocatePayload): Promise<HouseAllocation> {
  const res = await djangoRequest<any>("/houses/allocate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.success) {
    const allocation = fromDjango(res.data);
    invalidateCacheByPrefix(CACHE_KEY);
    invalidateCacheByPrefix("houses:analytics");
    return allocation;
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to allocate house");
}

export async function terminateAllocation(
  id: string,
  payload: { notes?: string; reason?: string; move_to_queue?: boolean } = {},
): Promise<HouseAllocation> {
  const res = await djangoRequest<any>(`/houses/allocations/${id}/terminate/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.success) {
    const allocation = fromDjango(res.data);
    const existing = peekCachedValue<HouseAllocation[]>(CACHE_KEY);
    if (existing) {
      setCachedValue(
        CACHE_KEY,
        existing.map((a) => (a.id === allocation.id ? allocation : a)),
      );
    } else {
      invalidateCacheByPrefix(CACHE_KEY);
    }
    invalidateCacheByPrefix("houses:analytics");
    return allocation;
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to terminate allocation");
}

export function invalidateAllocationsCache(): void {
  invalidateCacheByPrefix(CACHE_KEY);
}

export const ALLOCATION_TYPE_OPTIONS: { value: AllocationType; label: string }[] = [
  { value: "Auto", label: "Auto" },
  { value: "Manual", label: "Manual" },
  { value: "Override", label: "Override" },
];

export const ALLOCATION_STATUS_OPTIONS: { value: AllocationStatus; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Terminated", label: "Terminated" },
  { value: "Reallocated", label: "Reallocated" },
];

export const OCCUPANCY_STATUS_OPTIONS: { value: OccupancyStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Occupied", label: "Occupied" },
  { value: "Vacated", label: "Vacated" },
];
