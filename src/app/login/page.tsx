'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Hospital, Eye, EyeOff, RefreshCw, Download, KeyRound, User
} from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [mode, setMode] = useState<'login' | 'license'>('login');
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = (window as any).bagaAPI;
    
    if (api) {
      api.getAppVersion().then((v: string) => setVersion(v));
      api.getLicenseInfo().then((info: { license: any }) => {
        setLicenseInfo(info.license);
      });
      api.onUpdateStatus((data: any) => {
        setUpdateInfo(data);
      });
    }
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;
    
    if (isElectron) {
      setLoading(true);
      try {
        const result = await (window as any).bagaAPI.apiLogin({ username, password });
        if (result.success) {
          localStorage.setItem('baga_role', result.user.role || 'reception');
          localStorage.setItem('baga_user', JSON.stringify({
            role: result.user.role || 'reception',
            name: result.user.full_name || result.user.username,
            username: result.user.username,
            hospitalName: result.user.hospital_name,
          }));
          toast.success('Login successful!');
          router.push(`/${result.user.role || 'reception'}`);
        } else {
          toast.error(result.error || 'Login failed - invalid username or password');
        }
      } catch (error) {
        toast.error('Connection error - please check your internet');
      }
      setLoading(false);
    } else {
      const demoUsers: Record<string, { password: string; role: string; name: string }> = {
        reception: { password: '1234', role: 'reception', name: 'Reception' },
        doctor: { password: '1234', role: 'doctor', name: 'Doctor' },
        pharmacy: { password: '1234', role: 'pharmacy', name: 'Pharmacy' },
        lab: { password: '1234', role: 'lab', name: 'Lab' },
        xray: { password: '1234', role: 'xray', name: 'X-Ray' },
        ultrasound: { password: '1234', role: 'ultrasound', name: 'Ultrasound' },
        admin: { password: '1234', role: 'admin', name: 'Admin' },
      };
      
      const user = demoUsers[username];
      if (user && user.password === password) {
        localStorage.setItem('baga_role', user.role);
        localStorage.setItem('baga_user', JSON.stringify({ role: user.role, name: user.name }));
        toast.success('Login successful (Demo Mode)');
        router.push(`/${user.role}`);
      } else {
        toast.error('Demo: username = reception/doctor/admin, password = 1234');
      }
    }
  };

  const handleChangeLicense = async () => {
    if (!newLicenseKey.trim()) {
      toast.error('Please enter a new license key');
      return;
    }
    
    setLoading(true);
    try {
      if (typeof window === 'undefined' || !(window as any).bagaAPI) {
        toast.error('This feature is only available in the desktop app');
        setLoading(false);
        return;
      }
      const result = await (window as any).bagaAPI.activateLicense(newLicenseKey.trim());
      if (result.success) {
        toast.success('New license activated successfully!');
        setLicenseInfo(result.data);
        setNewLicenseKey('');
        setMode('login');
      } else {
        toast.error(result.error || 'Invalid license key');
      }
    } catch (e) {
      toast.error('Connection error');
    }
    setLoading(false);
  };

  const handleResetLicense = async () => {
    if (confirm('Are you sure you want to remove the current license? The app will restart.')) {
      if (typeof window !== 'undefined' && (window as any).bagaAPI) {
        await (window as any).bagaAPI.resetLicense();
        await (window as any).bagaAPI.quitApp();
      }
    }
  };

  const handleCheckUpdate = () => {
    if (typeof window !== 'undefined' && (window as any).bagaAPI) {
      (window as any).bagaAPI.checkForUpdate();
      toast.info('Checking for updates...');
    }
  };

  const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto bg-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ width: '72px', height: '72px' }}>
            <Hospital className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">BAGA Hospital</h1>
          <p className="text-gray-500 mt-1">Hospital Management System</p>
          {version && <p className="text-xs text-gray-400 mt-1">v{version}</p>}
        </div>

        {isElectron && licenseInfo && (
          <Card className="mb-4 border-emerald-200 bg-emerald-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-700">
                  <KeyRound className="w-3 h-3 inline mr-1" />
                  License Active
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setMode('license')}>
                    Change
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-red-500" onClick={handleResetLicense}>
                    Reset
                  </Button>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-800">{licenseInfo.hospitalName}</p>
              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                <span>{licenseInfo.licenseDuration === 'lifetime' ? 'Lifetime' : licenseInfo.licenseDuration}</span>
                {licenseInfo.expiryDate && <span>{licenseInfo.expiryDate}</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {updateInfo && updateInfo.status === 'available' && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700">New version {updateInfo.version} available</p>
                <p className="text-xs text-blue-500">Downloading...</p>
              </div>
              <Download className="w-4 h-4 text-blue-500 animate-pulse" />
            </CardContent>
          </Card>
        )}

        {mode === 'login' ? (
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-gray-700">
                <User className="w-5 h-5 inline mr-1" />
                Login
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Login'}
              </Button>

              {!isElectron && (
                <p className="text-xs text-center text-amber-600 bg-amber-50 p-2 rounded-lg">
                  Demo Mode: username = reception, doctor, admin | password = 1234
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-gray-700">
                <KeyRound className="w-5 h-5 inline mr-1" />
                Change License
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <div className="space-y-2">
                <Label>New License Key</Label>
                <Input
                  value={newLicenseKey}
                  onChange={e => setNewLicenseKey(e.target.value)}
                  placeholder="BAGA-XXXXX-XXXXX"
                  disabled={loading}
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleChangeLicense}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Activate'}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => { setMode('login'); setNewLicenseKey(''); }}
                disabled={loading}
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mt-4">
          {isElectron && (
            <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={handleCheckUpdate}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Check Update
            </Button>
          )}
          <p className="text-xs text-gray-400">
            {isElectron ? 'BAGA HMS - Licensed Software' : 'Demo Version'}
          </p>
        </div>
      </div>
    </div>
  );
}
