import { isDemoMode } from '@/lib/demo';
import { getCachedValue, invalidateCache } from '@/lib/data-cache';
import { djangoRequest } from './djangoAuth';

export type PropertyLicense = {
  property_id: string;
  asset_limit: number; // 0 = unlimited
  plan?: LicensePlan | null; // optional per-property plan (overrides global concept)
  updated_at?: string;
};

// Plan-based licensing
export type LicensePlan = 'free' | 'standard' | 'pro' | 'business';

export interface GlobalLicenseLimits {
  // New plan-based model
  plan: LicensePlan; // selected plan
  asset_allowance: number | null; // null = unlimited
  // Backwards compatibility (old schema field). If present, treat as 'free' plan
  free_asset_allowance?: number;
  // For business (custom) allow storing custom label or notes later (reserved field)
  notes?: string | null;
}

const LOCAL_KEY_PL = 'property_license_map';
const LOCAL_KEY_GLOBAL = 'license_global_limits_v2';
const PROPERTY_LICENSE_CACHE_KEY = 'property_license:list';
const PROPERTY_LICENSE_CACHE_TTL = 60_000;

function readLocalMap(): Record<string, PropertyLicense> {
  try { const raw = localStorage.getItem(LOCAL_KEY_PL); if (raw) return JSON.parse(raw); } catch {}
  return {};
}
function writeLocalMap(m: Record<string, PropertyLicense>) { try { localStorage.setItem(LOCAL_KEY_PL, JSON.stringify(m)); } catch {} }
// New default: global unlimited (business) and no longer surface free_asset_allowance except for legacy migration
function defaultGlobalLimits(): GlobalLicenseLimits { return { plan: 'business', asset_allowance: null }; }
function readLocalGlobal(): GlobalLicenseLimits { try { const raw = localStorage.getItem(LOCAL_KEY_GLOBAL); if (raw) return JSON.parse(raw); } catch {} return defaultGlobalLimits(); }
function writeLocalGlobal(v: GlobalLicenseLimits) { try { localStorage.setItem(LOCAL_KEY_GLOBAL, JSON.stringify(v)); } catch {} }

export async function listPropertyLicenses(options?: { force?: boolean }): Promise<PropertyLicense[]> {
  if (isDemoMode()) {
    return Object.values(readLocalMap());
  }
  return getCachedValue(
    PROPERTY_LICENSE_CACHE_KEY,
    async () => {
      const res = await djangoRequest('/dashboard/licenses/');
      if (res.success) {
        return (res.data || []) as PropertyLicense[];
      }
      return [];
    },
    { ttlMs: PROPERTY_LICENSE_CACHE_TTL, force: options?.force },
  );
}

export async function getPropertyLicense(propertyId: string): Promise<PropertyLicense | null> {
  if (isDemoMode()) {
    const map = readLocalMap();
    return map[propertyId] || null;
  }
  const res = await djangoRequest(`/dashboard/licenses/${propertyId}/`);
  if (res.success) {
    return res.data as PropertyLicense | null;
  }
  return null;
}

export async function upsertPropertyLicense(propertyId: string, assetLimit: number, plan?: LicensePlan | null): Promise<PropertyLicense> {
  if (isDemoMode()) {
    const map = readLocalMap();
    map[propertyId] = { property_id: propertyId, asset_limit: assetLimit, plan, updated_at: new Date().toISOString() };
    writeLocalMap(map);
    return map[propertyId];
  }
  
  // Try to get first to see if we need to update or create
  const existing = await getPropertyLicense(propertyId);
  let res;
  if (existing) {
    res = await djangoRequest(`/dashboard/licenses/${propertyId}/`, {
      method: 'PUT',
      body: JSON.stringify({ asset_limit: assetLimit, plan })
    });
  } else {
    res = await djangoRequest('/dashboard/licenses/', {
      method: 'POST',
      body: JSON.stringify({ property_id: propertyId, asset_limit: assetLimit, plan })
    });
  }
  
  if (res.success) {
    invalidateCache(PROPERTY_LICENSE_CACHE_KEY);
    return res.data as PropertyLicense;
  }
  throw new Error(res.message || 'Failed to upsert license');
}

