/**
 * Asset analytics service – portfolio KPIs, compliance, and depreciation.
 * Talks to Django REST /api/assets/analytics/ | /compliance/ | /depreciation/
 */
import { isDemoMode } from "../lib/demo";
import { djangoRequest } from "./djangoAuth";

export type BreakdownRow = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export type ComplianceCounts = {
  active: number;
  expiring_30: number;
  expiring_90: number;
  expired: number;
  none: number;
};

export type AssetAnalytics = {
  totals: {
    total_assets: number;
    total_purchase_cost: number;
    total_current_value: number;
    total_accumulated_depreciation: number;
    annual_depreciation: number;
  };
  status_breakdown: BreakdownRow[];
  condition_breakdown: BreakdownRow[];
  category_breakdown: BreakdownRow[];
  department_breakdown: BreakdownRow[];
  property_breakdown: BreakdownRow[];
  depreciation_method_breakdown: { key: string; label: string; count: number }[];
  warranty: ComplianceCounts;
  amc: ComplianceCounts;
  monthly_acquisitions: {
    year: number;
    month: number;
    label: string;
    count: number;
    value: number;
  }[];
  projection: { year: number; value: number }[];
  maintenance: {
    open_tickets: number;
    overdue_tickets: number;
    resolved_30d: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    schedules_due_30d: number;
    schedules_overdue: number;
  };
};

export type ComplianceItem = {
  asset: string;
  asset_name: string;
  asset_id: string;
  expiry: string;
  days_left: number | null;
  status: "expired" | "expiring";
  provider: string | null;
  purchase_cost?: number;
  cost?: number;
};

export type ComplianceData = {
  generated_at: string;
  horizon_days: number;
  warranty: ComplianceCounts & { items: ComplianceItem[] };
  amc: ComplianceCounts & { items: ComplianceItem[] };
};

export type DepreciationRow = {
  asset: string;
  asset_name: string;
  purchase_date: string | null;
  purchase_cost: number;
  method: string;
  method_label: string;
  useful_life_years: number | null;
  salvage_value: number;
  annual_depreciation: number;
  accumulated_depreciation: number;
  current_value: number;
  depreciated_percent: number;
};

export type DepreciationData = {
  as_of: string;
  totals: {
    assets: number;
    purchase_cost: number;
    current_value: number;
    accumulated_depreciation: number;
  };
  items: DepreciationRow[];
};

export async function fetchAssetAnalytics(options?: {
  force?: boolean;
}): Promise<AssetAnalytics> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const query = options?.force ? "?force=1" : "";
  const response = await djangoRequest<any>(`/assets/analytics/${query}`);
  if (response.success) return response.data as AssetAnalytics;
  throw new Error(response.message || "Failed to fetch asset analytics");
}

export async function fetchComplianceData(options?: {
  force?: boolean;
  days?: number;
}): Promise<ComplianceData> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  if (options?.force) params.set("force", "1");
  const query = params.toString();
  const response = await djangoRequest<any>(
    `/assets/compliance/${query ? `?${query}` : ""}`,
  );
  if (response.success) return response.data as ComplianceData;
  throw new Error(response.message || "Failed to fetch compliance data");
}

export async function fetchDepreciationData(options?: {
  force?: boolean;
}): Promise<DepreciationData> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const query = options?.force ? "?force=1" : "";
  const response = await djangoRequest<any>(`/assets/depreciation/${query}`);
  if (response.success) return response.data as DepreciationData;
  throw new Error(response.message || "Failed to fetch depreciation data");
}

export async function recalculateDepreciation(): Promise<{ updated: number }> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const response = await djangoRequest<any>(`/assets/depreciation/`, {
    method: "POST",
  });
  if (response.success) return response.data;
  throw new Error(response.message || "Failed to recalculate depreciation");
}
