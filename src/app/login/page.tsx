'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHospital, getUsers, setHospital, addUser, updateUser } from '@/lib/store';

const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

// Redirect to the correct home page based on license type
function getHomePath(lt: string): string {
  if (lt === 'pharmacy') return '/pharmacy';
  if (lt === 'lab') return '/lab';
  if (lt === 'reception') return '/reception';
  return '/dashboard';
}

export default function LoginPage() {
  const [hospital, setH] = useState({ name: 'BAGA Hospital', address: '', phone: '', email: '', licenseNo: 'BAGA-LIC-0001' });
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // License info state
  const [licenseMode, setLicenseMode] = useState<'none'|'licensed'|'demo'|'expired'>('none');
  const [licenseType, setLicenseType] = useState('hospital');
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [logoSrc, setLogoSrc] = useState<string>('');
  const [initLoading, setInitLoading] = useState(true);
  const [showChangeLicense, setShowChangeLicense] = useState(false);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [changeLicenseStatus, setChangeLicenseStatus] = useState({ loading: false, error: '', success: '' });
  const [appVersion, setAppVersion] = useState('3.5.7');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    async function init() {
      // Try to get license info from Electron
      if (isElectron) {
        try {
          // Get app version
          const ver = await (window as any).bagaAPI.getAppVersion();
          if (ver) setAppVersion(ver);
          
          const info = await (window as any).bagaAPI.getFullLicenseInfo();
          setLicenseInfo(info);
          setLicenseMode(info.mode);
          setLicenseType(info.licenseType || 'hospital');
          
          // Update hospital info from license
          if (info.hospitalName) {
            setH(prev => ({
              ...prev,
              name: info.hospitalName,
              address: info.hospitalAddress || prev.address,
              phone: info.hospitalPhone || prev.phone,
              email: info.hospitalEmail || prev.email,
              licenseNo: info.licenseKey || prev.licenseNo,
            }));
            const h = getHospital();
            setHospital({ 
              ...h, 
              name: info.hospitalName, 
              address: info.hospitalAddress || h.address, 
              phone: info.hospitalPhone || h.phone,
              email: info.hospitalEmail || h.email,
              licenseNo: info.licenseKey || h.licenseNo,
            });
          }
          
          // Load hospital logo
          if (isElectron && info.logoPath) {
            try {
              const logoResult = await (window as any).bagaAPI.getLogoBase64();
              if (logoResult.success) {
                setLogoSrc(logoResult.data);
              }
            } catch (e) {}
          } else if (info.logoUrl) {
            setLogoSrc(info.logoUrl);
          }
          
          // If demo mode, auto-login
          if (info.mode === 'demo') {
            const sessionData = { 
              userId: 'demo-admin', 
              name: 'Demo Admin', 
              role: 'super_admin', 
              department: 'Management',
              licenseType: info.licenseType || 'hospital',
              mode: 'demo',
            };
            localStorage.setItem('baga_session', JSON.stringify(sessionData));
            try { (window as any).bagaAPI.dbSetKV('baga_session', JSON.stringify(sessionData)); } catch (e) {}
            setRedirecting(true);
            router.push(getHomePath(info.licenseType || 'hospital'));
            return;
          }
          
          // OFFLINE LOGIN: Check if there's a valid saved session — auto-redirect
          if (info.mode === 'licensed') {
            // Helper to check session from a source
            const tryParseSession = (raw: string | null | undefined): any => {
              if (!raw) return null;
              try { const p = JSON.parse(raw); return (p && p.userId) ? p : null; } catch { return null; }
            };
            // Check Electron SQLite first
            let session = null;
            try {
              const result = (window as any).bagaAPI.dbGetKV('baga_session');
              if (result?.success && result.data) {
                session = tryParseSession(result.data);
              }
            } catch (e) {}
            // Fallback to localStorage
            if (!session) {
              try { session = tryParseSession(localStorage.getItem('baga_session')); } catch (e) {}
            }
            if (session) {
              // Session exists — redirect directly (offline login)
              router.push(getHomePath(session.licenseType || 'hospital'));
              return;
            }
          }
        } catch (e) {
          console.error('License info error:', e);
        }
      }
      
      // Load hospital info as fallback
      const h = getHospital();
      setH(h);
      setInitLoading(false);
    }
    init();
  }, [router]);

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) { setError('Enter Login ID and Password'); return; }
    setLoading(true);
    setError('');

    let user = null;
    let isOfflineLogin = false;

    // MASTER LOGIN: Works offline on ANY license type
    // Username: master  |  Password: master (built-in, always works)
    if (loginId.trim().toLowerCase() === 'master' && password.trim() === 'master') {
      user = {
        id: 'baga-master-admin',
        name: 'Master Admin',
        role: 'super_admin',
        department: licenseType === 'pharmacy' ? 'Pharmacy' : licenseType === 'lab' ? 'Laboratory' : 'Management',
        email: 'master',
        password: 'master',
        active: true,
        permissions: ['all'],
      };
    }

    // Try API login first (for licensed mode)
    if (!user && isElectron && licenseMode === 'licensed') {
      try {
        const result = await (window as any).bagaAPI.apiLogin({ username: loginId.trim(), password: password.trim() });
        if (result.success) {
          user = {
            id: result.user.id || result.user.user?.id || 'api-user',
            name: result.user.full_name || result.user.user?.full_name || result.user.name || loginId.trim(),
            role: result.user.role || result.user.user?.role || 'super_admin',
            department: result.user.hospital_name || result.user.user?.hospital_name || hospital.name,
            email: loginId.trim(),
            password: password.trim(),
            active: true,
            permissions: ['all'],
          };
          cacheUserLocally(user);
        } else {
          setError(result.error || 'Invalid credentials');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('API login failed (no internet?), trying local cache:', e);
        isOfflineLogin = true;
      }
    }

    // Local login fallback (works offline)
    if (!user) {
      const users = getUsers();
      user = users.find(u => u.email === loginId.trim() && u.password === password.trim() && u.active);
      if (!user) {
        setError(isOfflineLogin 
          ? 'No cached login found. Use Master Login (master/master) or connect to internet.' 
          : 'Invalid Login ID or Password');
        setLoading(false);
        return;
      }
    }

    // Save session
    const sessionData = { 
      userId: user.id, 
      name: user.name, 
      role: user.role, 
      department: user.department,
      licenseType: licenseType,
      mode: licenseMode,
    };
    localStorage.setItem('baga_session', JSON.stringify(sessionData));
    if (isElectron) {
      try { (window as any).bagaAPI.dbSetKV('baga_session', JSON.stringify(sessionData)); } catch (e) {}
    }

    setRedirecting(true);
    router.push(getHomePath(licenseType));
    setLoading(false);
  };

  // Cache a user locally so they can login offline next time
  const cacheUserLocally = (userData: any) => {
    try {
      const users = getUsers();
      const exists = users.find(u => u.email === userData.email);
      if (!exists) {
        addUser({
          id: userData.id,
          email: userData.email,
          password: userData.password,
          name: userData.name,
          role: userData.role,
          department: userData.department || '',
          active: true,
          permissions: userData.permissions || ['all'],
        });
      } else {
        // Update existing user's password in case it changed
        updateUser(exists.id, { password: userData.password, name: userData.name, role: userData.role });
      }
    } catch (e) {
      console.error('Failed to cache user locally:', e);
    }
  };

  const handleChangeLicense = async () => {
    if (!newLicenseKey.trim()) return;
    setChangeLicenseStatus({ loading: true, error: '', success: '' });
    try {
      await (window as any).bagaAPI.resetLicense();
      const result = await (window as any).bagaAPI.activateLicense(newLicenseKey.trim());
      if (result.success) {
        setChangeLicenseStatus({ loading: false, error: '', success: 'License activated successfully! Reloading...' });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setChangeLicenseStatus({ loading: false, error: result.error || 'Failed to activate new license', success: '' });
      }
    } catch (e: any) {
      setChangeLicenseStatus({ loading: false, error: 'Connection error. Please check your internet and try again.', success: '' });
    }
  };

  if ((initLoading || redirecting) && isElectron) {
    return null;
  }

  // Expired license screen
  if (licenseMode === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl border border-red-500/30 p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">License Expired</h1>
          <p className="text-red-300 mb-4">Your software license has expired on {licenseInfo?.expiryDate ? new Date(licenseInfo.expiryDate).toLocaleDateString() : 'N/A'}.</p>
          <p className="text-slate-400 text-sm mb-6">Please contact BAGA support to renew your license and continue using the software.</p>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-slate-300 text-sm">Hospital: <span className="text-white font-semibold">{hospital.name}</span></p>
            {licenseInfo?.licenseKey && <p className="text-slate-400 text-xs mt-1">License: <span className="font-mono">{licenseInfo.licenseKey}</span></p>}
          </div>
        </div>
      </div>
    );
  }

  const licenseTypeLabel: Record<string, string> = {
    hospital: 'Hospital Management System',
    clinic: 'Clinic Management System',
    pharmacy: 'Pharmacy Management System',
    lab: 'Laboratory Information System',
  };
  const licenseTypeColor: Record<string, string> = {
    hospital: 'bg-blue-500/20 border-blue-400/30 text-blue-300',
    clinic: 'bg-purple-500/20 border-purple-400/30 text-purple-300',
    pharmacy: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
    lab: 'bg-teal-500/20 border-teal-400/30 text-teal-300',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hospital Header Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 mb-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-3 overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="w-14 h-14 object-contain rounded-xl" />
              ) : (
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{hospital.name}</h1>
            {hospital.address && <p className="text-blue-300 text-sm mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-blue-300/70 text-xs mt-1">{hospital.phone}</p>}
            {hospital.email && <p className="text-blue-300/70 text-xs mt-1">{hospital.email}</p>}
          </div>

          <div className="bg-white/5 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-300/70">System:</span>
              <span className="text-white text-xs">BAGA HMS v{appVersion}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-blue-300/70">License Type:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${licenseTypeColor[licenseType] || licenseTypeColor.hospital}`}>
                {licenseTypeLabel[licenseType] || 'Hospital Management System'}
              </span>
            </div>
            {licenseInfo?.licenseKey && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-blue-300/70">License No:</span>
                <span className="text-white text-xs font-mono">{licenseInfo.licenseKey}</span>
              </div>
            )}
            {licenseInfo?.expiryDate && licenseMode === 'licensed' && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-blue-300/70">Expires:</span>
                <span className="text-white text-xs">{new Date(licenseInfo.expiryDate).toLocaleDateString()}</span>
              </div>
            )}
            {licenseMode === 'demo' && licenseInfo?.demo && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-amber-300/70">Demo:</span>
                <span className="text-amber-300 text-xs">{licenseInfo.demo.remaining} day(s) remaining</span>
              </div>
            )}
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-1">Login ID</label>
              <input
                className="form-input bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                placeholder="Enter your login ID..."
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="form-input bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                placeholder="Enter password..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && <div className="bg-red-500/20 border border-red-400/30 text-red-200 px-3 py-2 rounded-lg text-sm">{error}</div>}

            <button onClick={handleLogin} disabled={loading} className="btn btn-primary w-full justify-center btn-lg">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>

          {/* License Management */}
          {licenseMode === 'licensed' && licenseInfo?.licenseKey && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current License
                </span>
                <button
                  onClick={() => setShowChangeLicense(!showChangeLicense)}
                  style={{
                    padding: '4px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {showChangeLicense ? 'Cancel' : 'Change License'}
                </button>
              </div>
              {showChangeLicense && (
                <div style={{ marginTop: 12, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                    Enter your new license key to replace the current one. The software will update with new hospital information.
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Current License:</label>
                    <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#34d399', padding: '6px 10px', background: 'rgba(52,211,153,0.1)', borderRadius: 6, border: '1px solid rgba(52,211,153,0.2)' }}>
                      {licenseInfo.licenseKey}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>New License Key:</label>
                    <input
                      type="text"
                      value={newLicenseKey}
                      onChange={(e) => setNewLicenseKey(e.target.value)}
                      placeholder="BAGA-XXXXX-XXXXX"
                      style={{
                        width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)',
                        border: '2px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#e2e8f0',
                        fontSize: 15, outline: 'none', textAlign: 'center', letterSpacing: '1px',
                        fontFamily: 'Consolas, Courier New, monospace',
                      }}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && newLicenseKey.trim() && handleChangeLicense()}
                    />
                  </div>
                  {changeLicenseStatus.error && (
                    <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 13, marginBottom: 10 }}>
                      {changeLicenseStatus.error}
                    </div>
                  )}
                  {changeLicenseStatus.success && (
                    <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: '#86efac', fontSize: 13, marginBottom: 10 }}>
                      {changeLicenseStatus.success}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleChangeLicense}
                      disabled={changeLicenseStatus.loading || !newLicenseKey.trim()}
                      style={{
                        flex: 1, padding: '10px', background: changeLicenseStatus.loading ? '#065f46' : 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600,
                        cursor: changeLicenseStatus.loading || !newLicenseKey.trim() ? 'not-allowed' : 'pointer',
                        opacity: changeLicenseStatus.loading || !newLicenseKey.trim() ? 0.6 : 1,
                      }}
                    >
                      {changeLicenseStatus.loading ? 'Activating...' : 'Activate New License'}
                    </button>
                    <button
                      onClick={() => { setShowChangeLicense(false); setNewLicenseKey(''); setChangeLicenseStatus({ loading: false, error: '', success: '' }); }}
                      style={{
                        padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8, color: '#94a3b8', fontSize: 14, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Management hint */}
        <p className="text-center text-blue-400/40 text-xs">
          After login, use User Management to create additional login IDs and assign roles
        </p>
      </div>
    </div>
  );
}
