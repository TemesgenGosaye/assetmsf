/**
 * Item Types service – talks to Django REST /api/item-types/
 * Supabase removed: all CRUD via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth.ts";
import { getCachedValue, invalidateCache } from "../lib/data-cache.ts";

export type ItemType = { id?: string; name: string; created_at?: string };

const CACHE_KEY = "itemtypes:list";
const CACHE_TTL = 120_000;
const LS_FALLBACK = "item_types_fallback";

const DEFAULTS = [
  "Irrigation Item", "Bridge Item", "Factory Equipment", "Heavy Machinery",
  "Light Vehicle", "Office Furniture", "Household Furniture",
  "Agricultural Equipment", "Miscellaneous",
];

function readLocal(): ItemType[] {
  try {
    const raw = localStorage.getItem(LS_FALLBACK);
    if (raw) return JSON.parse(raw) as ItemType[];
  } catch {}
  return DEFAULTS.map(n => ({ name: n }));
}

function writeLocal(list: ItemType[]) {
  try { localStorage.setItem(LS_FALLBACK, JSON.stringify(list)); } catch {}
}

export async function listItemTypes(): Promise<ItemType[]> {
  try {
    return await getCachedValue(
      CACHE_KEY,
      async () => {
        const res = await djangoRequest<any>("/item-types/?page_size=500");
        if (res.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          const items: ItemType[] = raw.map((r: any) => ({ id: r.id, name: r.name, created_at: r.created_at }));
          if (!items.length) return DEFAULTS.map(n => ({ name: n }));
          writeLocal(items);
          return items;
        }
        throw new Error(res.message || "Failed to fetch item types");
      },
      { ttlMs: CACHE_TTL }
    );
  } catch {
    return readLocal();
  }
}

export async function createItemType(name: string): Promise<ItemType> {
  if (!name?.trim()) throw new Error("Type name required");
  try {
    const res = await djangoRequest<any>("/item-types/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (res.success) {
      invalidateCache(CACHE_KEY);
      const item: ItemType = { id: res.data.id, name: res.data.name, created_at: res.data.created_at };
      const list = readLocal();
      if (!list.find(i => i.name === item.name)) writeLocal([...list, item]);
      return item;
    }
    throw new Error(res.message || "Failed to create item type");
  } catch {
    // Local fallback
    const item: ItemType = { name };
    const list = readLocal();
    if (!list.find(i => i.name === name)) writeLocal([...list, item]);
    return item;
  }
}

export async function deleteItemType(idOrName: string): Promise<void> {
  if (!idOrName?.trim()) throw new Error("Type ID or name required");
  try {
    const res = await djangoRequest<void>(`/item-types/${encodeURIComponent(idOrName)}/`, {
      method: "DELETE",
    });
    if (res.success) {
      invalidateCache(CACHE_KEY);
      writeLocal(readLocal().filter(i => i.id !== idOrName && i.name !== idOrName));
      return;
    }
    throw new Error(res.message || "Failed to delete item type");
  } catch {
    writeLocal(readLocal().filter(i => i.id !== idOrName && i.name !== idOrName));
  }
}
