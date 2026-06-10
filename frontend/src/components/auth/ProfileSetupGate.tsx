'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ProfileSetupModal from './ProfileSetupModal';
import { authApi } from '@/lib/api/client';
import { setRolCookies } from '@/lib/auth';

interface UserMe {
  id: string;
  email: string;
  full_name: string | null;
  rol: string;
  is_superuser?: boolean;
}

export default function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // La cookie HttpOnly la envía el browser automáticamente — no necesitamos leer localStorage
    authApi.me()
      .then((u) => {
        const me = u as UserMe;
        setUser(me);
        // Re-sincroniza las cookies de rol con la sesión real (HttpOnly). Evita
        // que un user_rol stale (p.ej. tras cambiar de cuenta) provoque que el
        // middleware desvíe al dashboard equivocado con ?error=role.
        setRolCookies(me.rol, Boolean(me.is_superuser));
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const handleComplete = (fullName: string) => {
    setUser((prev) => prev ? { ...prev, full_name: fullName } : prev);
  };

  if (!checked) return <>{children}</>;

  const isStaff = user && ['administrador', 'instructor', 'supervisor'].includes(user.rol);
  const needsSetup =
    user &&
    !user.full_name &&
    !isStaff &&
    pathname !== '/' &&
    !pathname.startsWith('/invitacion');

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
