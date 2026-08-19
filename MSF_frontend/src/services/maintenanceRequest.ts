/**
 * Maintenance Request service – talks to Django REST /api/houses/maintenance-requests/
 * Supports applicant submission, personal request tracking, and civil work department panel.
 */
import { djangoRequest } from "./djangoAuth";

export type MaintenancePriority = "Low" | "Medium" | "High" | "Emergency";
export type MaintenanceStatus =
  | "Submitted"
  | "Received"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Rejected"
  | "Cancelled";
export type MaintenanceCategory =
  | "Plumbing"
  | "Electrical"
  | "Structural"
  | "Roofing"
  | "Painting"
  | "Flooring"
  | "Door & Window"
  | "Water Supply"
  | "Drainage"
  | "General"
  | "Other";

export type MaintenanceRequest = {
  id: string;
  request_number: string;
  house: string;
  house_hid: string;
  house_number: string;
  house_location: string;
  house_type: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_email: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  received_by: string | null;
  received_by_name: string;
  received_at: string | null;
  civil_work_assigned_to: string | null;
  civil_work_assigned_to_name: string;
  civil_work_notes: string;
  rejection_reason: string;
  resolution_notes: string;
  estimated_cost: number;
  actual_cost: number;
  resolved_at: string | null;
  completion_date: string | null;
  logs: MaintenanceRequestLog[];
  created_at: string;
  updated_at: string;
};

export type MaintenanceRequestLog = {
  id: string;
  event_type: string;
  actor: string | null;
  actor_name: string;
  actor_name_display: string;
  old_value: string;
  new_value: string;
  note: string;
  created_at: string;
};

export type CivilWorkStats = {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  avg_resolution_hours: number | null;
  overdue_count: number;
};

// ── Applicant: Submit Maintenance Request ──────────────────────────────

export async function submitMaintenanceRequest(input: {
  house: string;
  title: string;
  description: string;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
}): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>("/houses/maintenance-requests/submit/", {
    method: "POST",
    body: JSON.stringify({
      house: input.house,
      title: input.title,
      description: input.description,
      category: input.category || "General",
      priority: input.priority || "Medium",
    }),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to submit maintenance request");
}

// ── Applicant: List My Requests ────────────────────────────────────────

export async function listMyMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const res = await djangoRequest<any>("/houses/maintenance-requests/my/");
  if (res.success) {
    return Array.isArray(res.data) ? res.data : [];
  }
  throw new Error(res.message || "Failed to fetch your maintenance requests");
}

// ── Civil Work: List All Requests (panel) ──────────────────────────────

export async function listCivilWorkRequests(filters?: {
  status?: string;
  priority?: string;
  category?: string;
}): Promise<MaintenanceRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();
  const res = await djangoRequest<any>(`/houses/civil-work/panel/${qs ? "?" + qs : ""}`);
  if (res.success) {
    return Array.isArray(res.data) ? res.data : [];
  }
  throw new Error(res.message || "Failed to fetch civil work requests");
}

// ── Civil Work: Get Single Request Detail ──────────────────────────────

export async function getMaintenanceRequestDetail(id: string): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>(`/houses/maintenance-requests/${id}/`);
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to fetch request details");
}

// ── Civil Work: Receive Request ────────────────────────────────────────

export async function receiveMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>(`/houses/civil-work/${id}/receive/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to receive request");
}

// ── Civil Work: Assign Request ────────────────────────────────────────

export async function assignMaintenanceRequest(
  id: string,
  assigneeId: string
): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>(`/houses/civil-work/${id}/assign/`, {
    method: "POST",
    body: JSON.stringify({ civil_work_assigned_to: assigneeId }),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to assign request");
}

// ── Civil Work: Update Request ────────────────────────────────────────

export async function updateMaintenanceRequest(
  id: string,
  patch: Partial<Pick<MaintenanceRequest, "status" | "priority" | "civil_work_notes" | "rejection_reason" | "resolution_notes" | "actual_cost" | "estimated_cost" | "category">>
): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>(`/houses/civil-work/${id}/update/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to update request");
}

// ── Civil Work: Get Stats ──────────────────────────────────────────────

export async function getCivilWorkStats(): Promise<CivilWorkStats> {
  const res = await djangoRequest<any>("/houses/civil-work/stats/");
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to fetch stats");
}

// ── List available houses for the current applicant ────────────────────

export async function listMyAllocatedHouses(): Promise<Array<{ id: string; house_id: string; house_number: string; location: string; house_type: string }>> {
  const res = await djangoRequest<any>("/houses/allocations/?status=Active");
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    const houses = raw
      .filter((a: any) => a.status === "Active")
      .map((a: any) => ({
        id: a.house || a.house_id,
        house_id: a.house_hid || a.house_id || "",
        house_number: a.house_number || "",
        location: a.house_location || "",
        house_type: a.house_type || "",
      }));
    // Deduplicate by house id
    const seen = new Set<string>();
    return houses.filter((h: any) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });
  }
  return [];
}

// ── List civil work team members for assignment ────────────────────────

export async function listCivilWorkTeam(): Promise<Array<{ id: string; name: string; email: string }>> {
  const res = await djangoRequest<any>("/auth/users/?department=CIVIL&page_size=200");
  if (res.success) {
    const users = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return users
      .filter((u: any) => (u.status || "").toLowerCase() === "active")
      .map((u: any) => ({
        id: String(u.id),
        name: u.name || u.email,
        email: u.email,
      }));
  }
  // Fallback: list all active users
  const allRes = await djangoRequest<any>("/auth/users/?page_size=200");
  if (allRes.success) {
    const users = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.results ?? []);
    return users
      .filter((u: any) =>
        (u.status || "").toLowerCase() === "active" &&
        ["admin", "manager", "field_staff", "SUPER_ADMIN"].includes(u.role)
      )
      .map((u: any) => ({
        id: String(u.id),
        name: u.name || u.email,
        email: u.email,
      }));
  }
  return [];
}
