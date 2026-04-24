'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { AccessNotice } from '@/components/shared/AccessNotice';
import { getCurrentUser } from '@/lib/auth';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string; avatarUrl?: string | null } | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.rol !== 'administrador' && !u.is_superuser) {
        router.replace('/');
        return;
      }
      const name = u.full_name || u.email;
      const stored = localStorage.getItem(`avatar_${u.id}`);
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Admin',
        avatarUrl: stored || null,
      });
    }).catch(() => {
      router.replace('/');
    });
  }, [router]);

  return (
    <div className={styles.container}>
      <AdminHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <AccessNotice />
      <div className={styles.contentWrapper}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {headerUser && children}
          </div>
        </main>
      </div>
    </div>
  );
};
