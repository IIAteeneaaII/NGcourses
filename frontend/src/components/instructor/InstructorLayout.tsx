'use client';

import React, { useState, useEffect } from 'react';
import { InstructorHeader } from './InstructorHeader';
import { InstructorSidebar } from './InstructorSidebar';
import { getCurrentUser } from '@/lib/auth';
import styles from './InstructorLayout.module.css';

interface InstructorLayoutProps {
  children: React.ReactNode;
}

export const InstructorLayout: React.FC<InstructorLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string; avatarUrl?: string | null } | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const name = u.full_name || u.email;
      const stored = localStorage.getItem(`avatar_${u.id}`);
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Instructor',
        avatarUrl: stored || null,
      });
    }).catch(() => {/* mantener undefined para mostrar valor por defecto */});
  }, []);

  return (
    <div className={styles.container}>
      <InstructorHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <div className={styles.contentWrapper}>
        <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
