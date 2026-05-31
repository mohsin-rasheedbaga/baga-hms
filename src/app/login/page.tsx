'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHospital, getUsers, setHospital } from '@/lib/store';

const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

export default function LoginPage() {
  const [hospital, setH] = useState({ name: 'BAGA Hospital', address: '', phone: '', email: '', licenseNo: 'BAGA-LIC-0001' });
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const h = getHospital();
    setH(h);

    // Check for existing session
    let session = null;

    if (typeof window !== 'undefined') {
      // Try SQLite session first (Electron)
      if (isElectron) {
        try {
          const kvSession = (window as any).bagaAPI.dbGetKV('baga_session');
          if (kvSession) session = JSON.parse(kvSession);
        } catch (e) {}
      }

      // Fall back to localStorage session
      if (!session) {
        const stored = localStorage.getItem('baga_session');
        if (stored) session = JSON.parse(stored);
      }
    }

    if (session) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = () => {
    if (!loginId.trim() || !password.trim()) { setError('Enter Login ID and Password'); return; }
    setLoading(true);
    setError('');
    const users = getUsers();
    const user = users.find(u => u.email === loginId.trim() && u.password === password.trim() && u.active);
    if (!user) { setError('Invalid credentials or account deactivated'); setLoading(false); return; }

    // Save to session
    const sessionData = { userId: user.id, name: user.name, role: user.role, department: user.department };
    localStorage.setItem('baga_session', JSON.stringify(sessionData));

    // Also store session in SQLite for Electron persistence
    if (isElectron) {
      try {
        (window as any).bagaAPI.dbSetKV('baga_session', JSON.stringify(sessionData));
      } catch (e) {}
    }

    router.push('/dashboard');
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('baga_session');

    // Also clear session in SQLite for Electron
    if (isElectron) {
      try {
        (window as any).bagaAPI.dbSetKV('baga_session', '');
      } catch (e) {}
    }
  };

  const handleSetup = () => {
    setHospital({ ...hospital, name: hospital.name || 'BAGA Hospital' });
    setShowSetup(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hospital Header Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 mb-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-3">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">{hospital.name}</h1>
            {hospital.address && <p className="text-blue-300 text-sm mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-blue-300/70 text-xs mt-1">{hospital.phone}</p>}
            {hospital.email && <p className="text-blue-300/70 text-xs">{hospital.email}</p>}
          </div>

          <div className="bg-white/5 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-300/70">License No:</span>
              <span className="text-white font-mono font-bold">{hospital.licenseNo}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-blue-300/70">System:</span>
              <span className="text-white text-xs">BAGA Hospital Management System v2.0</span>
            </div>
          </div>

          {!showSetup ? (
            <>
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

              {/* Demo Credentials */}
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-blue-300/60 text-xs text-center mb-2">Demo Login Credentials</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'admin', pw: 'admin', label: 'Super Admin', color: 'bg-blue-600/30 border-blue-500/30' },
                    { id: 'reception', pw: 'reception', label: 'Reception', color: 'bg-emerald-600/30 border-emerald-500/30' },
                    { id: 'doctor', pw: 'doctor', label: 'Doctor', color: 'bg-purple-600/30 border-purple-500/30' },
                    { id: 'lab', pw: 'lab', label: 'Lab', color: 'bg-teal-600/30 border-teal-500/30' },
                    { id: 'pharmacy', pw: 'pharmacy', label: 'Pharmacy', color: 'bg-amber-600/30 border-amber-500/30' },
                    { id: 'xray', pw: 'xray', label: 'X-Ray', color: 'bg-rose-600/30 border-rose-500/30' },
                    { id: 'ultrasound', pw: 'ultrasound', label: 'Ultrasound', color: 'bg-indigo-600/30 border-indigo-500/30' },
                    { id: 'accounts', pw: 'accounts', label: 'Accounts', color: 'bg-cyan-600/30 border-cyan-500/30' },
                  ].map(d => (
                    <button key={d.id} onClick={() => { setLoginId(d.id); setPassword(d.pw); }}
                      className={`rounded-lg px-3 py-2 text-center text-white text-xs border ${d.color} hover:opacity-80 transition-opacity`}>
                      <div className="font-semibold">{d.label}</div>
                      <div className="opacity-60">{d.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Setup Form */
            <div className="space-y-3">
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-1">Hospital Name</label>
                <input className="form-input bg-white/10 border-white/20 text-white" value={hospital.name} onChange={e => setH({...hospital, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-1">Address</label>
                <input className="form-input bg-white/10 border-white/20 text-white" value={hospital.address} onChange={e => setH({...hospital, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-200 text-sm font-medium mb-1">Phone</label>
                  <input className="form-input bg-white/10 border-white/20 text-white" value={hospital.phone} onChange={e => setH({...hospital, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-blue-200 text-sm font-medium mb-1">License No</label>
                  <input className="form-input bg-white/10 border-white/20 text-white" value={hospital.licenseNo} onChange={e => setH({...hospital, licenseNo: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-1">Email</label>
                <input className="form-input bg-white/10 border-white/20 text-white" value={hospital.email} onChange={e => setH({...hospital, email: e.target.value})} />
              </div>
              <button onClick={handleSetup} className="btn btn-primary w-full justify-center btn-lg">Save Hospital Settings</button>
              <button onClick={() => setShowSetup(false)} className="btn btn-outline w-full justify-center text-white border-white/20">Cancel</button>
            </div>
          )}
        </div>

        {/* Setup Button */}
        {!showSetup && (
          <button onClick={() => setShowSetup(true)} className="w-full text-center text-blue-400/50 text-xs hover:text-blue-400 py-2">
            Hospital Settings (First time setup / Change hospital info)
          </button>
        )}
      </div>
    </div>
  );
}