export async function getGlobalLimits(): Promise<GlobalLicenseLimits> {
  if (isDemoMode()) {
    return normalizeGlobal(readLocalGlobal());
  }
  const res = await djangoRequest('/dashboard/license-meta/global_limits/');
  if (res.success && res.data?.value) {
    return normalizeGlobal(res.data.value as GlobalLicenseLimits);
  }
  return defaultGlobalLimits();
}

function normalizeGlobal(raw: GlobalLicenseLimits): GlobalLicenseLimits {
  // Legacy: object only had free_asset_allowance (pre-plan). Assume free plan
  if ((raw as any).free_asset_allowance != null && (raw as any).plan == null) {
    const free = (raw as any).free_asset_allowance as number;
    return { plan: 'free', asset_allowance: free };
  }
  // If plan set but asset_allowance missing, derive (business => null/unlimited)
  if (raw.asset_allowance == null) {
    raw.asset_allowance = derivedAllowanceForPlan(raw.plan);
  }
  // Strip legacy key for any non-free plan to avoid confusing UI (we keep only while plan==='free')
  if (raw.plan !== 'free' && (raw as any).free_asset_allowance != null) {
    delete (raw as any).free_asset_allowance;
  }
  return raw;
}

function derivedAllowanceForPlan(plan: LicensePlan): number | null {
  switch (plan) {
    case 'free': return 100;
    case 'standard': return 500;
    case 'pro': return 2500;
    case 'business': return null;
    default: return 100;
  }
}

export async function updateGlobalLimits(patch: Partial<GlobalLicenseLimits>): Promise<GlobalLicenseLimits> {
  const current = await getGlobalLimits();
  let next: GlobalLicenseLimits = { ...current, ...patch };

  // Plan change logic
  if (patch.plan) {
    if (patch.plan === 'business') {
      // business => keep provided asset_allowance (may be null for unlimited)
      if (patch.asset_allowance === undefined) {
        // if not explicitly provided, default to null (unlimited)
        next.asset_allowance = null;
      }
    } else {
      // Non-business plans derive standard allowance unless explicit override
      if (patch.asset_allowance === undefined) {
        next.asset_allowance = derivedAllowanceForPlan(patch.plan) ?? 0;
      }
    }
  }

  // Remove legacy free_asset_allowance unless plan still free (kept for compatibility display if ever needed)
  if (next.plan !== 'free' && (next as any).free_asset_allowance != null) {
    delete (next as any).free_asset_allowance;
  }

  if (isDemoMode()) {
    writeLocalGlobal(next);
    return next;
  }
  const res = await djangoRequest('/dashboard/license-meta/global_limits/', {
    method: 'PUT',
    body: JSON.stringify({ value: next })
  });
  if (res.success && res.data?.value) {
    return res.data.value as GlobalLicenseLimits;
  }
  throw new Error(res.message || 'Failed to update global limits');
}

// Helper to compute total assets count (DB query). Provide fallback when offline
export async function countTotalAssets(): Promise<number> {
  if (isDemoMode()) {
    try { const raw = localStorage.getItem('demo_assets') || localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); return Array.isArray(list) ? list.length : 0; } } catch {}
    return 0;
  }
  // Use Django's asset list to get count
  const res = await djangoRequest('/assets/');
  if (res.success) {
    return Array.isArray(res.data) ? res.data.length : 0;
  }
  return 0;
}

export type LicenseCheckResult = {
  ok: boolean;
  reason?: 'GLOBAL_LIMIT' | 'PROPERTY_LIMIT';
  message?: string;
  propertyLimit?: number;
  propertyUsage?: number;
  globalLimit?: number;
  globalUsage?: number;
};

