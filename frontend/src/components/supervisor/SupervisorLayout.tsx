'use client';

import React, { useState, useEffect } from 'react';
import { SupervisorHeader } from './SupervisorHeader';
import { SupervisorSidebar } from './SupervisorSidebar';
import { getCurrentUser } from '@/lib/auth';
import styles from './SupervisorLayout.module.css';

interface SupervisorLayoutProps {
  children: React.ReactNode;
}

export const SupervisorLayout: React.FC<SupervisorLayoutProps> = ({ children }) => {
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string; avatarUrl?: string | null } | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const name = u.full_name || u.email;
      const stored = localStorage.getItem(`avatar_${u.id}`);
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Supervisor',
        avatarUrl: stored || null,
      });
    }).catch(() => {/* usar valor por defecto */});
  }, []);

  return (
    <div className={styles.container}>
      <SupervisorHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <div className={styles.contentWrapper}>
        <SupervisorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
