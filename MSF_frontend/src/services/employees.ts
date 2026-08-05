/**
 * Employee service – talks to Django REST /api/employees/
 */
import { djangoRequest, API_BASE_URL } from "./djangoAuth";
import { invalidateCache, getCachedValue } from "@/lib/data-cache";

export type Employee = {
  id: string;
  employee_id: string;
  full_name: string;
  names: string;
  national_id: string;
  job_position: string;
  job_grade: string;
  job_type: string;
  department: string | null;         // UUID of department FK
  department_name: string | null;
  hire_date: string | null;
  service_years: number;
  family_size: number;
  marital_status: string;
  has_disability: boolean;
  status: "Active" | "On Leave" | "Terminated";
  cv_file: string | null;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
};

export type EmployeeFormData = {
  full_name: string;
  names: string;
  national_id: string;
  job_position: string;
  job_grade: string;
  job_type: string;
  department: string | null;  // UUID
  hire_date: string | null;
  family_size: number;
  has_disability: boolean;
  status: "Active" | "On Leave" | "Terminated";
  cv_file?: File | null;
};

export type BulkImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const CACHE_KEY = "employees:list";
const CACHE_TTL = 30_000; // 30s — short enough to stay fresh

/** Converts Django snake_case response to our Employee type */
function fromDjango(row: any): Employee {
  return {
    id: String(row.id),
    employee_id: row.employee_id ?? "",
    full_name: row.full_name ?? "",
    names: row.names ?? "",
    national_id: row.national_id ?? "",
    job_position: row.job_position ?? "",
    job_grade: row.job_grade ?? "",
    job_type: row.job_type ?? "Permanent",
    department: row.department ? String(row.department) : null,
    department_name: row.department_name ?? null,
    hire_date: row.hire_date ?? null,
    service_years: row.service_years ?? 0,
    family_size: row.family_size ?? 0,
    marital_status: row.marital_status ?? "Single",
    has_disability: !!row.has_disability,
    status: row.status ?? "Active",
    cv_file: row.cv_file ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active,
  };
}

/** Builds FormData for multipart POST/PUT (supports cv_file upload) */
function toFormData(data: EmployeeFormData): FormData {
  const fd = new FormData();
  fd.append("full_name", data.full_name);
  fd.append("names", data.names ?? "");
  fd.append("national_id", data.national_id);
  fd.append("job_position", data.job_position);
  fd.append("job_grade", data.job_grade ?? "");
  fd.append("job_type", data.job_type ?? "Permanent");
  if (data.department) fd.append("department", data.department);
  if (data.hire_date) fd.append("hire_date", data.hire_date);
  fd.append("family_size", String(data.family_size ?? 0));
  fd.append("has_disability", data.has_disability ? "true" : "false");
  fd.append("status", data.status);
  if (data.cv_file instanceof File) {
    fd.append("cv_file", data.cv_file);
  }
  return fd;
}

export async function listEmployees(opts?: { force?: boolean }): Promise<Employee[]> {
  return getCachedValue(
    CACHE_KEY,
    async () => {
      // Request a large page to get all employees in one call
      const res = await djangoRequest<any>("/employees/?page_size=500");
      if (res.success) {
        // Handle both paginated ({data: [...]}) and flat array responses
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        return raw.map(fromDjango);
      }
      throw new Error(res.message || "Failed to fetch employees");
    },
    { ttlMs: CACHE_TTL, force: opts?.force }
  );
}

export async function getEmployee(id: string): Promise<Employee> {
  const res = await djangoRequest<any>(`/employees/${id}/`);
  if (res.success) return fromDjango(res.data);
  throw new Error(res.message || "Failed to fetch employee");
}

export async function createEmployee(data: EmployeeFormData): Promise<Employee> {
  const token = localStorage.getItem("django_access_token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let body: FormData | string;
  if (data.cv_file instanceof File) {
    // Multipart only when there's a file — DRF handles booleans as "true"/"false" strings here
    const fd = toFormData(data);
    body = fd;
  } else {
    // Use JSON for non-file submissions — avoids boolean string parsing issues
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      full_name: data.full_name,
      names: data.names ?? "",
      national_id: data.national_id,
      job_position: data.job_position,
      job_grade: data.job_grade ?? "",
      job_type: data.job_type ?? "Permanent",
      department: data.department ?? null,
      hire_date: data.hire_date ?? null,
      family_size: data.family_size ?? 0,
      has_disability: Boolean(data.has_disability),
      status: data.status,
    });
  }

  const response = await fetch(`${API_BASE_URL}/employees/`, {
    method: "POST",
    headers,
    body,
  });
  const json = await response.json();
  if (json.success) {
    invalidateCache(CACHE_KEY);
    return fromDjango(json.data);
  }
  const detail = json.errors
    ? Object.entries(json.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" | ")
    : null;
  throw new Error(detail || json.message || "Failed to create employee");
}

export async function updateEmployee(id: string, data: EmployeeFormData): Promise<Employee> {
  const token = localStorage.getItem("django_access_token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let body: FormData | string;
  if (data.cv_file instanceof File) {
    body = toFormData(data);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      full_name: data.full_name,
      names: data.names ?? "",
      national_id: data.national_id,
      job_position: data.job_position,
      job_grade: data.job_grade ?? "",
      job_type: data.job_type ?? "Permanent",
      department: data.department ?? null,
      hire_date: data.hire_date ?? null,
      family_size: data.family_size ?? 0,
      has_disability: Boolean(data.has_disability),
      status: data.status,
    });
  }

  const response = await fetch(`${API_BASE_URL}/employees/${id}/`, {
    method: "PATCH",
    headers,
    body,
  });
  const json = await response.json();
  if (json.success) {
    invalidateCache(CACHE_KEY);
    return fromDjango(json.data);
  }
  const detail = json.errors
    ? Object.entries(json.errors).map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
    : null;
  throw new Error(detail || json.message || "Failed to update employee");
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await djangoRequest<void>(`/employees/${id}/`, { method: "DELETE" });
  if (res.success) {
    invalidateCache(CACHE_KEY);
    return;
  }
  throw new Error(res.message || "Failed to delete employee");
}

export async function bulkImportEmployees(rows: object[]): Promise<BulkImportResult> {
  const res = await djangoRequest<BulkImportResult>("/employees/bulk-import/", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  if (res.success) {
    invalidateCache(CACHE_KEY);
    return res.data;
  }
  throw new Error(res.message || "Bulk import failed");
}
