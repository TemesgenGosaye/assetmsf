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
  years_of_service: number;
  marital_status: string;
  has_disability: boolean;
  family_size: number;
  number_of_children: number;
  requested_house_category: string;
  reason_for_request: string;
  preferred_location: string;
  supporting_document: string | null;
  status: ApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name?: string | null;
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
  years_of_service: number;
  marital_status: string;
  has_disability: boolean;
  family_size: number;
  number_of_children: number;
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
    years_of_service: row.years_of_service ?? 0,
    marital_status: row.marital_status ?? "Single",
    has_disability: row.has_disability ?? false,
    family_size: row.family_size ?? 1,
    number_of_children: row.number_of_children ?? 0,
    requested_house_category: row.requested_house_category ?? "Staff",
    reason_for_request: row.reason_for_request ?? "",
    preferred_location: row.preferred_location ?? "",
    supporting_document: row.supporting_document ?? null,
    status: row.status ?? "Draft",
    submitted_at: row.submitted_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_by_name: row.reviewed_by_name ?? null,
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
