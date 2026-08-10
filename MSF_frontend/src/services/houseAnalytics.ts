/**
 * Housing analytics service – talks to Django REST /api/houses/analytics/, /occupancy/, /available/
 */
import { djangoRequest } from "./djangoAuth.ts";
import { getCachedValue } from "@/lib/data-cache";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertKind = string;

export type HousingAlert = {
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  detail: string;
  application_id?: string;
};

export type Kpis = {
  total_houses: number;
  active_houses: number;
  inactive_houses: number;
  total_capacity: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_rate: number;
  available_houses: number;
  total_applications: number;
  waiting_for_allocation: number;
  allocated: number;
  under_review: number;
  verified: number;
  submitted: number;
  rejected: number;
  guest_houses: number;
  active_contracts: number;
  monthly_rent_revenue: number;
  outstanding_rent: number;
  open_maintenance: number;
  pending_transfers: number;
};

export type OccupancyByTypeRow = {
  total: number;
  active: number;
  capacity: number;
  occupied: number;
  vacant: number;
  occupancy_rate: number;
};

export type OccupancyByType = Record<string, OccupancyByTypeRow>;

export type QueueStats = {
  waiting: number;
  verified: number;
  count: number;
  avg_days: number;
  max_days: number;
  longest: number | null;
};

export type AllocationTrendPoint = {
  date: string;
  auto: number;
  manual: number;
  override: number;
  transfer: number;
  total: number;
};

export type AlertsSummary = {
  critical: number;
  warning: number;
  info: number;
  items: HousingAlert[];
};

export type HousingAnalytics = {
  kpis: Kpis;
  occupancy_by_type: OccupancyByType;
  applications_by_status: Record<string, number>;
  eligible_by_category: Record<string, number>;
  queue_stats: QueueStats;
  allocation_trend_30d: AllocationTrendPoint[];
  allocation_actions: Record<string, number>;
  alerts: AlertsSummary;
};

export type AvailableCandidate = {
  application_id: string;
  application_no: string;
  employee_id: string;
  employee_name: string;
  eligible_category: string;
  score: number;
  closeness: number;
  constraint_ok: boolean;
  constraint_reason: string;
  reasons: string[];
};

export type AvailableHouse = {
  house_id: string;
  hid: string;
  house_number: string;
  house_type: string;
  location: string;
  capacity: number;
  current_occupancy: number;
  vacant: number;
  allocation_category: string;
  damaged_items: string[];
  recommended_candidate: AvailableCandidate | null;
};

export type OccupantInfo = {
  application_id: string;
  application_no: string;
  employee_id: string;
  employee_name: string;
  allocated_at: string | null;
  allocated_by: string | null;
};

export type OccupancyRow = {
  house_id: string;
  hid: string;
  house_number: string;
  house_type: string;
  location: string;
  allocation_category: string;
  status: string;
  capacity: number;
  current_occupancy: number;
  vacant: number;
  occupants: OccupantInfo[];
};

const ANALYTICS_CACHE = "houses:analytics";

export async function getHousingAnalytics(options?: { force?: boolean }): Promise<HousingAnalytics> {
  return getCachedValue(
    ANALYTICS_CACHE,
    async () => {
      const res = await djangoRequest<any>("/houses/analytics/");
      if (res.success) return res.data as HousingAnalytics;
      throw new Error(res.message || "Failed to fetch housing analytics");
    },
    { force: options?.force },
  );
}

export async function getAvailableHouses(options?: { force?: boolean }): Promise<AvailableHouse[]> {
  return getCachedValue(
    "houses:analytics:available",
    async () => {
      const res = await djangoRequest<any>("/houses/analytics/available/");
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw as AvailableHouse[];
      }
      throw new Error(res.message || "Failed to fetch available houses");
    },
    { force: options?.force },
  );
}

export async function getOccupancy(options?: { house_type?: string; status?: string; force?: boolean }): Promise<OccupancyRow[]> {
  const qs = new URLSearchParams();
  if (options?.house_type) qs.set("house_type", options.house_type);
  if (options?.status) qs.set("status", options.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getCachedValue(
    `houses:occupancy:${suffix || "all"}`,
    async () => {
      const res = await djangoRequest<any>(`/houses/occupancy/${suffix}`);
      if (res.success) {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw as OccupancyRow[];
      }
      throw new Error(res.message || "Failed to fetch occupancy");
    },
    { force: options?.force },
  );
}

export function invalidateHousingAnalyticsCache(): void {
  import("@/lib/data-cache").then((m) => {
    m.invalidateCache(ANALYTICS_CACHE);
    m.invalidateCache("houses:analytics:available");
  });
}
