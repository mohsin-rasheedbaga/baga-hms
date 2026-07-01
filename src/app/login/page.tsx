'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHospital, getUsers, setHospital, addUser, updateUser } from '@/lib/store';
import { isLanMode, setLanMode, syncDataFromServer } from '@/lib/db-bridge';

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
  const [appVersion, setAppVersion] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [loginDebugInfo, setLoginDebugInfo] = useState<any>(null);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');
  const [debugTestResult, setDebugTestResult] = useState<any>(null);
  const [renewLicenseKey, setRenewLicenseKey] = useState('');
  const [renewStatus, setRenewStatus] = useState({ loading: false, error: '', success: '' });
  const [checkingRenewal, setCheckingRenewal] = useState(false);

  useEffect(() => {
    async function init() {
      // Check if we're in LAN sharing mode (not Electron, but API server reachable)
      if (!isElectron && typeof window !== 'undefined') {
        try {
          const protocol = window.location.protocol;
          const host = window.location.hostname;
          const port = window.location.port || '18765';
          const baseUrl = `${protocol}//${host}:${port}`;
          const resp = await fetch(baseUrl + '/api/license-info', { signal: AbortSignal.timeout(3000) });
          if (resp.ok) {
            const info = await resp.json();
            // Set LAN mode whenever API server is reachable (even if license mode is 'none')
            setLanMode(true);
            console.log('[LAN Init] Server reachable, mode:', info.mode);
            if (info.mode && info.mode !== 'none') {
              // Fetch app version from LAN server
              try {
                const verResp = await fetch(baseUrl + '/api/version', { signal: AbortSignal.timeout(3000) });
                if (verResp.ok) {
                  const verData = await verResp.json();
                  if (verData.success && verData.version) setAppVersion(verData.version);
                }
              } catch {}
              setLicenseInfo(info);
              setLicenseMode(info.mode);
              setLicenseType(info.licenseType || 'hospital');
              // Update hospital info from LAN license
              if (info.hospitalName) {
                setH(prev => ({
                  ...prev,
                  name: info.hospitalName,
                  address: info.hospitalAddress || prev.address,
                  phone: info.hospitalPhone || prev.phone,
                  email: info.hospitalEmail || prev.email,
                  licenseNo: info.licenseKey || prev.licenseNo,
                }));
                setHospital({
                  ...getHospital(),
                  name: info.hospitalName,
                  address: info.hospitalAddress || '',
                  phone: info.hospitalPhone || '',
                  email: info.hospitalEmail || '',
                  licenseNo: info.licenseKey || '',
                });
              }
              if (info.logoUrl) setLogoSrc(info.logoUrl);
              // Also try /api/logo for file-based logo
              if (!info.logoUrl) {
                try {
                  const logoResp = await fetch(baseUrl + '/api/logo');
                  if (logoResp.ok) {
                    const logoData = await logoResp.json();
                    if (logoData.success && logoData.logo) setLogoSrc(logoData.logo);
                  }
                } catch {}
              }
              if (info.hospitalMobile) {
                setH(prev => ({ ...prev, phone: info.hospitalMobile || prev.phone }));
              }
              if (info.mode === 'expired') {
                setInitLoading(false);
                return;
              }
              // Sync data from server to localStorage
              await syncDataFromServer();
              // DISABLED: Auto-login on startup — always show login page
              // Clear any existing session so user must log in fresh
              try {
                localStorage.removeItem('baga_session');
              } catch (e) {}
              setInitLoading(false);
              return;
            }
          }
        } catch (e) {
          console.log('LAN mode not available, running as standalone browser');
        }
        setInitLoading(false);
        return;
      }

      // Electron mode - Try to get license info from Electron
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
            if (isElectron) {
              try { (window as any).bagaAPI.dbSetKV('baga_session', JSON.stringify(sessionData)); } catch (e) {}
            }
            // LAN browser: session stays in localStorage only
            setRedirecting(true);
            router.push(getHomePath(info.licenseType || 'hospital'));
            return;
          }
          
          // DISABLED: Auto-login on startup.
          // User wants the login page to ALWAYS show when the app starts,
          // even if a previous session exists. The user must explicitly
          // enter credentials each time the app launches.
          // (Previous session is cleared on app exit/refresh — see below)

          // Clear any existing session so user must log in fresh
          try {
            localStorage.removeItem('baga_session');
            if (isElectron) {
              try { (window as any).bagaAPI.dbSetKV('baga_session', ''); } catch (e) {}
            }
          } catch (e) {}
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

    // NON-ELECTRON MODE (browser/LAN): validate against server's SQLite database
    if (!user && !isElectron) {
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

      // METHOD 1: Try /api/login endpoint (server-side credential check)
      try {
        const loginResp = await fetch(baseUrl + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginId.trim(), password: password.trim() }),
        });
        if (loginResp.ok) {
          const loginResult = await loginResp.json();
          if (loginResult.success && loginResult.user) {
            console.log('LAN Login: Authenticated via /api/login:', loginResult.user.email);
            user = {
              id: loginResult.user.id,
              name: loginResult.user.name,
              role: loginResult.user.role,
              department: loginResult.user.department || '',
              email: loginResult.user.email,
              password: password.trim(),
              active: true,
              permissions: loginResult.user.permissions || ['all'],
            };
          } else {
            console.log('LAN Login: /api/login rejected, trying direct DB fetch');
            // Store debug info for display
            if (loginResult.debug) {
              setLoginDebugInfo(loginResult.debug);
            }
          }
        }
      } catch (e) {
        console.error('LAN /api/login fetch error:', e);
      }

      // METHOD 2: Fetch users directly from /api/db/users and match locally
      // This is the most reliable method — gets ALL users from SQLite and matches in browser
      if (!user) {
        try {
          const dbResp = await fetch(baseUrl + '/api/db/users');
          if (dbResp.ok) {
            const dbResult = await dbResp.json();
            if (dbResult.success && dbResult.data) {
              // Unwrap double-wrapped records if any
              const serverUsers = dbResult.data.map((u: any) => {
                if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
                return u;
              });
              const match = serverUsers.find((u: any) => {
                if (!u) return false;
                const uEmail = (u.email || u.login_id || u.loginId || '').trim().toLowerCase();
                const uPass = (u.password || '').trim();
                const isActive = u.active !== false && u.active !== 'false';
                return uEmail === loginId.trim().toLowerCase() && uPass === password.trim() && isActive;
              });
              if (match) {
                console.log('LAN Login: Matched via /api/db/users:', match.email);
                user = {
                  id: match.id,
                  name: match.name,
                  role: match.role,
                  department: match.department || '',
                  email: match.email,
                  password: password.trim(),
                  active: true,
                  permissions: match.permissions || ['all'],
                };
              }
            }
          }
        } catch (e) {
          console.error('LAN /api/db/users fetch error:', e);
        }
      }

      // METHOD 3: Last resort — check localStorage (seed/default users)
      if (!user) {
        try {
          const lanUsers = getUsers();
          const cleanUsers = (lanUsers || []).map((u: any) => {
            if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
            return u;
          });
          const lanUser = cleanUsers.find((u: any) => {
            const uEmail = (u.email || u.login_id || '').trim().toLowerCase();
            return uEmail === loginId.trim().toLowerCase() && u.password === password.trim() && u.active;
          });
          if (lanUser) {
            console.log('LAN Login: Found user in localStorage fallback:', lanUser.email);
            user = lanUser;
          }
        } catch (e) {
          console.error('LAN localStorage fallback failed:', e);
        }
      }

      if (!user) {
        setError('Invalid Login ID or Password');
        setLoading(false);
        return;
      }
    }

    // Check local users FIRST in Electron mode (User Management created users live in SQLite)
    // This ensures locally created users always work, even if remote API rejects them
    if (!user && isElectron) {
      try {
        const localUsers = getUsers();
        const localUser = localUsers.find(u => u.email === loginId.trim() && u.password === password.trim() && u.active);
        if (localUser) {
          console.log('Login: Found user in local database:', localUser.email);
          user = localUser;
        }
      } catch (e) {
        console.error('Local user lookup failed:', e);
      }
    }

    // Try API login (for licensed mode) with 5s timeout — only if NOT found locally
    if (!user && isElectron && licenseMode === 'licensed') {
      try {
        const loginPromise = (window as any).bagaAPI.apiLogin({ username: loginId.trim(), password: password.trim() });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const result = await Promise.race([loginPromise, timeoutPromise]) as any;
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
          // API returned error (invalid credentials etc.) — fall through to local check
          console.log('API login failed, falling back to local users:', result.error);
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
          ? 'Invalid Login ID or Password. Please connect to internet and try again.' 
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
      permissions: user.permissions || ['all'],
    };
    localStorage.setItem('baga_session', JSON.stringify(sessionData));
    if (isElectron) {
      // Electron desktop app: save to KV store for offline login persistence
      try { (window as any).bagaAPI.dbSetKV('baga_session', JSON.stringify(sessionData)); } catch (e) {}
    }
    // LAN browser: session stays in localStorage ONLY (per-browser, not shared)
    // Do NOT save to KV store — that would share the session with all browsers

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

  // Renew license from the expired screen
  const handleRenewLicense = async () => {
    if (!renewLicenseKey.trim()) return;
    setRenewStatus({ loading: true, error: '', success: '' });
    try {
      if (isElectron) {
        // Electron: reset and activate new license
        await (window as any).bagaAPI.resetLicense();
        const result = await (window as any).bagaAPI.activateLicense(renewLicenseKey.trim());
        if (result.success) {
          setRenewStatus({ loading: false, error: '', success: 'License activated! Reloading...' });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setRenewStatus({ loading: false, error: result.error || 'Failed to activate license', success: '' });
        }
      } else {
        // LAN browser: just reload — the license is stored on the host
        setRenewStatus({ loading: false, error: 'License renewal is done on the main app (Electron). Please ask the admin to renew the license on the main computer.', success: '' });
      }
    } catch (e: any) {
      setRenewStatus({ loading: false, error: 'Connection error: ' + e.message, success: '' });
    }
  };

  // Check license status (for auto-detect renewal)
  const checkLicenseStatus = async () => {
    setCheckingRenewal(true);
    try {
      if (isElectron) {
        const info = await (window as any).bagaAPI.getFullLicenseInfo();
        if (info && info.mode !== 'expired') {
          // License is no longer expired — reload to update UI
          window.location.reload();
        } else {
          setRenewStatus({ loading: false, error: '', success: 'License is still expired. Please renew first.' });
        }
      } else {
        // LAN browser: fetch from API
        const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
        const resp = await fetch(baseUrl + '/api/license-info');
        if (resp.ok) {
          const info = await resp.json();
          if (info.mode !== 'expired') {
            window.location.reload();
          } else {
            setRenewStatus({ loading: false, error: '', success: 'License is still expired. Please renew first.' });
          }
        }
      }
    } catch (e: any) {
      setRenewStatus({ loading: false, error: 'Check failed: ' + e.message, success: '' });
    } finally {
      setCheckingRenewal(false);
    }
  };

  // Auto-detect license renewal every 30 seconds when expired
  useEffect(() => {
    if (licenseMode !== 'expired') return;
    const interval = setInterval(() => {
      checkLicenseStatus();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [licenseMode]);

  // Always show null while loading or redirecting — prevents double page render
  if (initLoading || redirecting) {
    return null;
  }

  // Expired license screen
  if (licenseMode === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl border border-red-500/30 p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">License Expired</h1>
          <p className="text-red-300 mb-4">Your software license has expired on {licenseInfo?.expiryDate ? new Date(licenseInfo.expiryDate).toLocaleDateString() : 'N/A'}.</p>
          <p className="text-slate-400 text-sm mb-6">Please contact BAGA support to renew your license and continue using the software.</p>
          <div className="bg-white/5 rounded-lg p-3 mb-6">
            <p className="text-slate-300 text-sm">Hospital: <span className="text-white font-semibold">{hospital.name}</span></p>
            {licenseInfo?.licenseKey && <p className="text-slate-400 text-xs mt-1">License: <span className="font-mono">{licenseInfo.licenseKey}</span></p>}
          </div>

          {/* WhatsApp Contact Button */}
          <a
            href="https://wa.me/923000088482?text=Hi%20BAGA%20Support%2C%20my%20license%20has%20expired.%20Please%20help%20me%20renew%20it.%20Hospital%3A%20${encodeURIComponent(hospital.name)}%20License%3A%20${encodeURIComponent(licenseInfo?.licenseKey || '')}"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition mb-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.581 0 11.94-5.335 11.943-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact Support on WhatsApp
          </a>
          <p className="text-slate-400 text-xs mb-4">Or call/WhatsApp: <span className="text-white font-mono font-semibold">+92 300 0088482</span></p>

          {/* Add License / Renew License Option */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-slate-300 text-sm mb-3">Already renewed your license? Enter the new license key below:</p>
            <input
              type="text"
              value={renewLicenseKey}
              onChange={(e) => { setRenewLicenseKey(e.target.value); setRenewStatus({ loading: false, error: '', success: '' }); }}
              placeholder="Enter new license key (BAGA-XXXXX-XXXXX)"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-3 py-2 mb-2 text-sm font-mono focus:outline-none focus:border-green-400"
            />
            <button
              onClick={handleRenewLicense}
              disabled={renewStatus.loading || !renewLicenseKey.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition mb-2"
            >
              {renewStatus.loading ? 'Activating...' : 'Activate New License'}
            </button>
            {renewStatus.error && <p className="text-red-400 text-xs mt-2">{renewStatus.error}</p>}
            {renewStatus.success && <p className="text-green-400 text-xs mt-2">{renewStatus.success}</p>}
          </div>

          {/* Auto-detect renewal notice */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-slate-500 text-xs">
              💡 The software automatically checks for license renewal every 30 seconds.
              If you've renewed from the admin panel, just wait — it will detect automatically.
            </p>
            <button
              onClick={checkLicenseStatus}
              disabled={checkingRenewal}
              className="mt-2 text-green-400 hover:text-green-300 text-sm underline disabled:opacity-50"
            >
              {checkingRenewal ? 'Checking...' : 'Check Now'}
            </button>
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
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md my-auto">
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
            {appVersion && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-300/70">System:</span>
              <span className="text-white text-xs">BAGA HMS v{appVersion}</span>
            </div>
            )}
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

            {/* LAN Login Diagnostic — Sync Users button + debug info */}
            {!isElectron && error && (
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 space-y-2">
                <div className="text-amber-200 text-xs font-semibold">LAN Login Troubleshooting</div>
                <div className="text-amber-100/80 text-xs">
                  Login with the User ID and Password created in User Management on the main app.
                </div>
                <button
                  onClick={async () => {
                    setSyncingUsers(true);
                    setSyncResult('');
                    try {
                      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
                      const resp = await fetch(baseUrl + '/api/sync-users', { method: 'POST' });
                      const data = await resp.json();
                      if (data.success) {
                        setSyncResult(`✓ Sync complete: ${data.added} added, ${data.updated} updated, ${data.total} total users. Try logging in again.`);
                      } else {
                        setSyncResult('✗ ' + (data.reason || data.error || 'Unknown error'));
                      }
                    } catch (e: any) {
                      setSyncResult('✗ Sync error: ' + e.message + ' — Is the main app running on this computer?');
                    } finally {
                      setSyncingUsers(false);
                    }
                  }}
                  disabled={syncingUsers}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white text-sm font-medium py-2 px-3 rounded-lg transition"
                >
                  {syncingUsers ? 'Syncing...' : 'Sync Users from Cloud'}
                </button>
                {syncResult && <div className="text-amber-100 text-xs">{syncResult}</div>}
                {loginDebugInfo && (
                  <div className="text-amber-100/80 text-xs space-y-1 border-t border-amber-400/20 pt-2 mt-2">
                    <div className="font-semibold">Database status:</div>
                    <div>Users in database: {loginDebugInfo.userCount}</div>
                    <div>Active users: {loginDebugInfo.activeUserCount}</div>
                    {loginDebugInfo.activeEmails && loginDebugInfo.activeEmails.length > 0 && (
                      <div>Available logins: <span className="font-mono">{loginDebugInfo.activeEmails.join(', ')}</span></div>
                    )}
                    {loginDebugInfo.activeEmails && loginDebugInfo.activeEmails.length === 0 && (
                      <div className="text-red-300">No users in database! Create users in User Management on the main app, or click "Sync Users from Cloud" above.</div>
                    )}
                  </div>
                )}
                {/* Debug Login Test Button */}
                <button
                  onClick={async () => {
                    try {
                      const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
                      const resp = await fetch(baseUrl + '/api/debug/login-test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loginId.trim(), password: password.trim() }),
                      });
                      const data = await resp.json();
                      setDebugTestResult(data);
                    } catch (e: any) {
                      setDebugTestResult({ error: e.message });
                    }
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition"
                >
                  🔍 Debug Login Test
                </button>
                {debugTestResult && (
                  <div className="text-xs space-y-1 bg-slate-900/50 p-2 rounded border border-slate-600 max-h-60 overflow-y-auto">
                    <div className="text-slate-300 font-semibold">Debug Result:</div>
                    <div className="text-slate-400">DB Path: <span className="font-mono text-amber-300">{debugTestResult.dbPath || 'unknown'}</span></div>
                    <div className="text-slate-400">DB Available: {String(debugTestResult.dbAvailable)}</div>
                    <div className="text-slate-400">Users in DB: {debugTestResult.userCount}</div>
                    <div className="text-slate-400">Attempted: <span className="font-mono">{debugTestResult.attemptedUsername}</span> (passLen: {debugTestResult.attemptedPasswordLength})</div>
                    <div className={debugTestResult.matchResult?.startsWith('✅') ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {debugTestResult.matchResult}
                    </div>
                    {debugTestResult.users && debugTestResult.users.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-slate-300 font-semibold">Users in DB:</div>
                        {debugTestResult.users.map((u: any, i: number) => (
                          <div key={i} className={`text-xs font-mono ${u.fullMatch ? 'text-green-400' : u.emailMatch ? 'text-amber-400' : 'text-slate-500'}`}>
                            {u.email} / {u.password} | active={String(u.active)} | emailMatch={String(u.emailMatch)} | passMatch={String(u.passMatch)}
                          </div>
                        ))}
                      </div>
                    )}
                    {debugTestResult.error && <div className="text-red-400">Error: {debugTestResult.error}</div>}
                  </div>
                )}
              </div>
            )}

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
        <p className="text-center text-cyan-400/80 text-sm font-bold mt-2">
          Powered by Mohsin Rasheed
        </p>
      </div>
    </div>
  );
}
