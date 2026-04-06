'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { getCurrentUser } from '@/lib/auth';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string } | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const name = u.full_name || u.email;
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Admin',
      });
    }).catch(() => {/* mantener undefined para mostrar valor por defecto */});
  }, []);

  return (
    <div className={styles.container}>
      <AdminHeader user={headerUser} onMenuClick={() => setSidebarOpen(true)} />

      <div className={styles.contentWrapper}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
