'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './AdminHeader.module.css';

interface AdminHeaderProps {
  user?: {
    name: string;
    initials: string;
    role: string;
  };
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  user = {
    name: 'Supervisor',
    initials: 'S',
    role: 'Admin',
  },
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    // TODO: Implement actual logout logic
    router.push('/');
  };

  const handleProfile = () => {
    router.push('/admin/perfil');
    setShowDropdown(false);
  };

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.left}>
          {/* Logo/Title */}
          <Link href="/admin" className={styles.logo}>
            <h1 className={styles.logoText}>Cursos Online</h1>
            <span className={styles.adminBadge}>Admin</span>
          </Link>
        </div>

        <div className={styles.right}>
        {/* User Dropdown */}
        <div className={styles.userMenu}>
          <button
            className={styles.userButton}
            onClick={() => setShowDropdown(!showDropdown)}
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <div className={styles.userAvatar}>{user.initials}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={styles.chevron}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {showDropdown && (
            <>
              <div
                className={styles.dropdownBackdrop}
                onClick={() => setShowDropdown(false)}
              />
              <div className={styles.dropdown}>
                <button className={styles.dropdownItem} onClick={handleProfile}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className={styles.dropdownIcon}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  Mi perfil
                </button>
                <div className={styles.dropdownDivider} />
                <button className={styles.dropdownItem} onClick={handleLogout}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className={styles.dropdownIcon}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
