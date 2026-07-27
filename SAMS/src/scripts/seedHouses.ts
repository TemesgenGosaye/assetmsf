// src/scripts/seedHouses.ts
// Seed script to create 30 sample houses for development.
// Run with: npm run seed

import { API_BASE_URL } from "../services/djangoAuth.ts";
import type { HouseFormData, HouseType, HouseStatus } from "../services/houses.ts";

async function getAuthToken(): Promise<string> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set; proceeding without auth');
    return '';
  }
  const resp = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    console.error('Login failed for seed script');
    return '';
  }
  const data = await resp.json();
  return data?.data?.access || '';
}

const houseTypes: HouseType[] = ["Staff", "A", "B", "C", "D", "E"];
const statuses: HouseStatus[] = ["Active", "Inactive"];
const damageKeys = ["damaged_door", "damaged_windows", "damaged_walls", "damaged_switch", "damaged_bulb", "damaged_water"] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool(probability = 0.2): boolean {
  return Math.random() < probability;
}

const locations = [
  "Main Factory – Block A", "Main Factory – Block B", "Main Factory – Block C",
  "Warehouse – North Wing", "Warehouse – South Wing", "Warehouse – East Wing",
  "Admin Building – Ground Floor", "Admin Building – First Floor",
  "R&D Lab – Room 101", "R&D Lab – Room 102", "R&D Lab – Room 103",
  "Workshop – Bay 1", "Workshop – Bay 2", "Workshop – Bay 3", "Workshop – Bay 4",
  "Office Tower – Floor 1", "Office Tower – Floor 2", "Office Tower – Floor 3",
  "Office Tower – Floor 4", "Office Tower – Floor 5",
  "Loading Dock – Zone A", "Loading Dock – Zone B",
  "Server Room – Building 1", "Server Room – Building 2",
  "Training Center – Hall A", "Training Center – Hall B",
  "Security Post – Gate 1", "Security Post – Gate 2",
  "Maintenance Shed", "Staff Quarters – Block D",
];

const descriptions = [
  "Primary production facility", "Raw material storage", "Finished goods warehouse",
  "Administrative offices", "Quality control lab", "Research and development",
  "Heavy machinery workshop", "Light assembly area", "Management offices",
  "Employee training facility", "IT infrastructure room", "Goods receiving bay",
  "Shipping and dispatch", "Tool and equipment storage", "Chemical storage unit",
  "Break room and canteen", "Security control center", "Visitor reception area",
  "Archive and records room", "Backup generator room", "HVAC mechanical room",
  "Electrical distribution room", "Parking attendant office", "Janitorial supply room",
  "Medical first-aid station", "Conference room complex", "Prototype testing area",
  "Waste management facility", "Outdoor equipment yard", "Staff dormitory",
];

const allInsideItems = [
  "desks", "chairs", "computers", "monitors", "printers", "shelves",
  "filing cabinets", "whiteboards", "projectors", "telephones",
  "machinery", "tools", "raw materials", "finished goods", "pallets",
  "forklifts", "conveyor belts", "workbenches", "safety equipment",
  "fire extinguishers", "first aid kits", "air conditioners", "racks",
];

function generateHouse(index: number): HouseFormData {
  const damaged: Partial<Record<typeof damageKeys[number], boolean>> = {};
  const insideItems: string[] = [];
  const numInside = Math.floor(Math.random() * 5) + 1;
  const shuffledItems = [...allInsideItems].sort(() => Math.random() - 0.5);
  for (let j = 0; j < numInside; j++) {
    insideItems.push(shuffledItems[j]);
  }

  return {
    location: locations[index % locations.length],
    house_type: pick(houseTypes),
    status: Math.random() < 0.8 ? "Active" : "Inactive",
    damaged_door: randomBool(0.15),
    damaged_windows: randomBool(0.1),
    damaged_walls: randomBool(0.12),
    damaged_switch: randomBool(0.08),
    damaged_bulb: randomBool(0.2),
    damaged_water: randomBool(0.05),
    inside_items: insideItems,
    description: descriptions[index % descriptions.length],
    capacity: Math.floor(Math.random() * 20) + 2,
  };
}

async function main() {
  const token = await getAuthToken();
  let created = 0;
  let failed = 0;

  for (let i = 0; i < 30; i++) {
    const data = generateHouse(i);
    try {
      const payload = { ...data } as any;
      delete payload.inside_items;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${API_BASE_URL}/houses/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.text();
        console.error(`Failed [${i + 1}] ${data.location}:`, err);
        failed++;
        continue;
      }
      const house = await response.json();
      console.log(`Created [${i + 1}] ${house.id} – ${data.location}`);
      created++;
    } catch (e: any) {
      console.error(`Failed [${i + 1}] ${data.location}:`, e.message);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${failed} failed out of 30.`);
}

main().catch((err) => console.error(err));
