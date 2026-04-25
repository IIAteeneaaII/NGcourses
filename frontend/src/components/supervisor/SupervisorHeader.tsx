'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { logout } from '@/lib/auth';
import styles from './SupervisorHeader.module.css';

interface SupervisorHeaderProps {
  user?: {
    name: string;
    initials: string;
    role: string;
    avatarUrl?: string | null;
  };
  onMenuClick?: () => void;
}

export const SupervisorHeader: React.FC<SupervisorHeaderProps> = ({
  user,
  onMenuClick,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.replace('/');
  };

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.left}>
          <button className={styles.menuButton} onClick={onMenuClick} aria-label="Abrir menú">
            <span />
            <span />
            <span />
          </button>
          <Link href="/supervisor" className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="NextGen" className={styles.logoImg} />
            <span className={styles.logoTitle}>
              <span className={styles.logoBold}>NEXT GEN</span>
              <span className={styles.logoLight}> Course</span>
            </span>
          </Link>
        </div>

        <div className={styles.right}>
          <div className={styles.userMenu}>
            
            <button
              className={styles.userButton}
              onClick={() => user && setShowDropdown(!showDropdown)}
              aria-expanded={showDropdown}
              aria-haspopup="true"
              disabled={!user}
            >
              {!user ? (
                <div className={styles.skeletonAvatar} />
              ) : user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className={styles.userAvatarImg} />
              ) : (
                <div className={styles.userAvatar}>{user.initials}</div>
              )}
              <div className={styles.userInfo}>
                {!user ? (
                  <>
                    <span className={styles.skeletonName} />
                    <span className={styles.skeletonRole} />
                  </>
                ) : (
                  <>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userRole}>{user.role}</span>
                  </>
                )}
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
                <div className={styles.dropdownBackdrop} onClick={() => setShowDropdown(false)} />
                <div className={styles.dropdown}>
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
