/* ========== DB BRIDGE - Electron SQLite ↔ localStorage ↔ LAN API ========== */
/*
 * Detects the runtime environment and routes data operations:
 * 1. Electron (SQLite via IPC)
 * 2. LAN Sharing (HTTP API to main server)
 * 3. Browser fallback (localStorage)
 */

// Check if we're running inside Electron with the DB bridge
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).bagaAPI?.dbGetAll;
}

// Check if we're in LAN sharing mode (not Electron, but API server reachable)
let _lanMode: boolean | null = null;
export function isLanMode(): boolean {
  if (_lanMode !== null) return _lanMode;
  if (typeof window === 'undefined') { _lanMode = false; return false; }
  if (isElectron()) { _lanMode = false; return false; }
  try { _lanMode = localStorage.getItem('baga_lan_mode') === 'true'; } catch { _lanMode = false; }
  return _lanMode;
}
export function setLanMode(val: boolean): void {
  _lanMode = val;
  try { localStorage.setItem('baga_lan_mode', String(val)); } catch {}
}

function getLanBase(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
}

// LAN API helpers (synchronous XMLHttpRequest for store compatibility)
function lanGet(path: string): any {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', getLanBase() + path, false);
    xhr.send();
    if (xhr.status === 200) { const r = JSON.parse(xhr.responseText); return r.success ? r.data : null; }
  } catch {}
  return null;
}

function lanPost(path: string, data: any): boolean {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', getLanBase() + path, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
    return xhr.status === 200;
  } catch {}
  return false;
}

// Helper to safely call Electron DB — returns null when not in Electron
export function dbGetAll(table: string): any[] | null {
  if (isElectron()) { const result = (window as any).bagaAPI.dbGetAll(table); return result?.success ? result.data : null; }
  if (isLanMode()) return lanGet('/api/db/' + table);
  return null;
}

export function dbSetAll(table: string, data: any[]): boolean {
  if (isElectron()) { const result = (window as any).bagaAPI.dbSetAll(table, data); return result?.success ?? false; }
  if (isLanMode()) return lanPost('/api/db/' + table, { data });
  return false;
}

export function dbSetById(table: string, id: string, data: any): boolean {
  if (isElectron()) { const result = (window as any).bagaAPI.dbSetById(table, id, data); return result?.success ?? false; }
  // For LAN/localStorage, use setAll with updated array
  if (isLanMode()) {
    const all = lanGet('/api/db/' + table);
    if (all && Array.isArray(all)) {
      const idx = all.findIndex((item: any) => item.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...data }; return lanPost('/api/db/' + table, { data: all }); }
    }
  }
  return false;
}

export function dbGetCounter(key: string): number | null {
  if (isElectron()) { const result = (window as any).bagaAPI.dbGetCounter(key); return result?.success ? result.data : null; }
  if (isLanMode()) { const r = lanGet('/api/counter/' + key); return r !== null ? r : null; }
  return null;
}

export function dbSetCounter(key: string, value: number): boolean {
  if (isElectron()) { const result = (window as any).bagaAPI.dbSetCounter(key, value); return result?.success ?? false; }
  if (isLanMode()) return lanPost('/api/counter/' + key, { value });
  return false;
}

export function dbGetKV(key: string): string | null {
  if (isElectron()) { const result = (window as any).bagaAPI.dbGetKV(key); return result?.success ? result.data : null; }
  if (isLanMode()) { const r = lanGet('/api/kv/' + key); return r; }
  return null;
}

export function dbSetKV(key: string, value: any): boolean {
  if (isElectron()) { const result = (window as any).bagaAPI.dbSetKV(key, typeof value === 'string' ? value : JSON.stringify(value)); return result?.success ?? false; }
  if (isLanMode()) return lanPost('/api/kv/' + key, { value });
  return false;
}

