'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ProfileSetupModal from './ProfileSetupModal';
import { authApi } from '@/lib/api/client';

interface UserMe {
  id: string;
  email: string;
  full_name: string | null;
  rol: string;
}

export default function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setChecked(true);
      return;
    }
    authApi.me()
      .then((u) => setUser(u as UserMe))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const handleComplete = (fullName: string) => {
    setUser((prev) => prev ? { ...prev, full_name: fullName } : prev);
  };

  if (!checked) return <>{children}</>;

  const needsSetup = user && !user.full_name && pathname !== '/' && !pathname.startsWith('/invitacion');

  return (
    <>
      {children}
      {needsSetup && (
        <ProfileSetupModal
          currentEmail={user.email}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
