import { isDemoMode, getDemoAssets } from "../lib/demo.ts";
import {
  getCachedValue,
  invalidateCache,
  peekCachedValue,
  subscribeToCache,
} from "../lib/data-cache.ts";
import { djangoRequest } from "./djangoAuth.ts";

export type Asset = {
  id: string;
  asset_code: string;
  barcode?: string | null;
  qr_code?: string | null;
  rfid?: string | null;
  serialNumber?: string | null;
  name: string;
  description?: string | null;
  notes?: string | null;
  type: string;
  category?: string | null;
  category_name?: string | null;
  item_type_name?: string | null;
  subcategory?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  property: string;
  property_id?: string | null;
  department?: string | null;
  location?: string | null;
  owner?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  purchaseDate: string | Date | null;
  purchaseCost?: number | string | null;
  poNumber?: string | null;
  vendor?: string | null;
  invoiceNumber?: string | null;
  warrantyStartDate?: string | Date | null;
  warrantyExpiry?: string | Date | null;
  warrantyProvider?: string | null;
  warrantyNotes?: string | null;
  depreciationMethod?: string | null;
  usefulLifeYears?: number | string | null;
  salvageValue?: number | string | null;
  currentValue?: number | string | null;
  depreciationRate?: number | string | null;
  accumulatedDepreciation?: number | string | null;
  condition: string | null;
  status: string;
  expiryDate: string | Date | null;
  amcEnabled?: boolean;
  amcProvider?: string | null;
  amcStartDate?: string | Date | null;
  amcEndDate?: string | Date | null;
  amcCost?: number | string | null;
  created_at?: string;
  updated_at?: string;
  is_under_warranty?: boolean;
  is_amc_active?: boolean;
  current_value_calculated?: number;
  annual_depreciation_value?: number;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
};

export const ASSET_CACHE_KEY = "assets:list";
const ASSET_CACHE_TTL = 60_000;

function formatDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }
  return date;
}

function djangoAssetToFrontend(row: any): Asset {
  return {
    id: String(row.id),
    asset_code: row.asset_code,
    barcode: row.barcode ?? null,
    qr_code: row.qr_code ?? null,
    rfid: row.rfid ?? null,
    serialNumber: row.serial_number ?? null,
    name: row.description || row.item_type_name || row.asset_code || "Asset",
    description: row.description ?? null,
    notes: row.notes ?? null,
    type: row.category_name || row.item_type_name || row.subcategory || "Uncategorized",
    category: row.category ?? null,
    category_name: row.category_name ?? null,
    item_type_name: row.item_type_name ?? null,
    subcategory: row.subcategory ?? null,
    manufacturer: row.manufacturer ?? null,
    model: row.model ?? null,
    property: row.property_name || row.property,
    property_id: row.property ? String(row.property) : null,
    department: row.department ?? null,
    location: row.location ?? null,
    owner: row.owner ?? null,
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
    purchaseDate: row.purchase_date ?? null,
    purchaseCost: row.purchase_cost ?? null,
    poNumber: row.po_number ?? null,
    vendor: row.vendor ?? null,
    invoiceNumber: row.invoice_number ?? null,
    warrantyStartDate: row.warranty_start_date ?? null,
    warrantyExpiry: row.warranty_expiry ?? null,
    warrantyProvider: row.warranty_provider ?? null,
    warrantyNotes: row.warranty_notes ?? null,
    depreciationMethod: row.depreciation_method ?? null,
    usefulLifeYears: row.useful_life_years ?? null,
    salvageValue: row.salvage_value ?? null,
    currentValue: row.current_value ?? null,
    depreciationRate: row.depreciation_rate ?? null,
    accumulatedDepreciation: row.accumulated_depreciation ?? 0,
    condition: row.condition
      ? row.condition.charAt(0).toUpperCase() + row.condition.slice(1)
      : null,
    status: row.status
      ? row.status.charAt(0).toUpperCase() +
        row.status.slice(1).replace(/_/g, " ")
      : "Active",
    expiryDate: row.expiry_date ?? null,
    amcEnabled: Boolean(row.amc_enabled),
    amcProvider: row.amc_provider ?? null,
    amcStartDate: row.amc_start_date ?? null,
    amcEndDate: row.amc_end_date ?? null,
    amcCost: row.amc_cost ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_under_warranty: row.is_under_warranty,
    is_amc_active: row.is_amc_active,
    current_value_calculated: row.current_value_calculated,
    annual_depreciation_value: row.annual_depreciation_value,
    createdById: row.created_by ? String(row.created_by) : null,
    createdByName: row.created_by_name ?? null,
    createdByEmail: row.created_by_email ?? null,
  };
}

