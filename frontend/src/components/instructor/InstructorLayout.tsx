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
  const [headerUser, setHeaderUser] = useState<{ name: string; initials: string; role: string } | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const name = u.full_name || u.email;
      setHeaderUser({
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: 'Instructor',
      });
    }).catch(() => {/* mantener undefined para mostrar valor por defecto */});
  }, []);

  return (
    <div className={styles.container}>
      <InstructorHeader user={headerUser} />

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
