import { djangoRequest } from "./djangoAuth";
import { invalidateCache } from "@/lib/data-cache";

export type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Verified"
  | "Waiting for Allocation"
  | "Allocated"
  | "Rejected"
  | "Returned";

export type HouseApplication = {
  id: string;
  application_no: string;
  requester: string;
  requester_name?: string;
  employee_id: string;
  employee_name: string;
  national_id: string;
  gender: string;
  job_position: string;
  job_grade: string;
  job_type: string;
  years_of_service: number;
  marital_status: string;
  has_disability: boolean;
  family_size: number;
  number_of_children: number;
  requested_house_category: string;
  eligible_house_category?: string;
  priority_score: number;
  queue_position?: number | null;
  reason_for_request: string;
  preferred_location: string;
  supporting_document: string | null;
  status: ApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name?: string | null;
  allocated_house?: string | null;
  allocated_house_id?: string | null;
  allocated_at: string | null;
  allocated_by?: string | null;
  allocated_by_name?: string | null;
  rejection_reason: string;
  returned_reason: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type ApplicationFormData = {
  employee_id: string;
  employee_name: string;
  national_id: string;
  gender: string;
  job_position: string;
  job_grade?: string;
  job_type?: string;
  years_of_service: number;
  marital_status: string;
  has_disability: boolean;
  family_size: number;
  position_type: string;
  requested_house_category: string;
  reason_for_request?: string;
  preferred_location?: string;
  supporting_document?: File | null;
  status?: ApplicationStatus;
};

export type ApplicationDashboardCounts = {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  verified: number;
  waiting_for_allocation: number;
  allocated: number;
  rejected: number;
  returned: number;
};

export type ScoringConfig = {
  id: string;
  name: string;
  job_grade_weight: number;
  years_of_service_weight: number;
  family_size_weight: number;
  disability_weight: number;
  fifo_weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AllocationLog = {
  id: string;
  application: string;
  application_no: string;
  employee_name: string;
  house: string | null;
  house_id: string | null;
  action: string;
  priority_score: number;
  eligible_category: string;
  notes: string;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
};

function fromDjango(row: any): HouseApplication {
  return {
    id: String(row.id),
    application_no: row.application_no ?? "",
    requester: row.requester ? String(row.requester) : "",
    requester_name: row.requester_name ?? "",
    employee_id: row.employee_id ?? "",
    employee_name: row.employee_name ?? "",
    national_id: row.national_id ?? "",
    gender: row.gender ?? "",
    job_position: row.job_position ?? "",
    job_grade: row.job_grade ?? "",
    job_type: row.job_type ?? "Permanent",
    years_of_service: row.years_of_service ?? 0,
    marital_status: row.marital_status ?? "Single",
    has_disability: row.has_disability ?? false,
    family_size: row.family_size ?? 1,
    number_of_children: row.number_of_children ?? 0,
    requested_house_category: row.requested_house_category ?? "Staff",
    eligible_house_category: row.eligible_house_category ?? "",
    priority_score: Number(row.priority_score) ?? 0,
    queue_position: row.queue_position ?? null,
    reason_for_request: row.reason_for_request ?? "",
    preferred_location: row.preferred_location ?? "",
    supporting_document: row.supporting_document ?? null,
    status: row.status ?? "Draft",
    submitted_at: row.submitted_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_by_name: row.reviewed_by_name ?? null,
    allocated_house: row.allocated_house ? String(row.allocated_house) : null,
    allocated_house_id: row.allocated_house_hid ?? null,
    allocated_at: row.allocated_at ?? null,
    allocated_by: row.allocated_by ? String(row.allocated_by) : null,
    allocated_by_name: row.allocated_by_name ?? null,
    rejection_reason: row.rejection_reason ?? "",
    returned_reason: row.returned_reason ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    is_active: row.is_active ?? true,
  };
}

export async function listApplications(): Promise<HouseApplication[]> {
  const res = await djangoRequest<any>("/houses/applications/?page_size=500");
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw.map(fromDjango);
  }
  throw new Error(res.message || "Failed to fetch applications");
}

export async function getApplication(id: string): Promise<HouseApplication> {
  const res = await djangoRequest<any>(`/houses/applications/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch application");
}

export async function createApplication(data: FormData): Promise<HouseApplication> {
  const res = await djangoRequest<any>("/houses/applications/", {
    method: "POST",
    body: data,
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to create application");
}

export async function updateApplication(id: string, data: FormData): Promise<HouseApplication> {
  const res = await djangoRequest<any>(`/houses/applications/${id}/`, {
    method: "PATCH",
    body: data,
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  const detail = res.errors
    ? Object.entries(res.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || res.message || "Failed to update application");
}

export async function submitApplication(id: string): Promise<HouseApplication> {
  const res = await djangoRequest<any>(`/houses/applications/${id}/submit/`, {
    method: "POST",
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  throw new Error(res.message || "Failed to submit application");
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  reason?: string,
): Promise<HouseApplication> {
  const body: any = { status };
  if (status === "Rejected" && reason) body.rejection_reason = reason;
  if (status === "Returned" && reason) body.returned_reason = reason;
  const res = await djangoRequest<any>(`/houses/applications/${id}/status/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  throw new Error(res.message || "Failed to update application status");
}

export async function deleteApplication(id: string): Promise<void> {
  const res = await djangoRequest<void>(`/houses/applications/${id}/`, { method: "DELETE" });
  if (res.success) {
    invalidateCache("applications:list");
    return;
  }
  throw new Error(res.message || "Failed to delete application");
}

export async function getApplicationDashboard(): Promise<ApplicationDashboardCounts> {
  const res = await djangoRequest<any>("/houses/applications/dashboard/");
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to fetch dashboard data");
}

// ── Queue & Allocation API ────────────────────────────────────────────

export async function getRankedQueue(category?: string): Promise<HouseApplication[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await djangoRequest<any>(`/houses/queue/${qs}`);
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw.map(fromDjango);
  }
  throw new Error(res.message || "Failed to fetch queue");
}

export async function autoAllocateHouse(houseId: string, applicationId?: string): Promise<HouseApplication> {
  const res = await djangoRequest<any>("/houses/auto-allocate/", {
    method: "POST",
    body: JSON.stringify({ house_id: houseId, ...(applicationId ? { application_id: applicationId } : {}) }),
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  throw new Error(res.message || "Failed to auto-allocate house");
}

export interface BatchAllocateResult {
  house_id: string;
  house_number: string;
  house_type: string;
  allocated_to: string | null;
  application_no: string | null;
  score: string | null;
}

export async function batchAllocateAll(): Promise<{
  allocated: BatchAllocateResult[];
  skipped: BatchAllocateResult[];
  total_houses: number;
}> {
  const res = await djangoRequest<any>("/houses/batch-allocate/", {
    method: "POST",
  });
  if (res.success) {
    invalidateCache("applications:list");
    invalidateCache("houses:list");
    return res.data;
  }
  throw new Error(res.message || "Failed to batch allocate houses");
}

export async function recalculateApplicationScore(applicationId: string): Promise<HouseApplication> {
  await djangoRequest<any>("/houses/queue/?recalculate=true", { method: "GET" });
  const app = await getApplication(applicationId);
  invalidateCache("applications:list");
  return app;
}

export async function manualAllocateHouse(
  houseId: string,
  applicationId: string,
  notes?: string,
): Promise<HouseApplication> {
  const res = await djangoRequest<any>("/houses/manual-allocate/", {
    method: "POST",
    body: JSON.stringify({ house_id: houseId, application_id: applicationId, notes }),
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  throw new Error(res.message || "Failed to manually allocate house");
}

export async function deallocateHouse(applicationId: string, notes?: string): Promise<HouseApplication> {
  const res = await djangoRequest<any>("/houses/deallocate/", {
    method: "POST",
    body: JSON.stringify({ application_id: applicationId, notes }),
  });
  if (res.success) {
    invalidateCache("applications:list");
    return fromDjango(res.data);
  }
  throw new Error(res.message || "Failed to deallocate house");
}

// ── Scoring Config API ────────────────────────────────────────────────

export async function listScoringConfigs(): Promise<ScoringConfig[]> {
  const res = await djangoRequest<any>("/houses/scoring-config/");
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw;
  }
  throw new Error(res.message || "Failed to fetch scoring configs");
}

export async function createScoringConfig(data: Partial<ScoringConfig>): Promise<ScoringConfig> {
  const res = await djangoRequest<any>("/houses/scoring-config/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to create scoring config");
}

export async function updateScoringConfig(id: string, data: Partial<ScoringConfig>): Promise<ScoringConfig> {
  const res = await djangoRequest<any>(`/houses/scoring-config/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data;
  throw new Error(res.message || "Failed to update scoring config");
}

// ── Allocation Logs API ───────────────────────────────────────────────

export async function listAllocationLogs(): Promise<AllocationLog[]> {
  const res = await djangoRequest<any>("/houses/allocation-logs/?page_size=500");
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw;
  }
  throw new Error(res.message || "Failed to fetch allocation logs");
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Verified",
  "Waiting for Allocation",
  "Allocated",
  "Rejected",
  "Returned",
];

export const HOUSE_CATEGORIES = ["Staff", "A", "B", "C", "D", "E"];

export const GENDER_OPTIONS = ["Male", "Female"];

export const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed"];

export const POSITION_TYPE_OPTIONS = ["Permanent", "Seasonal", "Half Permanent", "PPL"];

export const JOB_TYPE_OPTIONS = ["Permanent", "Semi Permanent", "Seasonal"];

// ── Employee Validation ────────────────────────────────────────────────

/**
 * Check if an employee_id exists in the employees table.
 * Returns { valid, employee_name? } so the form can auto-fill the name.
 */
export async function validateEmployeeId(employeeId: string): Promise<{ valid: boolean; employee_name?: string }> {
  const trimmed = employeeId.trim();
  if (!trimmed) return { valid: false };
  try {
    const res = await djangoRequest<any>(`/employees/?search=${encodeURIComponent(trimmed)}&page_size=5`);
    if (res.success) {
      const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const match = rows.find((e: any) => (e.employee_id || "").toLowerCase() === trimmed.toLowerCase());
      if (match) {
        return { valid: true, employee_name: match.full_name || "" };
      }
    }
  } catch { /* ignore — backend validation will catch it */ }
  return { valid: false };
}
