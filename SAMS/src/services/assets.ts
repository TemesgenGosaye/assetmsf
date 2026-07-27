import { isDemoMode, getDemoAssets } from "../lib/demo.ts";
import {
  getCachedValue,
  invalidateCache,
  peekCachedValue,
  subscribeToCache,
} from "../lib/data-cache.ts";
import { djangoRequest } from "./djangoAuth.ts";

export type Asset = {
  id: string; // UUID from Django
  asset_code: string; // e.g., AST-001
  name: string;
  type: string;
  property: string;
  property_id?: string | null;
  department?: string | null;
  quantity: number;
  purchaseDate: string | Date | null;
  expiryDate: string | Date | null;
  poNumber: string | null;
  condition: string | null;
  status: string;
  location?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  created_at?: string;
  amcEnabled?: boolean;
  amcStartDate?: string | Date | null;
  amcEndDate?: string | Date | null;
  category_name?: string | null;
  item_type_name?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  is_under_warranty?: boolean;
  is_amc_active?: boolean;
  current_value_calculated?: number;
};

export const ASSET_CACHE_KEY = "assets:list";
const ASSET_CACHE_TTL = 60_000; // 1 minute keeps dashboards snappy without going stale

// Helper to format date to ISO string
function formatDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }
  return date;
}

// Helpers to convert between backend (snake_case) and frontend (camelCase)
function djangoAssetToFrontend(row: any): Asset {
  return {
    id: String(row.id),
    asset_code: row.asset_code,
    name: row.name,
    type: row.category_name || row.item_type_name || "Uncategorized",
    property: row.property_name || row.property,
    property_id: row.property ? String(row.property) : null,
    department: row.department,
    location: row.location,
    quantity: row.quantity,
    purchaseDate: row.purchase_date,
    expiryDate: row.expiry_date,
    poNumber: row.po_number,
    condition: row.condition
      ? row.condition.charAt(0).toUpperCase() + row.condition.slice(1)
      : null,
    status: row.status
      ? row.status.charAt(0).toUpperCase() +
        row.status.slice(1).replace(/_/g, " ")
      : "Active",
    serialNumber: row.serial_number,
    amcEnabled: row.amc_enabled,
    amcStartDate: row.amc_start_date,
    amcEndDate: row.amc_end_date,
    created_at: row.created_at,
    category_name: row.category_name,
    item_type_name: row.item_type_name,
    owner_name: row.owner_name,
    owner_email: row.owner_email,
    is_under_warranty: row.is_under_warranty,
    is_amc_active: row.is_amc_active,
    current_value_calculated: row.current_value_calculated,
  };
}

// Convert AssetForm data to Django asset
export function formDataToDjango(formData: any): any {
  const row: any = {};
  row.name = formData.itemName;
  row.description = formData.description;
  row.property = formData.property;
  row.department = formData.department;
  row.location = formData.location;
  row.quantity = parseInt(formData.quantity, 10);
  row.purchase_date = formatDate(formData.purchaseDate);
  row.expiry_date = formatDate(formData.expiryDate);
  row.po_number = formData.poNumber;
  row.condition = (formData.condition || "good")
    .toLowerCase()
    .replace(/^new$/, "good");
  row.serial_number = formData.serialNumber;
  row.amc_enabled = formData.amcEnabled;
  row.amc_start_date = formatDate(formData.amcStartDate);
  row.amc_end_date = formatDate(formData.amcEndDate);
  row.status = "active";
  return row;
}

/** Normalize condition to Django's accepted values */
function normalizeCondition(c: string | null | undefined): string {
  const v = (c || "good").toLowerCase().trim();
  // 'new' is not a Django choice — map to 'good'
  if (v === "new") return "good";
  const valid = ["excellent", "good", "fair", "poor", "damaged"];
  return valid.includes(v) ? v : "good";
}

/** Normalize status to Django's accepted lowercase values */
function normalizeStatus(s: string | null | undefined): string {
  const v = (s || "active").toLowerCase().trim();
  const valid = [
    "active",
    "inactive",
    "disposed",
    "lost",
    "damaged",
    "under_maintenance",
    "retired",
  ];
  return valid.includes(v) ? v : "active";
}

