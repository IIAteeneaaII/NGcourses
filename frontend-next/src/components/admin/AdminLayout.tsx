'use client';

import React from 'react';
import { AdminHeader } from './AdminHeader';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className={styles.container}>
      <AdminHeader />

      <div className={styles.contentWrapper}>
        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
