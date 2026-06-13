'use client';
import { useState, useEffect, useRef } from 'react';
import {
  getHospitalSettings, setHospitalSettings,
  getRoomTypes, addRoomType, updateRoomType, deleteRoomType, todayStr, genId,
} from '@/lib/store';
import { fetchLicenseInfo } from '@/lib/db-bridge';
import type { HospitalSettings, RoomType } from '@/lib/types';

const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

/* ========== TOGGLE SWITCH ========== */
function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'peer-checked:bg-amber-500 peer-focus:ring-amber-300',
    green: 'peer-checked:bg-green-500 peer-focus:ring-green-300',
    red: 'peer-checked:bg-red-500 peer-focus:ring-red-300',
    purple: 'peer-checked:bg-purple-500 peer-focus:ring-purple-300',
  };
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className={`w-12 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colorMap[color] || colorMap.amber}`} />
    </label>
  );
}

/* ========== LICENSE TYPE HELPERS ========== */
type LicenseType = 'hospital' | 'clinic' | 'pharmacy' | 'lab' | 'demo' | 'none';

function getLicenseType(info: any): LicenseType {
  if (!info) return 'none';
  if (info.mode === 'none' || !info.mode) return 'none';
  if (info.mode === 'demo') return 'demo';
  return info.licenseType || 'none';
}

interface SectionVisibility {
  showHospitalInfo: boolean;         // SECTION 0: License & Hospital Info (always shown for licensed/demo)
  showReceptionPayments: boolean;    // SECTION: Reception Payment Controls
  showReceptionOnlyPharmacyLab: boolean; // For clinic: only Pharmacy + Lab toggles
  showRoomWardCharges: boolean;      // SECTION: Room & Ward Charges
  showReceiptSettings: boolean;      // SECTION: Receipt Settings
  showRoomTypesManagement: boolean;  // SECTION: Room Types Management
  showPrintSettings: boolean;        // SECTION: Print Settings
  showLabReportSticker: boolean;     // SECTION: Lab Report & Sticker Settings
  showSystemInfo: boolean;           // SECTION: System Info
  showActiveModules: boolean;        // SECTION: Active Modules
}

function getSectionVisibility(licenseType: LicenseType): SectionVisibility {
  switch (licenseType) {
    case 'hospital':
    case 'demo':
      return {
        showHospitalInfo: true,
        showReceptionPayments: true,
        showReceptionOnlyPharmacyLab: false,
        showRoomWardCharges: true,
        showReceiptSettings: true,
        showRoomTypesManagement: true,
        showPrintSettings: true,
        showLabReportSticker: true,
        showSystemInfo: true,
        showActiveModules: true,
      };
    case 'clinic':
      return {
        showHospitalInfo: true,
        showReceptionPayments: true,
        showReceptionOnlyPharmacyLab: true, // Only Pharmacy + Lab toggles
        showRoomWardCharges: false,
        showReceiptSettings: true,
        showRoomTypesManagement: false,
        showPrintSettings: true,
        showLabReportSticker: false,
        showSystemInfo: true,
        showActiveModules: true,
      };
    case 'pharmacy':
      return {
        showHospitalInfo: true,
        showReceptionPayments: false,
        showReceptionOnlyPharmacyLab: false,
        showRoomWardCharges: false,
        showReceiptSettings: true,
        showRoomTypesManagement: false,
        showPrintSettings: true,
        showLabReportSticker: false,
        showSystemInfo: true,
        showActiveModules: true,
      };
    case 'lab':
      return {
        showHospitalInfo: true,
        showReceptionPayments: false,
        showReceptionOnlyPharmacyLab: false,
        showRoomWardCharges: false,
        showReceiptSettings: true,
        showRoomTypesManagement: false,
        showPrintSettings: true,
        showLabReportSticker: true,
        showSystemInfo: true,
        showActiveModules: true,
      };
    case 'none':
    default:
      return {
        showHospitalInfo: false,
        showReceptionPayments: false,
        showReceptionOnlyPharmacyLab: false,
        showRoomWardCharges: false,
        showReceiptSettings: false,
        showRoomTypesManagement: false,
        showPrintSettings: false,
        showLabReportSticker: false,
        showSystemInfo: true,
        showActiveModules: true,
      };
  }
}

