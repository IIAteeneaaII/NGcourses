'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SupervisorHeader } from './SupervisorHeader';
import { SupervisorSidebar } from './SupervisorSidebar';
import { AccessNotice } from '@/components/shared/AccessNotice';
import { getCurrentUser } from '@/lib/auth';
import styles from './SupervisorLayout.module.css';

interface SupervisorLayoutProps {
  children: React.ReactNode;
}

export const SupervisorLayout: React.FC<SupervisorLayoutProps> = ({ children }) => {
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string; avatarUrl?: string | null } | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.rol !== 'supervisor') {
        router.replace('/');
        return;
      }
      const name = u.full_name || u.email;
      const stored = localStorage.getItem(`avatar_${u.id}`);
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Supervisor',
        avatarUrl: stored || null,
      });
    }).catch(() => {
      router.replace('/');
    });
  }, [router]);

  return (
    <div className={styles.container}>
      <SupervisorHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <AccessNotice />
      <div className={styles.contentWrapper}>
        <SupervisorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {headerUser && children}
          </div>
        </main>
      </div>
    </div>
  );
};
