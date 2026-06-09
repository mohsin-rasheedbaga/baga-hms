/* ========== LICENSE ROUTE GUARD ========== */
import { isElectron, dbGetKV } from './db-bridge';

// Restricted routes per license type
const LICENSE_ROUTES: Record<string, string[]> = {
  pharmacy: ['/reception', '/reception/', '/lab', '/lab/', '/xray', '/xray/', '/ultrasound', '/ultrasound/', 
             '/accounts', '/accounts/', '/admission', '/admission/', '/doctors', '/doctors/',
             '/appointment', '/appointment/', '/hr', '/hr/', '/admin', '/admin/',
             '/patients', '/patients/', '/doctor', '/doctor/'],
  lab: ['/reception', '/reception/', '/pharmacy', '/pharmacy/', '/xray', '/xray/', '/ultrasound', '/ultrasound/',
        '/accounts', '/accounts/', '/admission', '/admission/', '/doctors', '/doctors/',
        '/appointment', '/appointment/', '/hr', '/hr/', '/admin', '/admin/',
        '/patients', '/patients/', '/doctor', '/doctor/'],
  clinic: ['/xray', '/xray/', '/ultrasound', '/ultrasound/', '/accounts', '/accounts/', 
           '/hr', '/hr/', '/admin', '/admin/', '/admission', '/admission/'],
};

// Allowed routes that are always accessible regardless of license
const ALWAYS_ALLOWED = ['/dashboard', '/users', '/settings', '/login'];

export function isRouteAllowed(pathname: string, licenseType: string): boolean {
  // Always allow these routes
  for (const allowed of ALWAYS_ALLOWED) {
    if (pathname === allowed || pathname.startsWith(allowed + '/')) return true;
  }
  
  // Check if route is restricted for this license type
  const restricted = LICENSE_ROUTES[licenseType];
  if (!restricted) return true; // hospital/demo - allow everything
  
  for (const blocked of restricted) {
    if (pathname === blocked || pathname.startsWith(blocked)) return false;
  }
  
  return true;
}

export function getLicenseType(): string {
  if (typeof window === 'undefined') return 'hospital';
  if (isElectron()) {
    try {
      const kv = dbGetKV('baga_license_info');
      if (kv) {
        const info = JSON.parse(kv);
        return info.licenseType || info.mode === 'demo' ? 'hospital' : 'hospital';
      }
    } catch {}
  }
  try {
    const session = JSON.parse(localStorage.getItem('baga_session') || '{}');
    return session.licenseType || 'hospital';
  } catch {
    return 'hospital';
  }
}