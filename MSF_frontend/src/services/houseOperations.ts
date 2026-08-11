/**
 * House operations service – inspections, maintenance, transfers, rentals,
 * conflict scan and allocation recommendations (Django REST /api/houses/…).
 */
import { djangoRequest } from "./djangoAuth.ts";
import { invalidateCache, getCachedValue } from "@/lib/data-cache";

export type InspectionStatus = "Scheduled" | "Completed";
export type InspectionType = "Routine" | "Move-in" | "Move-out" | "Damage" | "Periodic";

export type HouseInspection = {
  id: string;
  house: string;
  house_hid: string;
  house_location: string;
  house_type: string;
  inspector: string | null;
  inspector_name: string;
  inspection_type: string;
  status: InspectionStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  findings: string;
  damage_costs: string;
  checklist_results: Record<string, boolean | string> | null;
  requested_by_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type MaintenancePriority = "Low" | "Medium" | "High" | "Urgent";
export type MaintenanceStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";

export type MaintenanceRequest = {
  id: string;
  house: string;
  house_hid: string;
  house_location: string;
  house_type: string;
  requested_by: string | null;
  requested_by_name: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  cost: string;
  assigned_to: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type TransferStatus = "Pending" | "Approved" | "Rejected" | "Completed";

export type HouseTransfer = {
  id: string;
  employee: string;
  employee_name: string;
  employee_id: string;
  current_house: string | null;
  current_house_hid: string | null;
  target_house: string;
  target_house_hid: string;
  reason: string;
  status: TransferStatus;
  approved_by: string | null;
  approved_by_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type ContractStatus = "Active" | "Terminated";

export type RentalContract = {
  id: string;
  contract_no: string;
  tenant: string;
  tenant_name: string;
  tenant_id: string;
  house: string;
  house_hid: string;
  house_location: string;
  application: string | null;
  application_no: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  security_deposit: string;
  status: ContractStatus;
  terms_conditions: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type InvoiceStatus = "Unpaid" | "Partial" | "Paid" | "Cancelled";

export type RentalInvoice = {
  id: string;
  invoice_no: string;
  contract: string;
  contract_no: string;
  tenant: string;
  tenant_name: string;
  tenant_id: string;
  house_hid: string;
  billing_month: string;
  due_date: string;
  rent_amount: string;
  penalty_amount: string;
  paid_amount: string;
  balance: string;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type PaymentMethod = "Bank Transfer" | "Cash" | "Salary Deduction" | "Check";

export type RentalPayment = {
  id: string;
  receipt_no: string;
  invoice: string;
  invoice_no: string;
  tenant_name: string;
  amount_paid: string;
  payment_method: string;
  reference_no: string;
  notes: string;
  recorded_by: string | null;
  recorded_by_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type RentalSummary = {
  active_contracts: number;
  monthly_rent_revenue: number;
  total_invoiced: number;
  total_collected: number;
  outstanding_balance: number;
  overdue_invoices: number;
};

export type ConflictItem = {
  type: "duplicate_application" | "orphaned_allocation" | "capacity_breach" | "overlapping_contract" | "transfer_target_full" | "already_allocated";
  severity: "critical" | "warning";
  employee_id?: string;
  employee_name?: string;
  detail: string;
  house_id?: string;
  hid?: string;
  applications?: { id: string; no: string; status: string }[];
  contracts?: { no: string; tenant: string }[];
  transfer_id?: string;
};

export type RecommendationCandidate = {
  application_id: string;
  application_no: string;
  employee_id: string;
  employee_name: string;
  eligible_category: string;
  score: number;
  waiting_days: number;
  has_disability: boolean;
  family_size: number;
};

export type Recommendation = {
  house_id: string;
  hid: string;
  house_number: string;
  house_type: string;
  location: string;
  candidate: RecommendationCandidate | null;
  constraint_ok: boolean;
  reason: string;
};

async function readList<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams({ page_size: "500", ...(params ?? {}) }).toString();
  const url = qs ? `${endpoint}?${qs}` : endpoint;
  const res = await djangoRequest<any>(url);
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw as T[];
  }
  throw new Error(res.message || `Failed to fetch ${endpoint}`);
}

// ─── Inspections ────────────────────────────────────────────────────────────

export async function listInspections(params?: { status?: string; house?: string; search?: string }): Promise<HouseInspection[]> {
  return readList<HouseInspection>("/houses/inspections/", params as Record<string, string> | undefined);
}

export async function scheduleInspection(data: {
  house: string;
  inspection_type: string;
  scheduled_date: string;
  findings?: string;
  checklist_results?: Record<string, boolean | string>;
}): Promise<HouseInspection> {
  const res = await djangoRequest<any>("/houses/inspections/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as HouseInspection;
  throw new Error(res.message || "Failed to schedule inspection");
}

export async function completeInspection(
  id: string,
  data: { findings?: string; damage_costs?: string; checklist_results?: Record<string, boolean | string> },
): Promise<HouseInspection> {
  const res = await djangoRequest<any>(`/houses/inspections/${id}/complete/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as HouseInspection;
  throw new Error(res.message || "Failed to complete inspection");
}

export async function deleteInspection(id: string): Promise<void> {
  const res = await djangoRequest<void>(`/houses/inspections/${id}/`, { method: "DELETE" });
  if (!res.success) throw new Error(res.message || "Failed to delete inspection");
}

// ─── Maintenance ────────────────────────────────────────────────────────────

export async function listMaintenance(params?: { status?: string; priority?: string; house?: string }): Promise<MaintenanceRequest[]> {
  return readList<MaintenanceRequest>("/houses/maintenance-requests/", params as Record<string, string> | undefined);
}

export async function createMaintenanceRequest(data: {
  house: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
}): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>("/houses/maintenance-requests/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as MaintenanceRequest;
  throw new Error(res.message || "Failed to create maintenance request");
}

export async function updateMaintenanceStatus(
  id: string,
  data: { status: MaintenanceStatus; cost?: string; assigned_to?: string; resolution_note?: string },
): Promise<MaintenanceRequest> {
  const res = await djangoRequest<any>(`/houses/maintenance-requests/${id}/status/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as MaintenanceRequest;
  throw new Error(res.message || "Failed to update maintenance request");
}

export async function deleteMaintenanceRequest(id: string): Promise<void> {
  const res = await djangoRequest<void>(`/houses/maintenance-requests/${id}/`, { method: "DELETE" });
  if (!res.success) throw new Error(res.message || "Failed to delete maintenance request");
}

// ─── Transfers ──────────────────────────────────────────────────────────────

export async function listTransfers(params?: { status?: string; search?: string }): Promise<HouseTransfer[]> {
  return readList<HouseTransfer>("/houses/transfers/", params as Record<string, string> | undefined);
}

export async function requestTransfer(data: { employee: string; target_house: string; reason: string }): Promise<HouseTransfer> {
  const res = await djangoRequest<any>("/houses/transfers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as HouseTransfer;
  throw new Error(res.message || "Failed to request transfer");
}

export async function decideTransfer(id: string, decision: "Approved" | "Rejected", notes?: string): Promise<HouseTransfer> {
  const res = await djangoRequest<any>(`/houses/transfers/${id}/decide/`, {
    method: "POST",
    body: JSON.stringify({ decision, notes: notes ?? "" }),
  });
  if (res.success) return res.data as HouseTransfer;
  throw new Error(res.message || "Failed to update transfer");
}

export async function completeTransfer(id: string): Promise<HouseTransfer> {
  const res = await djangoRequest<any>(`/houses/transfers/${id}/complete/`, { method: "POST" });
  if (res.success) return res.data as HouseTransfer;
  throw new Error(res.message || "Failed to complete transfer");
}

// ─── Rentals ────────────────────────────────────────────────────────────────

export async function listContracts(params?: { status?: string; search?: string }): Promise<RentalContract[]> {
  return readList<RentalContract>("/houses/contracts/", params as Record<string, string> | undefined);
}

export async function createContract(data: {
  tenant: string;
  house: string;
  start_date: string;
  end_date: string;
  monthly_rent: string | number;
  security_deposit?: string | number;
  terms_conditions?: string;
  application?: string;
}): Promise<RentalContract> {
  const res = await djangoRequest<any>("/houses/contracts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as RentalContract;
  throw new Error(res.message || "Failed to create contract");
}

export async function terminateContract(id: string, reason?: string): Promise<RentalContract> {
  const res = await djangoRequest<any>(`/houses/contracts/${id}/terminate/`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
  if (res.success) return res.data as RentalContract;
  throw new Error(res.message || "Failed to terminate contract");
}

export async function listInvoices(params?: { status?: string; search?: string }): Promise<RentalInvoice[]> {
  return readList<RentalInvoice>("/houses/invoices/", params as Record<string, string> | undefined);
}

export async function generateMonthlyInvoices(billing_month: string, due_date: string): Promise<RentalInvoice[]> {
  const res = await djangoRequest<any>("/houses/invoices/", {
    method: "POST",
    body: JSON.stringify({ billing_month, due_date }),
  });
  if (res.success) {
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw as RentalInvoice[];
  }
  throw new Error(res.message || "Failed to generate invoices");
}

export async function listPayments(params?: { invoice?: string }): Promise<RentalPayment[]> {
  return readList<RentalPayment>("/houses/payments/", params as Record<string, string> | undefined);
}

export async function recordPayment(data: {
  invoice: string;
  amount_paid: string | number;
  payment_method: string;
  reference_no?: string;
  notes?: string;
}): Promise<RentalPayment> {
  const res = await djangoRequest<any>("/houses/payments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.success) return res.data as RentalPayment;
  throw new Error(res.message || "Failed to record payment");
}

export interface RentRollMonthCell {
  invoice_id: string | null;
  invoice_no: string | null;
  billing_month: string;
  due_date: string | null;
  rent_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  is_overdue_30_days: boolean;
}

export interface RentRollContractRow {
  contract_id: string;
  contract_no: string;
  tenant_id: string;
  tenant_name: string;
  house_hid: string;
  house_number: string;
  monthly_rent: number;
  status: string;
  months: Record<string, RentRollMonthCell>;
  total_collected: number;
  total_balance: number;
}

export interface RentRollMonthSummary {
  month_name: string;
  billing_month: string;
  total_invoiced: number;
  total_collected: number;
  total_balance: number;
  overdue_count: number;
  status: string;
}

export interface RentRollMatrixResponse {
  year: number;
  contracts_count: number;
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  overdue_count: number;
  rows: RentRollContractRow[];
  monthly_summaries: RentRollMonthSummary[];
}

export async function getRentRollMatrix(year: number): Promise<RentRollMatrixResponse> {
  const res = await djangoRequest<any>(`/houses/invoices/rent-roll/?year=${year}`);
  if (res.success) return res.data as RentRollMatrixResponse;
  throw new Error(res.message || "Failed to fetch rent roll matrix");
}

export async function getRentalSummary(options?: { force?: boolean }): Promise<RentalSummary> {
  return getCachedValue(
    "houses:rentals:summary",
    async () => {
      const res = await djangoRequest<any>("/houses/rentals/summary/");
      if (res.success) return res.data as RentalSummary;
      throw new Error(res.message || "Failed to fetch rental summary");
    },
    { force: options?.force },
  );
}

// ─── Conflicts & recommendations ────────────────────────────────────────────

export async function getConflicts(): Promise<ConflictItem[]> {
  return readList<ConflictItem>("/houses/analytics/conflicts/");
}

export type ConflictResolutionResult = {
  action: string;
  application_no?: string;
  status?: string;
  house_id?: string;
  freed?: string[];
  kept?: string;
  returned?: string[];
};

export async function resolveConflict(
  conflictType: ConflictItem["type"],
  targetId: string,
): Promise<{ resolved: ConflictResolutionResult; conflicts: ConflictItem[] }> {
  const res = await djangoRequest<any>("/houses/analytics/conflicts/resolve/", {
    method: "POST",
    body: JSON.stringify({ conflict_type: conflictType, target_id: targetId }),
  });
  if (res.success) {
    invalidateCache("houses:analytics");
    return res.data;
  }
  throw new Error(res.message || "Failed to resolve conflict");
}

export async function getRecommendations(limit?: number): Promise<Recommendation[]> {
  return readList<Recommendation>("/houses/analytics/recommendations/", limit ? { limit: String(limit) } : undefined);
}

export function invalidateHouseOperationsCache(): void {
  [
    "houses:rentals:summary",
    "houses:analytics",
    "houses:analytics:available",
    "houses:list",
  ].forEach((k) => invalidateCache(k));
}
