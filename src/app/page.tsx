'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('baga_role');
    if (role) {
      window.location.href = `/${role}`;
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">لوڈ ہو رہا ہے...</div>
    </div>
  );
}
