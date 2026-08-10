/**
 * Maintenance schedules service – preventive maintenance scheduling.
 * Talks to Django REST /api/maintenance/schedules/ and /api/maintenance/analytics/
 */
import { djangoRequest } from "./djangoAuth";

export type MaintenanceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type MaintenanceSchedule = {
  id: string;
  asset: string;
  asset_name: string;
  asset_code: string;
  name: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  start_date: string;
  end_date: string | null;
  last_performed: string | null;
  next_due: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  estimated_duration_hours: number | null;
  is_active: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
};

export type MaintenanceAnalytics = {
  totals: {
    total_tickets: number;
    open_tickets: number;
    overdue_tickets: number;
    resolved_total: number;
    closed_30d: number;
    resolved_30d: number;
    sla_breached: number;
    estimated_cost: number;
    actual_cost: number;
    avg_resolution_hours: number | null;
    schedules_due: number;
    schedules_overdue: number;
  };
  status_breakdown: { key: string; label: string; count: number }[];
  priority_breakdown: { key: string; label: string; count: number; cost: number }[];
};

export async function fetchMaintenanceSchedules(options?: {
  force?: boolean;
  asset?: string;
}): Promise<MaintenanceSchedule[]> {
  const params = new URLSearchParams();
  if (options?.asset) params.set("asset", options.asset);
  if (options?.force) params.set("force", "1");
  const query = params.toString();
  const response = await djangoRequest<any>(
    `/maintenance/schedules/${query ? `?${query}` : ""}`,
  );
  if (response.success) {
    return response.data?.results || response.data || [];
  }
  throw new Error(response.message || "Failed to fetch maintenance schedules");
}

export async function performMaintenanceSchedule(
  id: string,
): Promise<MaintenanceSchedule> {
  const response = await djangoRequest<any>(
    `/maintenance/schedules/${id}/perform/`,
    { method: "POST" },
  );
  if (response.success) return response.data as MaintenanceSchedule;
  throw new Error(response.message || "Failed to mark schedule as performed");
}

export type MaintenanceScheduleCreatePayload = {
  asset: string;
  name: string;
  description?: string;
  frequency: MaintenanceFrequency;
  start_date: string;
  end_date?: string | null;
  assigned_to?: string | null;
  estimated_duration_hours?: number | null;
};

export async function createMaintenanceSchedule(
  payload: MaintenanceScheduleCreatePayload,
): Promise<MaintenanceSchedule> {
  const response = await djangoRequest<any>(`/maintenance/schedules/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (response.success) return response.data as MaintenanceSchedule;
  const fieldErrors = response.errors
    ? Object.entries(response.errors)
        .map(([field, msgs]) =>
          `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}`,
        )
        .join("; ")
    : "";
  throw new Error(
    fieldErrors
      ? `${response.message}: ${fieldErrors}`
      : response.message || "Failed to create schedule",
  );
}

export async function fetchMaintenanceAnalytics(): Promise<MaintenanceAnalytics> {
  const response = await djangoRequest<any>(`/maintenance/analytics/`);
  if (response.success) return response.data as MaintenanceAnalytics;
  throw new Error(response.message || "Failed to fetch maintenance analytics");
}
