'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '@/lib/auth';
import { logError } from '@/lib/logger';
import styles from './StudentUserMenu.module.css';

interface MenuUser {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

/**
 * Menú de usuario del alumno (nombre + dropdown Mi Perfil / Mis Cursos / Cerrar Sesión).
 * Se autoabastece con getCurrentUser(); si no hay usuario, no renderiza nada.
 * Reutilizado en la barra superior de las vistas de curso (ficha y reproductor)
 * para que sea consistente con el dashboard. NO se usa en preview de admin/supervisor.
 */
export default function StudentUserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<MenuUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((u) => {
        if (!active || !u) return;
        const name = u.full_name || u.email;
        const stored =
          typeof window !== 'undefined' ? localStorage.getItem(`avatar_${u.id}`) : null;
        setUser({
          id: u.id,
          name,
          initials: name.slice(0, 2).toUpperCase(),
          avatarUrl: stored || null,
        });
      })
      .catch((e) => logError('StudentUserMenu/getCurrentUser', e));
    return () => {
      active = false;
    };
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className={styles.userDropdown}>
      <button
        className={styles.userButton}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.name} className={styles.userAvatarImg} />
        ) : (
          <div className={styles.userAvatar}>{user.initials}</div>
        )}
        <span className={styles.userName}>{user.name}</span>
        <span className={`${styles.dropdownArrow} ${open ? styles.dropdownArrowOpen : ''}`}>▼</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdownMenu}>
            <Link href="/perfil" className={styles.dropdownItem} onClick={() => setOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Mi Perfil
            </Link>
            <Link href="/mis-cursos" className={styles.dropdownItem} onClick={() => setOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              Mis Cursos
            </Link>
            <button className={styles.dropdownItem} onClick={handleLogout}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