function getActiveModules(licenseType: LicenseType): { name: string; status: string }[] {
  switch (licenseType) {
    case 'hospital':
    case 'demo':
      return [
        { name: 'Reception', status: 'Active' },
        { name: 'Patients', status: 'Active' },
        { name: 'Doctors', status: 'Active' },
        { name: 'Pharmacy', status: 'Active' },
        { name: 'Laboratory', status: 'Active' },
        { name: 'X-Ray', status: 'Active' },
        { name: 'Ultrasound', status: 'Active' },
        { name: 'Admission', status: 'Active' },
        { name: 'Accounts', status: 'Active' },
        { name: 'HR', status: 'Active' },
      ];
    case 'clinic':
      return [
        { name: 'Reception', status: 'Active' },
        { name: 'Patients', status: 'Active' },
        { name: 'Doctors', status: 'Active' },
        { name: 'Pharmacy', status: 'Active' },
        { name: 'Laboratory', status: 'Active' },
        { name: 'Accounts', status: 'Active' },
      ];
    case 'pharmacy':
      return [
        { name: 'Pharmacy', status: 'Active' },
      ];
    case 'lab':
      return [
        { name: 'Laboratory', status: 'Active' },
      ];
    case 'none':
    default:
      return [];
  }
}

/* ========== MAIN COMPONENT ========== */
export default function SettingsPage() {
  const [settings, setSettingsState] = useState<HospitalSettings>({
    receptionCanCollectPharmacy: true, receptionCanCollectLab: true,
    receptionCanCollectXray: true, receptionCanCollectUltrasound: true,
    currency: 'Rs.', receiptFooter: '', roomChargesPerNight: 1500,
    wardChargesPerDay: 1000, hospitalCutRatio: 40, admissionFee: 2000,
    printerName: 'Default Printer', printerIP: '127.0.0.1', printerPort: 9100,
    receiptSize: 'A4', labInChargeDoctor: '',
    stickerWidth: 80, stickerHeight: 40,
    stickerShowHospital: true, stickerShowPatientAge: true, stickerShowTests: true,
  });
  const [roomTypes, setRoomTypesState] = useState<RoomType[]>([]);
  const [saved, setSaved] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [logoSrc, setLogoSrc] = useState<string>('');
  const [logoIsCustom, setLogoIsCustom] = useState<boolean>(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [changeLicenseKey, setChangeLicenseKey] = useState('');
  const [changeLicenseLoading, setChangeLicenseLoading] = useState(false);
  const [changeLicenseError, setChangeLicenseError] = useState('');
  const [changeLicenseSuccess, setChangeLicenseSuccess] = useState('');
  const [appVersion, setAppVersion] = useState('...');
  const [isAdmin, setIsAdmin] = useState(false);

  // Update Diagnostics
  const [updateDiag, setUpdateDiag] = useState<{
    status: string;
    lastChecked: string | null;
    latestVersion: string | null;
    error: string | null;
    checking: boolean;
    downloadPercent: number;
    downloadedFile: string | null;
  }>({ status: 'idle', lastChecked: null, latestVersion: null, error: null, checking: false, downloadPercent: 0, downloadedFile: null });

  // Room type modal
  const [roomModal, setRoomModal] = useState(false);
  const [roomEditId, setRoomEditId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCharges, setRoomCharges] = useState(0);

  // Refs
  const logoInputRef = useRef<HTMLInputElement>(null);

  const licenseType = getLicenseType(licenseInfo);
  const visibility = getSectionVisibility(licenseType);
  const activeModules = getActiveModules(licenseType);

  useEffect(() => {
    setSettingsState(getHospitalSettings());
    setRoomTypesState(getRoomTypes());
    // Check admin role from session
    try {
      const sess = JSON.parse(localStorage.getItem('baga_session') || '{}');
      setIsAdmin(sess.role === 'admin' || sess.role === 'Admin' || sess.role === 'main_admin' || sess.role === 'Main Admin');
    } catch {}
    // Load license info
    if (isElectron) {
      fetchLicenseInfo().then(info => {
        setLicenseInfo(info);
        // Load logo
        if (info.logoPath) {
          try {
            (window as any).bagaAPI.getLogoBase64().then((r: any) => {
              if (r.success) {
                setLogoSrc(r.data);
                setLogoIsCustom(r.data?.isCustom === true);
              }
            });
          } catch (e) {}
        } else if (info.logoUrl) {
          setLogoSrc(info.logoUrl);
        }
        // Load app version
        try {
          (window as any).bagaAPI.getAppVersion().then((v: string) => setAppVersion(v || 'Unknown'));
        } catch (e) { setAppVersion('Unknown'); }
        if (!info.logoPath && !info.logoUrl) {
          setLogoIsCustom(false);
        }
      }).catch(() => {});
    }
    // Listen for update-status IPC events
    if (isElectron) {
      try {
        (window as any).bagaAPI.onUpdateStatus((data: any) => {
          console.log('[Settings] update-status received:', data);
          setUpdateDiag(prev => ({
            ...prev,
            status: data.status || prev.status,
            lastChecked: data.lastChecked || prev.lastChecked,
            latestVersion: data.version || prev.latestVersion,
            error: data.message || data.error || null,
            checking: data.status === 'checking' || data.status === 'downloading',
            downloadPercent: data.percent ?? prev.downloadPercent,
            downloadedFile: data.filePath || prev.downloadedFile,
          }));
        });
      } catch (e) {}
    }
  }, []);

  const showToast = (msg: string) => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    return msg;
  };

  // ---- Settings ----
  const handleSaveSettings = () => { setHospitalSettings(settings); showToast('saved'); };
  const updateSetting = (key: keyof HospitalSettings, value: boolean | string | number) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  };

  // ---- Room & Ward Charges ----
  const handleSaveCharges = () => { setHospitalSettings(settings); showToast('saved'); };

  // ---- Room Types CRUD ----
  const openAddRoom = () => { setRoomEditId(null); setRoomName(''); setRoomCharges(0); setRoomModal(true); };
  const openEditRoom = (rt: RoomType) => { setRoomEditId(rt.id); setRoomName(rt.name); setRoomCharges(rt.chargesPerNight); setRoomModal(true); };
  const handleSaveRoom = () => {
    if (!roomName.trim()) return;
    if (roomEditId) {
      updateRoomType(roomEditId, { name: roomName.trim(), chargesPerNight: roomCharges });
    } else {
      addRoomType({ id: genId(), name: roomName.trim(), chargesPerNight: roomCharges, active: true });
    }
    setRoomTypesState(getRoomTypes());
    setRoomModal(false);
    showToast('saved');
  };
  const handleToggleRoom = (id: string, active: boolean) => {
    updateRoomType(id, { active });
    setRoomTypesState(getRoomTypes());
  };
  const handleDeleteRoom = (id: string) => {
    if (!confirm('Are you sure you want to delete this room type?')) return;
    deleteRoomType(id);
    setRoomTypesState(getRoomTypes());
  };

  // ---- Logo Upload ----
  const handleLogoUpload = async () => {
    setLogoUploading(true);
    try {
      if (isElectron) {
        const fileResult = await (window as any).bagaAPI.selectLogoFile();
        if (!fileResult.success || fileResult.canceled) {
          setLogoUploading(false);
          return;
        }
        const saveResult = await (window as any).bagaAPI.saveLogo(fileResult.data, fileResult.mimeType);
        if (saveResult.success) {
          const r = await (window as any).bagaAPI.getLogoBase64();
          if (r.success) {
            setLogoSrc(r.data);
            setLogoIsCustom(true);
          }
          showToast('Logo updated successfully!');
        } else {
          alert('Failed to save logo. Please try again.');
        }
      } else {
        if (logoInputRef.current) {
          logoInputRef.current.click();
        }
      }
      setLogoUploading(false);
    } catch (err) {
      alert('Failed to process logo.');
      setLogoUploading(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { alert('Please select a PNG or JPEG image.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Logo file must be less than 2MB.'); return; }
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          await (window as any).bagaAPI.saveLogo(base64Data, file.type);
          const r = await (window as any).bagaAPI.getLogoBase64();
          if (r.success) { setLogoSrc(r.data); setLogoIsCustom(true); }
          showToast('Logo updated successfully!');
        } catch (err) { alert('Failed to save logo. Please try again.'); }
        setLogoUploading(false);
      };
      reader.onerror = () => { alert('Failed to read file.'); setLogoUploading(false); };
      reader.readAsDataURL(file);
    } catch (err) { alert('Failed to process logo.'); setLogoUploading(false); }
    if (logoInputRef.current) { logoInputRef.current.value = ''; }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the custom logo? The default logo will be restored.')) return;
    try {
      await (window as any).bagaAPI.removeLogo();
      // Reload logo
      const r = await (window as any).bagaAPI.getLogoBase64();
      if (r.success) {
        setLogoSrc(r.data);
        setLogoIsCustom(false);
      }
      showToast('Logo removed successfully!');
    } catch (err) {
      alert('Failed to remove logo.');
    }
  };

  // ---- Change License ----
  const handleChangeLicense = async () => {
    if (!changeLicenseKey.trim()) return;
    setChangeLicenseLoading(true);
    setChangeLicenseError('');
    setChangeLicenseSuccess('');
    try {
      await (window as any).bagaAPI.resetLicense();
      const result = await (window as any).bagaAPI.activateLicense(changeLicenseKey.trim());
      if (result.success) {
        setChangeLicenseSuccess('License activated successfully! Reloading software...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setChangeLicenseError(result.error || 'Failed to activate new license');
      }
    } catch (e: any) {
      setChangeLicenseError('Connection error. Please check your internet and try again.');
    }
    setChangeLicenseLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for logo upload */}
      <input
        type="file"
        ref={logoInputRef}
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleLogoFileChange}
      />

      {/* Toast */}
      {saved && <div className="toast toast-success">Settings saved successfully!</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">System Settings</h2>
      </div>

      {/* ==================== SECTION 0: License & Hospital Information ==================== */}
      {visibility.showHospitalInfo && licenseInfo && (licenseInfo.mode === 'licensed' || licenseInfo.mode === 'demo') && (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-8.494a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            License & Hospital Information
            <span className="ml-2 badge badge-blue text-xs">From Admin Panel</span>
          </h3>
          <p className="text-sm text-slate-500 mb-4">This information is managed from the BAGA Admin Panel and is automatically synced to your software when the license is activated. To change any of these details, please contact BAGA support or update through the admin panel.</p>

          <div className="flex items-start gap-6 mb-6">
            {/* Hospital Logo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {logoSrc ? (
                  <img src={logoSrc} alt="Hospital Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <div className="text-center p-2">
                    <svg className="w-8 h-8 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-[10px] text-slate-400 mt-1">No Logo</p>
                  </div>
                )}
              </div>
              {/* Logo Upload / Remove Buttons */}
              <div className="mt-2 space-y-1">
                <button
                  onClick={handleLogoUpload}
                  disabled={logoUploading}
                  className="btn btn-outline btn-sm w-full text-xs"
                  style={{ opacity: logoUploading ? 0.5 : 1 }}
                >
                  {logoUploading ? 'Uploading...' : 'Change Logo'}
                </button>
                {logoIsCustom && (
                  <button
                    onClick={handleRemoveLogo}
                    className="btn btn-danger btn-sm w-full text-xs"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>

            {/* Hospital Details */}
            <div className="flex-1 space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Hospital Name</p>
                  <p className="font-semibold text-slate-800">{licenseInfo.hospitalName || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">License Number</p>
                  <p className="font-mono font-semibold text-blue-600">{licenseInfo.licenseKey || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">License Type</p>
                  <p className="font-semibold text-slate-800">
                    {licenseInfo.licenseType === 'hospital' ? 'Hospital Management System' :
                     licenseInfo.licenseType === 'clinic' ? 'Clinic Management System' :
                     licenseInfo.licenseType === 'pharmacy' ? 'Pharmacy Management System' :
                     'Laboratory Information System'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">{licenseInfo.licenseDuration === 'lifetime' ? 'Duration' : 'Expiry Date'}</p>
                  <p className="font-semibold text-slate-800">
                    {licenseInfo.licenseDuration === 'lifetime' ? 'Lifetime License' : licenseInfo.expiryDate ? new Date(licenseInfo.expiryDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Phone / Mobile</p>
                  <p className="font-semibold text-slate-800">
                    {licenseInfo.hospitalPhone || '-'}{licenseInfo.hospitalMobile ? ` / ${licenseInfo.hospitalMobile}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Email</p>
                  <p className="font-semibold text-slate-800">{licenseInfo.hospitalEmail || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Address</p>
                  <p className="font-semibold text-slate-800">{licenseInfo.hospitalAddress || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {licenseInfo.mode === 'demo' && licenseInfo.demo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <p className="text-amber-800 text-sm font-medium">Demo Mode: {licenseInfo.demo.remaining} day(s) remaining. Purchase a license for full access.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== No License Warning ==================== */}
      {licenseType === 'none' && (
        <div className="bg-white rounded-xl border-2 border-red-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            No Active License
          </h3>
          <p className="text-sm text-slate-500 mb-4">Your software is not licensed. Please activate a license to unlock all features. Contact BAGA support for assistance.</p>
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <span className="badge badge-red">Unlicensed</span>
            <span className="text-sm text-red-700">Most settings are disabled until a license is activated.</span>
          </div>
        </div>
      )}

      {/* ==================== Change License ==================== */}
      {isElectron && licenseInfo?.mode === 'licensed' && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Change License
          </h3>
          <p className="text-sm text-slate-500 mb-4">If you want to upgrade or change your license (e.g., from Clinic to Hospital), enter the new license key below. Your current license will be replaced and the software will rebrand with new hospital information.</p>
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-sm text-slate-500">Current License:</span>
            <span className="font-mono font-bold text-emerald-600 text-sm">{licenseInfo.licenseKey || 'N/A'}</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={changeLicenseKey}
              onChange={e => setChangeLicenseKey(e.target.value)}
              placeholder="Enter new license key (BAGA-XXXXX-XXXXX)"
              className="form-input flex-1 font-mono text-center tracking-wider"
            />
            <button
              onClick={handleChangeLicense}
              disabled={changeLicenseLoading || !changeLicenseKey.trim()}
              className="btn btn-primary"
              style={{ opacity: changeLicenseLoading || !changeLicenseKey.trim() ? 0.5 : 1 }}
            >
              {changeLicenseLoading ? 'Activating...' : 'Change License'}
            </button>
          </div>
          {changeLicenseError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{changeLicenseError}</div>
          )}
          {changeLicenseSuccess && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{changeLicenseSuccess}</div>
          )}
        </div>
      )}

      {/* ==================== SECTION: Reception Payment Controls ==================== */}
      {visibility.showReceptionPayments && (
        <div className="bg-white rounded-xl border-2 border-amber-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Reception Payment Controls
          </h3>
          <p className="text-sm text-slate-500 mb-4">Control which payments the reception staff can collect. If OFF, patients pay directly at the respective department.</p>

          <div className="space-y-4">
            {/* Pharmacy Payment - always shown when reception payments visible */}
            <div className="flex items-center justify-between p-4 border border-amber-100 rounded-lg bg-amber-50">
              <div>
                <p className="font-semibold text-slate-800">Pharmacy Payment at Reception</p>
                <p className="text-xs text-slate-500 mt-1">If ON: Reception collects medicine payment. If OFF: Patients pay at Pharmacy counter.</p>
              </div>
              <Toggle checked={settings.receptionCanCollectPharmacy} onChange={v => updateSetting('receptionCanCollectPharmacy', v)} color="amber" />
            </div>

            {/* Lab Payment - always shown when reception payments visible */}
            <div className="flex items-center justify-between p-4 border border-green-100 rounded-lg bg-green-50">
              <div>
                <p className="font-semibold text-slate-800">Lab Payment at Reception</p>
                <p className="text-xs text-slate-500 mt-1">If ON: Reception collects lab test payment. If OFF: Patients pay at Lab counter.</p>
              </div>
              <Toggle checked={settings.receptionCanCollectLab} onChange={v => updateSetting('receptionCanCollectLab', v)} color="green" />
            </div>

            {/* X-Ray & Ultrasound - only for hospital/demo (not clinic) */}
            {!visibility.showReceptionOnlyPharmacyLab && (
              <>
                <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50">
                  <div>
                    <p className="font-semibold text-slate-800">X-Ray Payment at Reception</p>
                    <p className="text-xs text-slate-500 mt-1">If ON: Reception collects X-ray payment. If OFF: Patients pay at X-Ray department.</p>
                  </div>
                  <Toggle checked={settings.receptionCanCollectXray} onChange={v => updateSetting('receptionCanCollectXray', v)} color="red" />
                </div>

                <div className="flex items-center justify-between p-4 border border-purple-100 rounded-lg bg-purple-50">
                  <div>
                    <p className="font-semibold text-slate-800">Ultrasound Payment at Reception</p>
                    <p className="text-xs text-slate-500 mt-1">If ON: Reception collects ultrasound payment. If OFF: Patients pay at Ultrasound department.</p>
                  </div>
                  <Toggle checked={settings.receptionCanCollectUltrasound} onChange={v => updateSetting('receptionCanCollectUltrasound', v)} color="purple" />
                </div>
              </>
            )}
          </div>

          <button onClick={handleSaveSettings} className="btn btn-primary mt-5">Save Permission Settings</button>
        </div>
      )}

      {/* ==================== SECTION: Room & Ward Charges ==================== */}
      {visibility.showRoomWardCharges && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Room & Ward Charges
          </h3>
          <p className="text-sm text-slate-500 mb-4">Configure default charges for room, ward, hospital cut ratio, and admission fee.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Room Charges Per Night</label>
              <input type="number" className="form-input" value={settings.roomChargesPerNight} onChange={e => updateSetting('roomChargesPerNight', Number(e.target.value))} min={0} />
              <p className="text-xs text-slate-400 mt-1">Default room charge applied per night stay</p>
            </div>
            <div>
              <label className="form-label">Ward Charges Per Day</label>
              <input type="number" className="form-input" value={settings.wardChargesPerDay} onChange={e => updateSetting('wardChargesPerDay', Number(e.target.value))} min={0} />
              <p className="text-xs text-slate-400 mt-1">Default ward charge applied per day stay</p>
            </div>
            <div>
              <label className="form-label">Hospital Cut Ratio (%)</label>
              <input type="number" className="form-input" value={settings.hospitalCutRatio} onChange={e => updateSetting('hospitalCutRatio', Number(e.target.value))} min={0} max={100} />
              <p className="text-xs text-slate-400 mt-1">Percentage of room charges that goes to hospital (e.g. 40 means 40%)</p>
            </div>
            <div>
              <label className="form-label">Default Admission Fee</label>
              <input type="number" className="form-input" value={settings.admissionFee} onChange={e => updateSetting('admissionFee', Number(e.target.value))} min={0} />
              <p className="text-xs text-slate-400 mt-1">One-time admission processing fee</p>
            </div>
          </div>
          <button onClick={handleSaveCharges} className="btn btn-primary mt-4">Save Room & Ward Charges</button>
        </div>
      )}

      {/* ==================== SECTION: Receipt Settings ==================== */}
      {visibility.showReceiptSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Receipt Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Currency Symbol</label>
              <input className="form-input" value={settings.currency} onChange={e => updateSetting('currency', e.target.value)} placeholder="Rs." />
            </div>
            <div>
              <label className="form-label">Receipt Footer Text</label>
              <input className="form-input" value={settings.receiptFooter} onChange={e => updateSetting('receiptFooter', e.target.value)} placeholder="Thank you message..." />
            </div>
          </div>
          <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Receipt Settings</button>
        </div>
      )}

      {/* ==================== SECTION: Room Types Management ==================== */}
      {visibility.showRoomTypesManagement && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                Room Types Management
              </h3>
              <button onClick={openAddRoom} className="btn btn-primary btn-sm">+ Add Room Type</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Manage room types and their per-night charges. These are used when admitting patients.</p>

            {roomTypes.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-3xl mb-2">&#127968;</p>
                <p className="font-semibold">No room types configured</p>
                <p className="text-sm">Click &quot;Add Room Type&quot; to create one</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Room Type Name</th>
                      <th>Charges Per Night</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomTypes.map((rt, i) => (
                      <tr key={rt.id}>
                        <td className="font-semibold">{i + 1}</td>
                        <td className="font-semibold">{rt.name}</td>
                        <td>
                          <span className="font-mono font-bold text-emerald-700">{settings.currency} {rt.chargesPerNight.toLocaleString()}</span>
                        </td>
                        <td>
                          <Toggle checked={rt.active} onChange={v => handleToggleRoom(rt.id, v)} color={rt.active ? 'green' : 'red'} />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => openEditRoom(rt)} className="btn btn-outline btn-sm">Edit</button>
                            <button onClick={() => handleDeleteRoom(rt.id)} className="btn btn-danger btn-sm">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Room Type Modal */}
          {roomModal && (
            <div className="modal-overlay" onClick={() => setRoomModal(false)}>
              <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{roomEditId ? 'Edit Room Type' : 'Add New Room Type'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Room Type Name *</label>
                    <input
                      className="form-input"
                      value={roomName}
                      onChange={e => setRoomName(e.target.value)}
                      placeholder="e.g. Private Room, ICU, General Ward"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveRoom()}
                    />
                  </div>
                  <div>
                    <label className="form-label">Charges Per Night *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={roomCharges}
                      onChange={e => setRoomCharges(Number(e.target.value))}
                      min={0}
                      placeholder="e.g. 5000"
                      onKeyDown={e => e.key === 'Enter' && handleSaveRoom()}
                    />
                    <p className="text-xs text-slate-400 mt-1">Per night charge for this room type</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setRoomModal(false)} className="btn btn-outline flex-1">Cancel</button>
                  <button onClick={handleSaveRoom} className="btn btn-primary flex-1">{roomEditId ? 'Update' : 'Add'} Room Type</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== SECTION: System Info & Update Diagnostics ==================== */}
      {visibility.showSystemInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">System Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Version</span>
              <span className="font-medium">{appVersion}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">System Name</span>
              <span className="font-medium">BAGA Hospital Management System</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Mode</span>
              <span className="badge badge-blue">Offline Mode</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Database</span>
              <span className="badge badge-green">Local Storage (Offline)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Last Updated</span>
              <span className="font-medium">{todayStr()}</span>
            </div>
          </div>

          {/* Update Diagnostics */}
          {isElectron && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Update Diagnostics
                </h4>
                <button
                  onClick={() => {
                    setUpdateDiag(prev => ({ ...prev, checking: true, error: null }));
                    try { (window as any).bagaAPI.manualCheckUpdate(); } catch (e: any) {
                      setUpdateDiag(prev => ({ ...prev, checking: false, error: e.message }));
                    }
                  }}
                  disabled={updateDiag.checking}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition font-medium text-sm"
                >
                  {updateDiag.checking ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Checking...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Check Now</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Last Check</span>
                  <span className="font-mono text-xs font-medium">
                    {updateDiag.lastChecked ? new Date(updateDiag.lastChecked).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-semibold text-xs uppercase ${
                    updateDiag.status === 'checking' ? 'text-amber-600' :
                    updateDiag.status === 'available' || updateDiag.status === 'downloaded' ? 'text-emerald-600' :
                    updateDiag.status === 'error' ? 'text-red-600' :
                    updateDiag.status === 'not-available' ? 'text-blue-600' :
                    'text-slate-500'
                  }`}>
                    {updateDiag.status === 'checking' ? '⏳ Checking...' :
                     updateDiag.status === 'available' ? '✅ Update Found' :
                     updateDiag.status === 'downloading' ? '⬇️ Downloading...' :
                     updateDiag.status === 'downloaded' ? '✅ Ready to Install' :
                     updateDiag.status === 'error' ? '❌ Error' :
                     updateDiag.status === 'not-available' ? '✅ Up to Date' :
                     '● Idle'}
                  </span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Latest Found</span>
                  <span className="font-mono font-medium">{updateDiag.latestVersion || '-'}</span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Installed</span>
                  <span className="font-mono font-medium">{appVersion}</span>
                </div>
              </div>

              {updateDiag.error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">Error Details:</p>
                  <p className="text-xs text-red-600 font-mono break-all">{updateDiag.error}</p>
                </div>
              )}

              {/* Download Progress Bar */}
              {updateDiag.status === 'downloading' && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-600 font-medium">Downloading update...</span>
                    <span className="text-xs font-bold text-emerald-600">{updateDiag.downloadPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: updateDiag.downloadPercent + '%' }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Buttons when update found */}
              {updateDiag.status === 'available' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setUpdateDiag(prev => ({ ...prev, checking: true }));
                      try { (window as any).bagaAPI.manualCheckUpdate(); } catch (e: any) {
                        setUpdateDiag(prev => ({ ...prev, checking: false, error: e.message }));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download v{updateDiag.latestVersion}
                  </button>
                </div>
              )}

              {/* Install button when downloaded */}
              {updateDiag.status === 'downloaded' && (
                <div className="mt-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-2">
                    <p className="text-xs font-semibold text-emerald-700">Update v{updateDiag.latestVersion} downloaded successfully!</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        try { (window as any).bagaAPI.openUpdateFile(updateDiag.downloadedFile); } catch (e: any) { alert('Error: ' + e.message); }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Install Now
                    </button>
                    <button
                      onClick={() => {
                        setUpdateDiag({ status: 'idle', lastChecked: null, latestVersion: null, error: null, checking: false, downloadPercent: 0, downloadedFile: null });
                      }}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg transition font-medium text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== SECTION: Print Settings ==================== */}
      {visibility.showPrintSettings && (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print Settings
          </h3>
          <p className="text-sm text-slate-500 mb-4">Configure printer settings for receipts, reports, and stickers across all departments.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Printer Name</label>
              <input className="form-input" value={settings.printerName} onChange={e => updateSetting('printerName', e.target.value)} placeholder="e.g. HP LaserJet" />
              <p className="text-xs text-slate-400 mt-1">Name of the default printer used in the system</p>
            </div>
            <div>
              <label className="form-label">Receipt / Print Size</label>
              <select className="form-input" value={settings.receiptSize} onChange={e => updateSetting('receiptSize', e.target.value)}>
                <option value="A4">A4 (Full Page)</option>
                <option value="a5">A5 (Half Page)</option>
                <option value="thermal">Thermal / Small Receipt</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">A4 for full reports, Thermal for small receipts</p>
            </div>
            <div>
              <label className="form-label">Printer IP Address</label>
              <input className="form-input" value={settings.printerIP} onChange={e => updateSetting('printerIP', e.target.value)} placeholder="e.g. 192.168.1.100" />
              <p className="text-xs text-slate-400 mt-1">Network printer IP address (if applicable)</p>
            </div>
            <div>
              <label className="form-label">Printer Port</label>
              <input type="number" className="form-input" value={settings.printerPort} onChange={e => updateSetting('printerPort', Number(e.target.value))} placeholder="9100" />
              <p className="text-xs text-slate-400 mt-1">Network printer port (default: 9100)</p>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Print Settings</button>
        </div>
      )}

      {/* ==================== SECTION: Lab Report & Sticker Settings ==================== */}
      {visibility.showLabReportSticker && (
        <div className="bg-white rounded-xl border-2 border-teal-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Lab Report & Sticker Settings
          </h3>
          <p className="text-sm text-slate-500 mb-4">Configure Lab In-Charge Doctor name (appears on reports) and sticker design settings.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Lab In-Charge Doctor Name</label>
              <input className="form-input" value={settings.labInChargeDoctor} onChange={e => updateSetting('labInChargeDoctor', e.target.value)} placeholder="e.g. Dr. Muhammad Ali" />
              <p className="text-xs text-slate-400 mt-1">This name will appear on all printed lab reports</p>
            </div>
            <div>
              <label className="form-label">Sticker Width (mm)</label>
              <input type="number" className="form-input" value={settings.stickerWidth} onChange={e => updateSetting('stickerWidth', Number(e.target.value))} min={30} max={200} />
              <p className="text-xs text-slate-400 mt-1">Width of lab sample sticker in millimeters</p>
            </div>
            <div>
              <label className="form-label">Sticker Height (mm)</label>
              <input type="number" className="form-input" value={settings.stickerHeight} onChange={e => updateSetting('stickerHeight', Number(e.target.value))} min={20} max={100} />
              <p className="text-xs text-slate-400 mt-1">Height of lab sample sticker in millimeters</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Show Hospital Name on Sticker</p>
                </div>
                <Toggle checked={settings.stickerShowHospital} onChange={v => updateSetting('stickerShowHospital', v)} color="green" />
              </div>
              <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Show Patient Age on Sticker</p>
                </div>
                <Toggle checked={settings.stickerShowPatientAge} onChange={v => updateSetting('stickerShowPatientAge', v)} color="green" />
              </div>
              <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Show Test Names on Sticker</p>
                </div>
                <Toggle checked={settings.stickerShowTests} onChange={v => updateSetting('stickerShowTests', v)} color="green" />
              </div>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Lab Settings</button>
        </div>
      )}

      {/* ==================== SECTION: Profit Report Password (Admin Only) ==================== */}
      {isAdmin && (
      <div className="bg-white rounded-xl border-2 border-emerald-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          Profit Report Password
        </h3>
        <p className="text-sm text-slate-500 mb-4">Set a password to protect the Net Profit report. Users must enter this password to view the profit calculation in the pharmacy statement.</p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter profit report password"
              id="profitPwdNew"
            />
          </div>
          <div>
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirm password"
              id="profitPwdConfirm"
            />
          </div>
          <button
            onClick={() => {
              const newPwd = (document.getElementById('profitPwdNew') as HTMLInputElement).value;
              const confirmPwd = (document.getElementById('profitPwdConfirm') as HTMLInputElement).value;
              if (!newPwd.trim()) { alert('Please enter a password'); return; }
              if (newPwd !== confirmPwd) { alert('Passwords do not match'); return; }
              if (newPwd.length < 3) { alert('Password must be at least 3 characters'); return; }
              localStorage.setItem('baga_profit_password', newPwd.trim());
              (document.getElementById('profitPwdNew') as HTMLInputElement).value = '';
              (document.getElementById('profitPwdConfirm') as HTMLInputElement).value = '';
              showToast('Profit password saved successfully!');
            }}
            className="btn btn-primary"
          >
            Save Profit Password
          </button>
          {localStorage.getItem('baga_profit_password') && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              A profit password is currently set
            </p>
          )}
        </div>
      </div>
      )}

      {/* ==================== SECTION: Active Modules ==================== */}
      {visibility.showActiveModules && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Active Modules</h3>
          {activeModules.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">No active modules. Activate a license to unlock modules.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {activeModules.map((mod, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 text-center">
                  <p className="font-medium text-sm text-slate-700">{mod.name}</p>
                  <span className={`badge mt-1 ${mod.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>{mod.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
