// src/scripts/seedAssets.ts
import { createAsset } from "../services/assets.ts";
import { isDemoMode } from "../lib/demo.ts";
import { loginWithDjango } from "../services/djangoAuth.ts";

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const assetTypes = ["Laptop", "Desktop", "Printer", "Router", "Phone", "Desk", "Chair", "Monitor"];
const conditions = ["excellent", "good", "fair", "poor", "damaged"];
const statuses = ["active", "inactive", "disposed", "lost", "under_maintenance", "retired"];

async function main() {
  if (isDemoMode()) {
    console.log("Demo mode - seed script skipped.");
    return;
  }
  const promises = [];
  for (let i = 1; i <= 40; i++) {
    const asset = {
      name: `Asset ${i}`,
      type: randomChoice(assetTypes),
      property: `Property-${Math.ceil(Math.random() * 5)}`,
      quantity: Math.ceil(Math.random() * 20),
      purchaseDate: randomDate(new Date(2018, 0, 1), new Date()),
      expiryDate: randomDate(new Date(), new Date(2030, 0, 1)),
      poNumber: `PO-${1000 + i}`,
      condition: randomChoice(conditions),
      serialNumber: `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: randomChoice(statuses),
    };
    promises.push(createAsset(asset));
  }
  await Promise.all(promises);
  console.log("Seeded 40 assets.");
}

main().catch((e) => console.error("Seed assets failed:", e));
