'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InstructorHeader } from './InstructorHeader';
import { InstructorSidebar } from './InstructorSidebar';
import { AccessNotice } from '@/components/shared/AccessNotice';
import { getCurrentUser } from '@/lib/auth';
import styles from './InstructorLayout.module.css';

interface InstructorLayoutProps {
  children: React.ReactNode;
}

export const InstructorLayout: React.FC<InstructorLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string; avatarUrl?: string | null } | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.rol !== 'instructor') {
        router.replace('/');
        return;
      }
      const name = u.full_name || u.email;
      const stored = localStorage.getItem(`avatar_${u.id}`);
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Instructor',
        avatarUrl: stored || null,
      });
    }).catch(() => {
      router.replace('/');
    });
  }, [router]);

  return (
    <div className={styles.container}>
      <InstructorHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <AccessNotice />
      <div className={styles.contentWrapper}>
        <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {headerUser && children}
          </div>
        </main>
      </div>
    </div>
  );
};