function frontendAssetToDjango(asset: Partial<Asset>): any {
  const row: any = {};
  if ("name" in asset) row.name = asset.name;
  if ("description" in asset) row.description = asset.description;
  if ("property_id" in asset) row.property = asset.property_id;
  if ("department" in asset) row.department = asset.department;
  if ("location" in asset) row.location = asset.location;
  if ("quantity" in asset) row.quantity = asset.quantity;
  if ("purchaseDate" in asset)
    row.purchase_date = formatDate(asset.purchaseDate);
  if ("expiryDate" in asset) row.expiry_date = formatDate(asset.expiryDate);
  if ("poNumber" in asset) row.po_number = asset.poNumber;
  if ("condition" in asset) row.condition = normalizeCondition(asset.condition);
  if ("status" in asset) row.status = normalizeStatus(asset.status);
  if ("serialNumber" in asset) row.serial_number = asset.serialNumber;
  if ("amcEnabled" in asset) row.amc_enabled = asset.amcEnabled;
  if ("amcStartDate" in asset)
    row.amc_start_date = formatDate(asset.amcStartDate);
  if ("amcEndDate" in asset) row.amc_end_date = formatDate(asset.amcEndDate);
  if ("asset_code" in asset) row.asset_code = asset.asset_code;
  if ("type" in asset) {
    // We'll need to map type to category/item_type later
  }
  return row;
}

export function getCachedAssetsSnapshot(): Asset[] | undefined {
  return peekCachedValue<Asset[]>(ASSET_CACHE_KEY);
}

export function subscribeToAssetsCache(
  callback: (assets: Asset[]) => void,
): () => void {
  return subscribeToCache<Asset[]>(ASSET_CACHE_KEY, callback);
}

export async function listAssets(options?: {
  force?: boolean;
}): Promise<Asset[]> {
  if (isDemoMode()) return getDemoAssets();
  return getCachedValue(
    ASSET_CACHE_KEY,
    async () => {
      const response = await djangoRequest<any>("/assets/?page_size=1000");
      if (response.success) {
        // Handle both paginated and non-paginated responses
        const data = response.data?.results || response.data;
        return (data || []).map(djangoAssetToFrontend);
      }
      throw new Error(response.message || "Failed to fetch assets");
    },
    { ttlMs: ASSET_CACHE_TTL, force: options?.force },
  );
}

export async function createAsset(asset: Partial<Asset>): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const payload = frontendAssetToDjango(asset);
  // Add item_type_name if type is provided
  if (asset.type) {
    (payload as any).item_type_name = asset.type;
  }
  const response = await djangoRequest<any>("/assets/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (response.success) {
    invalidateCache(ASSET_CACHE_KEY);
    return djangoAssetToFrontend(response.data);
  }
  const fieldErrors = response.errors
    ? Object.entries(response.errors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
        .join("; ")
    : "";
  throw new Error(
    fieldErrors
      ? `${response.message}: ${fieldErrors}`
      : response.message || "Failed to create asset",
  );
}

export async function updateAsset(
  id: string,
  patch: Partial<Asset>,
): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const payload = frontendAssetToDjango(patch);
  // Add item_type_name if type is provided
  if (patch.type) {
    (payload as any).item_type_name = patch.type;
  }
  const response = await djangoRequest<any>(`/assets/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (response.success) {
    invalidateCache(ASSET_CACHE_KEY);
    return djangoAssetToFrontend(response.data);
  }
  const fieldErrors = response.errors
    ? Object.entries(response.errors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
        .join("; ")
    : "";
  throw new Error(
    fieldErrors
      ? `${response.message}: ${fieldErrors}`
      : response.message || "Failed to update asset",
  );
}

export async function deleteAsset(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const response = await djangoRequest<void>(`/assets/${id}/`, {
    method: "DELETE",
  });
  if (response.success) {
    invalidateCache(ASSET_CACHE_KEY);
    return;
  }
  throw new Error(response.message || "Failed to delete asset");
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (isDemoMode()) {
    const list = getDemoAssets();
    return list.find((a) => a.id === id) || null;
  }
  const response = await djangoRequest<any>(`/assets/${id}/`);
  if (response.success) {
    return djangoAssetToFrontend(response.data);
  }
  return null;
}

// Helper to generate asset code (can be removed if backend handles it)
import { generateAssetId } from "./itemTypes.ts";

export function generateAssetCode(
  type: string,
  _propertyCode: string,
  sequence: number,
): string {
  return generateAssetId(type, sequence);
}