export async function checkLicenseBeforeCreate(propertyId: string, increment: number = 1): Promise<LicenseCheckResult> {
  // Global now treated as unlimited per new requirement
  const totalUsage = await countTotalAssets();
  const lic = await getPropertyLicense(propertyId);
  let effectiveLimit: number | null = null;
  if (lic) {
    if (lic.asset_limit > 0) {
      effectiveLimit = lic.asset_limit;
    } else if (lic.plan) {
      const derived = derivedAllowanceForPlan(lic.plan);
      effectiveLimit = derived == null ? null : derived; // business with null => unlimited
    }
  }
  // Count property usage
  let propUsage = 0;
  if (isDemoMode()) {
    try { const raw = localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); propUsage = list.filter((a: any) => a.property_id === propertyId || a.property === propertyId).length; } } catch {}
  } else {
    const res = await djangoRequest('/assets/');
    if (res.success) {
      const assets = Array.isArray(res.data) ? res.data : [];
      propUsage = assets.filter((a: any) => String(a.property_id || a.property) === String(propertyId)).length;
    }
  }
  if (effectiveLimit != null && effectiveLimit > 0 && propUsage + increment > effectiveLimit) {
    return { ok: false, reason: 'PROPERTY_LIMIT', message: 'Property asset limit reached. Please request an adjustment.', propertyLimit: effectiveLimit, propertyUsage: propUsage, globalLimit: 0, globalUsage: totalUsage };
  }
  return { ok: true, propertyLimit: effectiveLimit ?? undefined, propertyUsage: propUsage, globalLimit: 0, globalUsage: totalUsage };
}

export type LicenseSnapshot = {
  propertyId: string;
  propertyLimit?: number;
  propertyUsage?: number;
  globalLimit: number | null; // null = unlimited for plan
  globalUsage: number;
  propertyRemaining?: number | null;
  plan: LicensePlan;
};

export async function getLicenseSnapshot(propertyId: string): Promise<LicenseSnapshot> {
  const globalUsage = await countTotalAssets();
  const globalLimit = null; // unlimited globally per new requirements
  const lic = await getPropertyLicense(propertyId);
  let propertyUsage: number | undefined;
  let propertyLimit: number | undefined;
  if (lic && lic.asset_limit > 0) {
    propertyLimit = lic.asset_limit;
    if (isDemoMode()) {
      try { const raw = localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); propertyUsage = list.filter((a: any) => a.property_id === propertyId || a.property === propertyId).length; } } catch {}
    } else {
      const res = await djangoRequest('/assets/');
      if (res.success) {
        const assets = Array.isArray(res.data) ? res.data : [];
        propertyUsage = assets.filter((a: any) => String(a.property_id || a.property) === String(propertyId)).length;
      }
    }
  } else if (lic && !lic.asset_limit && lic.plan) {
    const derived = derivedAllowanceForPlan(lic.plan);
    if (derived != null) {
      propertyLimit = derived;
      if (isDemoMode()) {
        try { const raw = localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); propertyUsage = list.filter((a: any) => a.property_id === propertyId || a.property === propertyId).length; } } catch {}
      } else {
        const res = await djangoRequest('/assets/');
        if (res.success) {
          const assets = Array.isArray(res.data) ? res.data : [];
          propertyUsage = assets.filter((a: any) => String(a.property_id || a.property) === String(propertyId)).length;
        }
      }
    }
  }
  const snapshot: LicenseSnapshot = {
    propertyId,
    propertyLimit,
    propertyUsage,
    globalLimit, // always unlimited now
    globalUsage,
    plan: lic?.plan || 'business',
    propertyRemaining: (propertyLimit != null && propertyLimit > 0 && propertyUsage != null) ? Math.max(0, propertyLimit - propertyUsage) : null,
    globalRemaining: (globalLimit != null && globalLimit > 0) ? Math.max(0, globalLimit - globalUsage) : null,
  };
  return snapshot;
}
