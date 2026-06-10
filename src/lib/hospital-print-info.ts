/* ========== SHARED HOSPITAL PRINT INFO ========== */
/*
 * Returns hospital name, address, phone, email, logo for use in all print templates.
 * In Electron: gets from license API and custom logo.
 * In Browser: falls back to localStorage.
 */

const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

export interface HospitalPrintInfo {
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalMobile: string;
  hospitalEmail: string;
  hospitalLogo: string;
}

/** Generate a standard print header with logo and hospital info */
export function generatePrintHeaderHtml(info: HospitalPrintInfo): string {
  const logoHtml = info.hospitalLogo
    ? `<img src="${info.hospitalLogo}" style="max-height:60px;max-width:120px;object-fit:contain;margin:0 auto 8px auto;display:block" />`
    : '';
  return `
  <div style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:16px">
    ${logoHtml}
    <h1 style="font-size:20px;color:#1e293b;margin:0">${info.hospitalName}</h1>
    ${info.hospitalAddress ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0">${info.hospitalAddress}</p>` : ''}
    ${(info.hospitalPhone || info.hospitalMobile) ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0">${[info.hospitalPhone, info.hospitalMobile].filter(Boolean).join(' | ')}</p>` : ''}
    ${info.hospitalEmail ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0">${info.hospitalEmail}</p>` : ''}
  </div>`;
}

/** Async version - gets fresh data from Electron APIs */
export async function getHospitalPrintInfoAsync(): Promise<HospitalPrintInfo> {
  let info: HospitalPrintInfo = {
    hospitalName: 'BAGA Hospital',
    hospitalAddress: '',
    hospitalPhone: '',
    hospitalMobile: '',
    hospitalEmail: '',
    hospitalLogo: '',
  };

  if (isElectron) {
    try {
      const licenseInfo = await (window as any).bagaAPI.getFullLicenseInfo();
      if (licenseInfo) {
        if (licenseInfo.hospitalName) info.hospitalName = licenseInfo.hospitalName;
        if (licenseInfo.hospitalAddress) info.hospitalAddress = licenseInfo.hospitalAddress;
        if (licenseInfo.hospitalPhone) info.hospitalPhone = licenseInfo.hospitalPhone;
        if (licenseInfo.hospitalMobile) info.hospitalMobile = licenseInfo.hospitalMobile;
        if (licenseInfo.hospitalEmail) info.hospitalEmail = licenseInfo.hospitalEmail;
      }
    } catch (e) {}

    try {
      const logoResult = await (window as any).bagaAPI.getLogoBase64();
      if (logoResult.success) info.hospitalLogo = logoResult.data;
    } catch (e) {}
  }

  // Fallback to localStorage
  try {
    const h = JSON.parse(localStorage.getItem('baga_hospital') || '{}');
    if (h.name && info.hospitalName === 'BAGA Hospital') info.hospitalName = h.name;
    if (h.address && !info.hospitalAddress) info.hospitalAddress = h.address;
    if (h.phone && !info.hospitalPhone) info.hospitalPhone = h.phone;
    if (h.email && !info.hospitalEmail) info.hospitalEmail = h.email;
  } catch {}

  return info;
}

/** Sync version - reads from localStorage only (for non-async contexts) */
export function getHospitalPrintInfoSync(): HospitalPrintInfo {
  let info: HospitalPrintInfo = {
    hospitalName: 'BAGA Hospital',
    hospitalAddress: '',
    hospitalPhone: '',
    hospitalMobile: '',
    hospitalEmail: '',
    hospitalLogo: '',
  };

  try {
    const h = JSON.parse(localStorage.getItem('baga_hospital') || '{}');
    if (h.name) info.hospitalName = h.name;
    if (h.address) info.hospitalAddress = h.address;
    if (h.phone) info.hospitalPhone = h.phone;
    if (h.email) info.hospitalEmail = h.email;
  } catch {}

  return info;
}
