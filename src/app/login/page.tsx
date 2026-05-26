'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Hospital, ShieldCheck, Eye, EyeOff, RefreshCw, Download, Wifi, WifiOff, KeyRound, User
} from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [mode, setMode] = useState<'login' | 'license'>('login');
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => {
    // Check if we're running in Electron
    if (typeof window === 'undefined') return;
    const api = (window as any).bagaAPI;
    
    if (api) {
      api.getAppVersion().then((v: string) => setVersion(v));
      api.getLicenseInfo().then((info: { license: any }) => {
        setLicenseInfo(info.license);
      });
      
      // Listen for update status
      api.onUpdateStatus((data: any) => {
        setUpdateInfo(data);
      });
    }
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error('براہ کرم یوزر نیم اور پاس ورڈ درج کریں');
      return;
    }

    const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;
    
    if (isElectron) {
      // Real API login via Electron IPC
      setLoading(true);
      try {
        const result = await (window as any).bagaAPI.apiLogin({ username, password });
        if (result.success) {
          // Store user info
          localStorage.setItem('baga_role', result.user.role || 'reception');
          localStorage.setItem('baga_user', JSON.stringify({
            role: result.user.role || 'reception',
            name: result.user.full_name || result.user.username,
            username: result.user.username,
            hospitalName: result.user.hospital_name,
          }));
          toast.success('لاگ ان کامیاب!');
          router.push(`/${result.user.role || 'reception'}`);
        } else {
          toast.error(result.error || 'لاگین ناکام - یوزر نیم یا پاس ورڈ غلط ہے');
        }
      } catch (error) {
        toast.error('کنکشن ایرر - انٹرنیٹ چیک کریں');
      }
      setLoading(false);
    } else {
      // Fallback: demo mode for browser testing
      const demoUsers: Record<string, { password: string; role: string; name: string }> = {
        reception: { password: '1234', role: 'reception', name: 'ریسپشن' },
        doctor: { password: '1234', role: 'doctor', name: 'ڈاکٹر' },
        pharmacy: { password: '1234', role: 'pharmacy', name: 'فارمیسی' },
        lab: { password: '1234', role: 'lab', name: 'لیب' },
        xray: { password: '1234', role: 'xray', name: 'ایکس ری' },
        ultrasound: { password: '1234', role: 'ultrasound', name: 'الٹراساؤنڈ' },
        admin: { password: '1234', role: 'admin', name: 'ایڈمن' },
      };
      
      const user = demoUsers[username];
      if (user && user.password === password) {
        localStorage.setItem('baga_role', user.role);
        localStorage.setItem('baga_user', JSON.stringify({ role: user.role, name: user.name }));
        toast.success('لاگ ان کامیاب (ڈیمو موڈ)');
        router.push(`/${user.role}`);
      } else {
        toast.error('ڈیمو: username = reception/doctor/admin, password = 1234');
      }
    }
  };

  const handleChangeLicense = async () => {
    if (!newLicenseKey.trim()) {
      toast.error('براہ کرم نئی لائسنس کلید درج کریں');
      return;
    }
    
    setLoading(true);
    try {
      if (typeof window === 'undefined' || !(window as any).bagaAPI) {
        toast.error('یہ فیچر صرف Electron ایپ میں دستیاب ہے');
        setLoading(false);
        return;
      }
      const result = await (window as any).bagaAPI.activateLicense(newLicenseKey.trim());
      if (result.success) {
        toast.success('نئی لائسنس کامیابی سے ایکٹیویٹ!');
        setLicenseInfo(result.data);
        setNewLicenseKey('');
        setMode('login');
      } else {
        toast.error(result.error || 'لائسنس ناموزوں');
      }
    } catch (e) {
      toast.error('کنکشن ایرر');
    }
    setLoading(false);
  };

  const handleResetLicense = async () => {
    if (confirm('کیا آپ موجودہ لائسنس ہٹانا چاہتے ہیں؟ ایپ ری اسٹارٹ ہوگی۔')) {
      if (typeof window !== 'undefined' && (window as any).bagaAPI) {
        await (window as any).bagaAPI.resetLicense();
        await (window as any).bagaAPI.quitApp();
      }
    }
  };

  const handleCheckUpdate = () => {
    if (typeof window !== 'undefined' && (window as any).bagaAPI) {
      (window as any).bagaAPI.checkForUpdate();
      toast.info('اپڈیٹ چیک ہو رہا ہے...');
    }
  };

  const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-18 h-18 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ width: '72px', height: '72px' }}>
            <Hospital className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">BAGA Hospital</h1>
          <p className="text-gray-500 mt-1">Hospital Management System</p>
          {version && <p className="text-xs text-gray-400 mt-1" dir="ltr">v{version}</p>}
        </div>

        {/* License Info Card */}
        {isElectron && licenseInfo && (
          <Card className="mb-4 border-emerald-200 bg-emerald-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-700">
                  <KeyRound className="w-3 h-3 inline mr-1" />
                  لائسنس ایکٹیو
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setMode('license')}>
                    تبدیل
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-red-500" onClick={handleResetLicense}>
                    ری سیٹ
                  </Button>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-800">{licenseInfo.hospitalName}</p>
              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                <span>{licenseInfo.licenseDuration === 'lifetime' ? 'لائف ٹائم' : licenseInfo.licenseDuration}</span>
                {licenseInfo.expiryDate && <span dir="ltr">{licenseInfo.expiryDate}</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Update Status */}
        {updateInfo && updateInfo.status === 'available' && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700">نیا نسخہ {updateInfo.version} دستیاب</p>
                <p className="text-xs text-blue-500">ڈاؤنلوڈ ہو رہا ہے...</p>
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
                لاگ ان
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <div className="space-y-2">
                <Label>یوزر نیم</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="یوزر نیم درج کریں"
                  dir="ltr"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>پاس ورڈ</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="پاس ورڈ درج کریں"
                    dir="ltr"
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
                {loading ? 'چیک ہو رہا ہے...' : 'لاگ ان'}
              </Button>

              {!isElectron && (
                <p className="text-xs text-center text-amber-600 bg-amber-50 p-2 rounded-lg">
                  ڈیمو موڈ: username = reception, doctor, admin | password = 1234
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-gray-700">
                <KeyRound className="w-5 h-5 inline mr-1" />
                لائسنس تبدیل کریں
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <div className="space-y-2">
                <Label>نئی لائسنس کلید</Label>
                <Input
                  value={newLicenseKey}
                  onChange={e => setNewLicenseKey(e.target.value)}
                  placeholder="BAGA-XXXXX-XXXXX"
                  dir="ltr"
                  disabled={loading}
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleChangeLicense}
                disabled={loading}
              >
                {loading ? 'چیک ہو رہا ہے...' : 'ایکٹیویٹ کریں'}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => { setMode('login'); setNewLicenseKey(''); }}
                disabled={loading}
              >
                واپس جائیں
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-4">
          {isElectron && (
            <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={handleCheckUpdate}>
              <RefreshCw className="w-3 h-3 mr-1" />
              اپڈیٹ چیک
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