export function formDataToDjango(formData: any): any {
  const row: any = {};
  row.name = formData.itemTypeName || formData.description || formData.type || "Asset";
  row.description = formData.description;
  row.notes = formData.notes;
  row.subcategory = formData.subcategory;
  row.manufacturer = formData.manufacturer;
  row.model = formData.model;
  row.property = formData.property;
  row.department = formData.department;
  row.location = formData.location;
  row.purchase_date = formatDate(formData.purchaseDate);
  row.expiry_date = formatDate(formData.expiryDate);
  row.po_number = formData.poNumber;
  row.purchase_cost = numOrNull(formData.purchaseCost);
  row.vendor = formData.vendor;
  row.invoice_number = formData.invoiceNumber;
  row.warranty_start_date = formatDate(formData.warrantyStartDate);
  row.warranty_expiry = formatDate(formData.warrantyEndDate ?? formData.warrantyExpiry);
  row.warranty_provider = formData.warrantyProvider;
  row.warranty_notes = formData.warrantyNotes;
  row.depreciation_method = (formData.depreciationMethod || "straight_line")
    .toLowerCase()
    .replace(/\s+/g, "_");
  row.useful_life_years = numOrNull(formData.usefulLifeYears);
  row.salvage_value = numOrNull(formData.salvageValue);
  row.current_value = numOrNull(formData.currentValue);
  row.depreciation_rate = numOrNull(formData.depreciationRate);
  row.accumulated_depreciation = numOrZero(formData.accumulatedDepreciation);
  row.condition = (formData.condition || "good")
    .toLowerCase()
    .replace(/^new$/, "good");
  row.serial_number = formData.serialNumber;
  row.barcode = formData.barcode;
  row.qr_code = formData.qrCode;
  row.rfid = formData.rfid;
  row.amc_enabled = formData.amcEnabled;
  row.amc_provider = formData.amcProvider;
  row.amc_start_date = formatDate(formData.amcStartDate);
  row.amc_end_date = formatDate(formData.amcEndDate);
  row.amc_cost = numOrNull(formData.amcCost);
  row.status = "active";
  // Item type: resolve code to DB id via item_type_name sent to backend
  if (formData.itemType) {
    row.item_type_name = formData.itemTypeName || formData.itemType;
  }
  return row;
}

function normalizeCondition(c: string | null | undefined): string {
  const v = (c || "good").toLowerCase().trim();
  if (v === "new") return "good";
  const valid = ["excellent", "good", "fair", "poor", "damaged"];
  return valid.includes(v) ? v : "good";
}

function numOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function numOrZero(v: unknown): number {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

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
  if ("asset_code" in asset) row.asset_code = asset.asset_code;
  if ("barcode" in asset) row.barcode = asset.barcode ?? null;
  if ("qr_code" in asset) row.qr_code = asset.qr_code ?? null;
  if ("rfid" in asset) row.rfid = asset.rfid ?? null;
  if ("name" in asset) row.name = asset.name;
  if ("description" in asset) row.description = asset.description;
  if ("notes" in asset) row.notes = asset.notes;
  if ("property_id" in asset) row.property = asset.property_id;
  if ("subcategory" in asset) row.subcategory = asset.subcategory;
  if ("manufacturer" in asset) row.manufacturer = asset.manufacturer;
  if ("model" in asset) row.model = asset.model;
  if ("department" in asset) row.department = asset.department;
  if ("location" in asset) row.location = asset.location;
  if ("purchaseDate" in asset)
    row.purchase_date = formatDate(asset.purchaseDate);
  if ("expiryDate" in asset) row.expiry_date = formatDate(asset.expiryDate);
  if ("poNumber" in asset) row.po_number = asset.poNumber;
  if ("purchaseCost" in asset) row.purchase_cost = numOrNull(asset.purchaseCost);
  if ("vendor" in asset) row.vendor = asset.vendor;
  if ("invoiceNumber" in asset) row.invoice_number = asset.invoiceNumber;
  if ("warrantyStartDate" in asset)
    row.warranty_start_date = formatDate(asset.warrantyStartDate);
  if ("warrantyExpiry" in asset)
    row.warranty_expiry = formatDate(asset.warrantyExpiry);
  if ("warrantyProvider" in asset) row.warranty_provider = asset.warrantyProvider;
  if ("warrantyNotes" in asset) row.warranty_notes = asset.warrantyNotes;
  if ("depreciationMethod" in asset) {
    const m = String(asset.depreciationMethod || "").toLowerCase();
    row.depreciation_method = ["straight_line", "reducing_balance", "no_depreciation"].includes(m)
      ? m
      : "straight_line";
  }
  if ("usefulLifeYears" in asset) row.useful_life_years = numOrNull(asset.usefulLifeYears);
  if ("salvageValue" in asset) row.salvage_value = numOrNull(asset.salvageValue);
  if ("currentValue" in asset) row.current_value = numOrNull(asset.currentValue);
  if ("depreciationRate" in asset) row.depreciation_rate = numOrNull(asset.depreciationRate);
  if ("accumulatedDepreciation" in asset)
    row.accumulated_depreciation = numOrZero(asset.accumulatedDepreciation);
  if ("condition" in asset) row.condition = normalizeCondition(asset.condition);
  if ("status" in asset) row.status = normalizeStatus(asset.status);
  if ("serialNumber" in asset) row.serial_number = asset.serialNumber;
  if ("type" in asset && asset.type) {
    row.item_type_name = asset.item_type_name || asset.type;
  }
  if ("amcEnabled" in asset) row.amc_enabled = asset.amcEnabled;
  if ("amcProvider" in asset) row.amc_provider = asset.amcProvider;
  if ("amcStartDate" in asset)
    row.amc_start_date = formatDate(asset.amcStartDate);
  if ("amcEndDate" in asset)
    row.amc_end_date = formatDate(asset.amcEndDate);
  if ("amcCost" in asset) row.amc_cost = numOrNull(asset.amcCost);
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
  if (asset.type || asset.item_type_name) {
    (payload as any).item_type_name = asset.item_type_name || asset.type;
  }
  if (asset.owner) {
    payload.owner = asset.owner;
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
        .map(([field, msgs]) =>
          `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}`,
        )
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
  if (patch.type || patch.item_type_name) {
    (payload as any).item_type_name = patch.item_type_name || patch.type;
  }
  if (patch.owner) {
    payload.owner = patch.owner;
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
        .map(([field, msgs]) =>
          `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}`,
        )
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

import { generateAssetId } from "./itemTypes.ts";

export function generateAssetCode(
  type: string,
  _propertyCode: string,
  sequence: number,
): string {
  return generateAssetId(type, sequence);
}
