import { djangoRequest } from "./djangoAuth.ts";
import { invalidateCacheByPrefix } from "@/lib/data-cache";

export type HandoverReceiptStatus = "Draft" | "Active" | "Voided";

export type AuditEvent = {
  action: string;
  user_id: string | null;
  user_name: string;
  timestamp: string;
  reprint_no: number;
};

export type HandoverReceipt = {
  id: string;
  doc_number: string;
  doc_status: HandoverReceiptStatus;
  allocation: string;
  application: string;
  house: string;
  employee_id: string;
  employee_name: string;
  job_position: string;
  job_grade: string;
  department: string;
  national_id: string;
  marital_status: string;
  family_size: number;
  house_number: string;
  house_type: string;
  house_location: string;
  room_count: number;
  house_room_count: number;
  allocation_no: string;
  application_no: string;
  allocation_date: string | null;
  inspection_electrical: string;
  inspection_structural: string;
  inspection_water: string;
  inspection_admin: string;
  committee_members: string[];
  generated_date: string;
  generated_by: string | null;
  generated_by_name: string;
  first_printed_at: string | null;
  last_printed_at: string | null;
  printed_by: string | null;
  printed_by_name: string;
  reprint_count: number;
  is_printed: boolean;
  audit_history: AuditEvent[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

function fromDjango(row: any): HandoverReceipt {
  return {
    id: String(row.id),
    doc_number: row.doc_number ?? "",
    doc_status: row.doc_status ?? "Active",
    allocation: String(row.allocation ?? ""),
    application: String(row.application ?? ""),
    house: String(row.house ?? ""),
    employee_id: row.employee_id ?? "",
    employee_name: row.employee_name ?? "",
    job_position: row.job_position ?? "",
    job_grade: row.job_grade ?? "",
    department: row.department ?? "",
    national_id: row.national_id ?? "",
    marital_status: row.marital_status ?? "",
    family_size: Number(row.family_size ?? 1),
    house_number: row.house_number ?? "",
    house_type: row.house_type ?? "",
    house_location: row.house_location ?? "",
    room_count: Number(row.room_count ?? 1),
    house_room_count: Number(row.house_room_count ?? 1),
    allocation_no: row.allocation_no ?? "",
    application_no: row.application_no ?? "",
    allocation_date: row.allocation_date ?? null,
    inspection_electrical: row.inspection_electrical ?? "",
    inspection_structural: row.inspection_structural ?? "",
    inspection_water: row.inspection_water ?? "",
    inspection_admin: row.inspection_admin ?? "",
    committee_members: row.committee_members ?? [],
    generated_date: row.generated_date ?? "",
    generated_by: row.generated_by ?? null,
    generated_by_name: row.generated_by_name ?? "",
    first_printed_at: row.first_printed_at ?? null,
    last_printed_at: row.last_printed_at ?? null,
    printed_by: row.printed_by ?? null,
    printed_by_name: row.printed_by_name ?? "",
    reprint_count: Number(row.reprint_count ?? 0),
    is_printed: row.is_printed ?? false,
    audit_history: row.audit_history ?? [],
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    is_active: row.is_active ?? true,
  };
}

function handleError(res: any): never {
  const detail = res.errors
    ? Object.entries(res.errors)
        .map(([f, v]) => `${f}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" | ")
    : null;
  throw new Error(detail || res.message || "Request failed");
}

export async function listHandoverReceipts(filters?: {
  allocation?: string;
  doc_status?: string;
  search?: string;
}): Promise<HandoverReceipt[]> {
  const qs = new URLSearchParams();
  if (filters?.allocation) qs.set("allocation", filters.allocation);
  if (filters?.doc_status) qs.set("doc_status", filters.doc_status);
  if (filters?.search) qs.set("search", filters.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await djangoRequest<any>(`/houses/handover-receipts/${suffix}`);
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    return raw.map(fromDjango);
  }
  handleError(res);
}

export async function getHandoverReceipt(id: string): Promise<HandoverReceipt> {
  const res = await djangoRequest<any>(`/houses/handover-receipts/${id}/`);
  if (res.success) return fromDjango(res.data);
  handleError(res);
}

export async function generateHandoverReceipt(
  allocationId: string,
): Promise<HandoverReceipt> {
  const res = await djangoRequest<any>("/houses/handover-receipts/", {
    method: "POST",
    body: JSON.stringify({ allocation_id: allocationId }),
  });
  if (res.success) {
    invalidateCacheByPrefix("houses:handover-receipts");
    return fromDjango(res.data);
  }
  handleError(res);
}

export async function updateHandoverReceipt(
  id: string,
  payload: Partial<
    Pick<
      HandoverReceipt,
      | "inspection_electrical"
      | "inspection_structural"
      | "inspection_water"
      | "inspection_admin"
      | "committee_members"
      | "doc_status"
    >
  >,
): Promise<HandoverReceipt> {
  const res = await djangoRequest<any>(`/houses/handover-receipts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.success) {
    invalidateCacheByPrefix("houses:handover-receipts");
    return fromDjango(res.data);
  }
  handleError(res);
}

export async function recordPrint(
  id: string,
  action = "printed",
): Promise<{ receipt: HandoverReceipt; event: AuditEvent }> {
  const res = await djangoRequest<any>(`/houses/handover-receipts/${id}/print/`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  if (res.success) {
    invalidateCacheByPrefix("houses:handover-receipts");
    return {
      receipt: fromDjango(res.data.receipt),
      event: res.data.event,
    };
  }
  handleError(res);
}

export async function getOrCreateHandoverReceipt(
  allocationId: string,
): Promise<HandoverReceipt> {
  return generateHandoverReceipt(allocationId);
}