// Session management
export function getSession(): any {
  if (typeof window === 'undefined') return null;
  if (isElectron()) {
    try { const kv = dbGetKV('baga_session'); if (kv) { const parsed = JSON.parse(kv); if (parsed && parsed.userId) return parsed; } } catch {}
  }
  if (isLanMode()) {
    try { const kv = dbGetKV('baga_session'); if (kv) { const parsed = JSON.parse(kv); if (parsed && parsed.userId) return parsed; } } catch {}
  }
  try { const s = localStorage.getItem('baga_session'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  if (isElectron()) { try { dbSetKV('baga_session', ''); } catch {} }
  if (isLanMode()) { try { dbSetKV('baga_session', ''); } catch {} }
  try { localStorage.removeItem('baga_session'); } catch {}
}

// Hospital data
export function getHospitalData(): any {
  if (typeof window === 'undefined') return {};
  if (isElectron()) { try { const data = dbGetAll('hospital'); if (data && data.length > 0) return data[0]; } catch {} }
  if (isLanMode()) { try { const data = dbGetAll('hospital'); if (data && data.length > 0) return data[0]; } catch {} }
  try { return JSON.parse(localStorage.getItem('baga_hospital') || '{}'); } catch { return {}; }
}

export function getHospitalSettingsData(): any {
  if (typeof window === 'undefined') return {};
  if (isElectron()) { try { const data = dbGetAll('hospital_settings'); if (data && data.length > 0) return data[0]; } catch {} }
  if (isLanMode()) { try { const data = dbGetAll('hospital_settings'); if (data && data.length > 0) return data[0]; } catch {} }
  try { return JSON.parse(localStorage.getItem('baga_hospital_settings') || '{}'); } catch { return {}; }
}

// License info - get from Electron API or LAN API
export function getFullLicenseInfo(): any {
  if (typeof window === 'undefined') return { mode: 'none', licenseType: 'hospital', features: [] };
  return { mode: 'none', licenseType: 'hospital', features: [] };
}

export async function fetchLicenseInfo(): Promise<any> {
  if (typeof window === 'undefined') return { mode: 'none', licenseType: 'hospital', features: [] };
  if (isElectron()) {
    try { const info = await (window as any).bagaAPI.getFullLicenseInfo(); return info; } catch {}
  }
  // LAN mode: fetch from server API
  if (isLanMode()) {
    try {
      const resp = await fetch(getLanBase() + '/api/license-info');
      if (resp.ok) return await resp.json();
    } catch {}
  }
  return { mode: 'none', licenseType: 'hospital', features: [] };
}

// Sync all data from LAN server to localStorage (called once after LAN login)
export async function syncDataFromServer(): Promise<boolean> {
  if (!isLanMode()) return false;
  const tables = ['hospital','hospital_settings','users','patients','medicines','prescriptions','bills','appointments','admissions','lab_orders','lab_test_catalog','room_types','employees','attendance','salaries','xray_orders','ultrasound_orders','dispenses','visits'];
  try {
    for (const table of tables) {
      const resp = await fetch(getLanBase() + '/api/db/' + table);
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && Array.isArray(result.data)) {
          localStorage.setItem('baga_' + (table === 'hospital' ? 'hospital' : table === 'hospital_settings' ? 'hospital_settings' : table), JSON.stringify(result.data));
        }
      }
    }
    // Sync KV pairs
    const kvKeys = ['baga_session', 'baga_patient_counter', 'baga_outdoor_counter', 'baga_employee_counter', 'baga_pharmacy_sales', 'baga_pharmacy_returns', 'baga_profit_password', 'baga_notif_cleared_at', 'baga_notif_cleared_ids'];
    for (const key of kvKeys) {
      const resp = await fetch(getLanBase() + '/api/kv/' + key);
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && result.data) {
          localStorage.setItem(key, result.data);
        }
      }
    }
    return true;
  } catch (e) {
    console.error('LAN data sync failed:', e);
    return false;
  }
}
