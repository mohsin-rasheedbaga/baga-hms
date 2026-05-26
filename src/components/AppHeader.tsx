'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Hospital, RefreshCw, Download, KeyRound, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

const roleLabels: Record<string, string> = {
  reception: 'ریسپشن',
  doctor: 'ڈاکٹر',
  pharmacy: 'فارمیسی',
  lab: 'لیب',
  xray: 'ایکس ری',
  ultrasound: 'الٹراساؤنڈ',
  admin: 'ایڈمن',
};

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [version, setVersion] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [hospitalName, setHospitalName] = useState('');

  const role = typeof window !== 'undefined' ? localStorage.getItem('baga_role') : null;
  const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI;

  useEffect(() => {
    if (isElectron) {
      (window as any).bagaAPI.getAppVersion().then((v: string) => setVersion(v));
      (window as any).bagaAPI.getLicenseInfo().then((info: any) => {
        if (info.license) {
          setHospitalName(info.license.hospitalName || '');
        }
      });
      (window as any).bagaAPI.onUpdateStatus((data: any) => {
        if (data.status === 'available' || data.status === 'downloaded') {
          setUpdateAvailable(true);
        }
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('baga_role');
    localStorage.removeItem('baga_user');
    router.push('/login');
  };

  const handleCheckUpdate = () => {
    if (isElectron) {
      (window as any).bagaAPI.checkForUpdate();
    }
  };

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center cursor-pointer"
            onClick={() => router.push(pathname.split('/').slice(0, 2).join('/') || '/login')}
          >
            <Hospital className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-tight">
              {hospitalName || 'BAGA Hospital'}
            </h1>
            <p className="text-xs text-gray-500">
              {role ? roleLabels[role] || role : ''} {version && <span className="text-gray-300" dir="ltr">v{version}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role === 'reception' && (
            <Button variant="outline" size="sm" onClick={() => router.push('/reception')} className="text-xs">
              ڈیش بورڈ
            </Button>
          )}
          {isElectron && (
            <Button
              variant={updateAvailable ? 'default' : 'ghost'}
              size="sm"
              onClick={handleCheckUpdate}
              className={`text-xs ${updateAvailable ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            >
              {updateAvailable ? (
                <><Download className="w-3 h-3 mr-1" /> اپڈیٹ دستیاب</>
              ) : (
                <><RefreshCw className="w-3 h-3 mr-1" /> اپڈیٹ</>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
          >
            <LogOut className="w-4 h-4 mr-1" />
            لاگ آؤٹ
          </Button>
        </div>
      </div>
    </header>
  );
}
