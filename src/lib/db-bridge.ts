/* ========== DB BRIDGE - Electron SQLite ↔ localStorage ========== */
/*
 * Detects Electron environment and provides low-level helpers
 * for calling window.bagaAPI.dbXxx() methods.
 *
 * The actual store.ts / lab-store.ts functions import from here
 * and route reads/writes to SQLite (Electron) or localStorage (browser).
 *
 * All calls are synchronous (sendSync under the hood) so existing
 * synchronous store functions work without refactoring.
 */

// Check if we're running inside Electron with the DB bridge
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).bagaAPI?.dbGetAll;
}

// Helper to safely call Electron DB — returns null when not in Electron
export function dbGetAll(table: string): any[] | null {
  if (!isElectron()) return null;
  const result = (window as any).bagaAPI.dbGetAll(table);
  return result?.success ? result.data : null;
}

export function dbSetAll(table: string, data: any[]): boolean {
  if (!isElectron()) return false;
  const result = (window as any).bagaAPI.dbSetAll(table, data);
  return result?.success ?? false;
}

export function dbSetById(table: string, id: string, data: any): boolean {
  if (!isElectron()) return false;
  const result = (window as any).bagaAPI.dbSetById(table, id, data);
  return result?.success ?? false;
}

export function dbGetCounter(key: string): number | null {
  if (!isElectron()) return null;
  const result = (window as any).bagaAPI.dbGetCounter(key);
  return result?.success ? result.data : null;
}

export function dbSetCounter(key: string, value: number): boolean {
  if (!isElectron()) return false;
  const result = (window as any).bagaAPI.dbSetCounter(key, value);
  return result?.success ?? false;
}

export function dbGetKV(key: string): string | null {
  if (!isElectron()) return null;
  const result = (window as any).bagaAPI.dbGetKV(key);
  return result?.success ? result.data : null;
}

export function dbSetKV(key: string, value: any): boolean {
  if (!isElectron()) return false;
  const result = (window as any).bagaAPI.dbSetKV(key, typeof value === 'string' ? value : JSON.stringify(value));
  return result?.success ?? false;
}

// Session management - checks SQLite first, then localStorage
export function getSession(): any {
  if (typeof window === 'undefined') return null;
  if (isElectron()) {
    try {
      const kv = dbGetKV('baga_session');
      if (kv) {
        const parsed = JSON.parse(kv);
        if (parsed && parsed.userId) return parsed;
      }
    } catch (e) {}
  }
  try {
    const s = localStorage.getItem('baga_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  if (isElectron()) {
    try { dbSetKV('baga_session', ''); } catch (e) {}
  }
  try { localStorage.removeItem('baga_session'); } catch (e) {}
}

// Hospital data - checks SQLite first, then localStorage
export function getHospitalData(): any {
  if (typeof window === 'undefined') return {};
  if (isElectron()) {
    try {
      const data = dbGetAll('hospital');
      if (data && data.length > 0) return data[0];
    } catch (e) {}
  }
  try { return JSON.parse(localStorage.getItem('baga_hospital') || '{}'); } catch { return {}; }
}

export function getHospitalSettingsData(): any {
  if (typeof window === 'undefined') return {};
  if (isElectron()) {
    try {
      const data = dbGetAll('hospital_settings');
      if (data && data.length > 0) return data[0];
    } catch (e) {}
  }
  try { return JSON.parse(localStorage.getItem('baga_hospital_settings') || '{}'); } catch { return {}; }
}

// License info - get from Electron API
export function getFullLicenseInfo(): any {
  if (typeof window === 'undefined') return { mode: 'none', licenseType: 'hospital', features: [] };
  if (isElectron()) {
    try {
      const info = (window as any).bagaAPI.getFullLicenseInfo();
      // This is async, so we store it after retrieval
      return info;
    } catch (e) {}
  }
  return { mode: 'none', licenseType: 'hospital', features: [] };
}

// Async version for use in useEffect
export async function fetchLicenseInfo(): Promise<any> {
  if (typeof window === 'undefined') return { mode: 'none', licenseType: 'hospital', features: [] };
  if (isElectron()) {
    try {
      const info = await (window as any).bagaAPI.getFullLicenseInfo();
      return info;
    } catch (e) {}
  }
  return { mode: 'none', licenseType: 'hospital', features: [] };
}
