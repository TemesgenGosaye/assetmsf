/**
 * Asset Transfer service – talks to Django REST /api/assets/transfers/
 */
import { djangoRequest } from "./djangoAuth";
import { invalidateCache } from "@/lib/data-cache";
import { ASSET_CACHE_KEY } from "./assets";

export type AssetTransfer = {
  id: string;
  transfer_code: string;
  asset: string;
  asset_code: string;
  asset_name: string;
  from_department: string;
  from_owner: string | null;
  from_owner_name: string | null;
  from_owner_email: string | null;
  from_property: string | null;
  from_property_name: string | null;
  from_location: string | null;
  to_department: string;
  to_owner: string | null;
  to_owner_name: string | null;
  to_owner_email: string | null;
  to_property: string | null;
  to_property_name: string | null;
  to_location: string | null;
  reason: string;
  notes: string | null;
  quantity: number;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  status_display: string;
  requested_by: string;
  requested_by_name: string | null;
  requested_by_email: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  requested_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

const TRANSFER_CACHE_KEY = "assets:transfers";

export async function listTransfers(options?: {
  force?: boolean;
  status?: string;
}): Promise<AssetTransfer[]> {
  let url = "/assets/transfers/?page_size=500";
  if (options?.status) url += `&status=${options.status}`;
  const response = await djangoRequest<any>(url);
  if (response.success) {
    const data = response.data?.results || response.data;
    return Array.isArray(data) ? data : [];
  }
  throw new Error(response.message || "Failed to fetch transfers");
}

export async function getTransfer(id: string): Promise<AssetTransfer> {
  const response = await djangoRequest<any>(`/assets/transfers/${id}/`);
  if (response.success) return response.data;
  throw new Error(response.message || "Failed to fetch transfer");
}

export async function createTransfer(payload: {
  asset: string;
  to_department?: string;
  to_owner?: string | null;
  to_property?: string | null;
  to_location?: string;
  reason: string;
  notes?: string;
  quantity?: number;
}): Promise<AssetTransfer> {
  const response = await djangoRequest<any>("/assets/transfers/", {
    method: "POST",
    body: JSON.stringify({
      asset: payload.asset,
      to_department: payload.to_department || undefined,
      to_owner: payload.to_owner || undefined,
      to_property: payload.to_property || undefined,
      to_location: payload.to_location || undefined,
      reason: payload.reason,
      notes: payload.notes || "",
      quantity: payload.quantity || 1,
    }),
  });
  if (response.success) {
    invalidateCache(TRANSFER_CACHE_KEY);
    invalidateCache(ASSET_CACHE_KEY);
    return response.data;
  }
  const fieldErrors =
    response.errors && typeof response.errors === "object" && !Array.isArray(response.errors)
      ? Object.entries(response.errors)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}`)
          .join("; ")
      : Array.isArray(response.errors)
        ? response.errors.join(", ")
        : "";
  throw new Error(
    fieldErrors
      ? `${response.message}: ${fieldErrors}`
      : response.message || "Failed to create transfer"
  );
}

export async function approveTransfer(
  id: string,
  reason?: string,
): Promise<AssetTransfer> {
  const response = await djangoRequest<any>(`/assets/transfers/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  });
  if (response.success) {
    invalidateCache(TRANSFER_CACHE_KEY);
    invalidateCache(ASSET_CACHE_KEY);
    return response.data;
  }
  throw new Error(response.message || "Failed to approve transfer");
}

export async function rejectTransfer(
  id: string,
  reason?: string,
): Promise<AssetTransfer> {
  const response = await djangoRequest<any>(`/assets/transfers/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  });
  if (response.success) {
    invalidateCache(TRANSFER_CACHE_KEY);
    invalidateCache(ASSET_CACHE_KEY);
    return response.data;
  }
  throw new Error(response.message || "Failed to reject transfer");
}

export async function completeTransfer(id: string): Promise<AssetTransfer> {
  const response = await djangoRequest<any>(`/assets/transfers/${id}/complete/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (response.success) {
    invalidateCache(TRANSFER_CACHE_KEY);
    invalidateCache(ASSET_CACHE_KEY);
    return response.data;
  }
  throw new Error(response.message || "Failed to complete transfer");
}

export async function cancelTransfer(id: string): Promise<AssetTransfer> {
  const response = await djangoRequest<any>(`/assets/transfers/${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (response.success) {
    invalidateCache(TRANSFER_CACHE_KEY);
    invalidateCache(ASSET_CACHE_KEY);
    return response.data;
  }
  throw new Error(response.message || "Failed to cancel transfer");
}
