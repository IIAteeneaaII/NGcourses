'use client';

import React, { useState } from 'react';
import { InstructorHeader } from './InstructorHeader';
import { InstructorSidebar } from './InstructorSidebar';
import styles from './InstructorLayout.module.css';

interface InstructorLayoutProps {
  children: React.ReactNode;
}

export const InstructorLayout: React.FC<InstructorLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.container}>
      <InstructorHeader />

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
