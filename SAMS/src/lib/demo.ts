// Demo mode is permanently disabled.
// This stub keeps existing imports from breaking while no-oping all demo behaviour.

import type { Asset } from "@/services/assets";
import type { Property } from "@/services/properties";

export function isDemoMode(): boolean { return false; }
export function getDemoProperties(): Property[] { return []; }
export function getDemoAssets(): Asset[] { return []; }
export function getDemoUsers(): Array<{ id: string; name: string; email: string; role: string; department: string | null }> { return []; }
export function demoStats() {
  return {
    counts: { assets: 0, properties: 0, users: 0, expiring: 0 },
    metrics: { totalQuantity: 0, monthlyPurchases: 0, monthlyPurchasesPrev: 0, codesTotal: 0, codesReady: 0, assetTypes: 0 },
  };
}
export function demoAuthKeys() {
  return { current: 'current_user_id', auth: 'auth_user', perms: 'user_permissions' } as const;
}
