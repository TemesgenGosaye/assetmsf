/**
 * Asset lifecycle service – immutable audit trail for assets.
 * Talks to Django REST /api/assets/lifecycle-events/
 */
import { djangoRequest } from "./djangoAuth";

export type LifecycleEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "condition_changed"
  | "transferred"
  | "owner_changed"
  | "location_changed"
  | "disposed"
  | "retired"
  | "maintenance_scheduled"
  | "maintenance_completed"
  | "depreciation_updated"
  | "value_updated"
  | "qr_generated"
  | "scanned"
  | "amc_updated";

export type LifecycleEvent = {
  id: string;
  asset: string;
  asset_code: string;
  asset_name: string;
  event_type: LifecycleEventType;
  event_type_display: string;
  actor: string | null;
  actor_name: string | null;
  old_value: Record<string, unknown> | string | null;
  new_value: Record<string, unknown> | string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export async function fetchLifecycleEvents(options?: {
  asset?: string;
  eventType?: string;
  force?: boolean;
}): Promise<LifecycleEvent[]> {
  const params = new URLSearchParams();
  if (options?.asset) params.set("asset", options.asset);
  if (options?.eventType) params.set("event_type", options.eventType);
  const query = params.toString();
  const endpoint = `/assets/lifecycle-events/${query ? `?${query}` : ""}`;
  const response = await djangoRequest<any>(endpoint);
  if (response.success) {
    return response.data?.results || response.data || [];
  }
  throw new Error(response.message || "Failed to fetch lifecycle events");
}
