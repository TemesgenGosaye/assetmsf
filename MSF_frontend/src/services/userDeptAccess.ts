/**
 * User Department Access – talks to Django REST /api/user-dept-access/
 * Supabase removed: all reads/writes via djangoRequest with localStorage fallback
 */
import { djangoRequest } from "./djangoAuth";

const LS_KEY = "user_dept_access"; // { [userId: string]: string[] }

function readLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, string[]>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function listUserDepartmentAccess(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const res = await djangoRequest<any>(`/user-dept-access/?user_id=${userId}`);
    if (res.success) {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      const depts: string[] = raw.map((r: any) => String(r.department_name || r.department));
      const map = readLocal();
      map[userId] = depts;
      writeLocal(map);
      return depts;
    }
  } catch {}
  const map = readLocal();
  return map[userId] || [];
}

export async function setUserDepartmentAccess(userId: string, depts: string[]): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set(depts));
  const map = readLocal();
  map[userId] = uniq;
  writeLocal(map);
  try {
    await djangoRequest(`/user-dept-access/set/`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, departments: uniq }),
    });
  } catch {}
}

export async function getAccessibleDepartmentsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem("current_user_id");
    if (!uid) return new Set();

    const depts = await listUserDepartmentAccess(uid);
    return new Set(depts);
  } catch {
    return new Set();
  }
}
