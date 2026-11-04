'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StudentUserMenu from './StudentUserMenu';
import styles from './StudentHeader.module.css';

const NAV_ITEMS = [
  { href: '/cursos', label: 'Dashboard' },
  { href: '/mis-cursos', label: 'Mi progreso' },
  { href: '/certificados', label: 'Certificados' },
];

/**
 * Barra superior del alumno: logo, navegación principal (Dashboard / Mi progreso /
 * Certificados) y menú de usuario. Compartida por las tres vistas del alumno.
 */
export default function StudentHeader() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/cursos" className={styles.logo} aria-label="NextGen Course, ir al dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className={styles.logoImg} />
          <span className={styles.logoTitle}>
            <span className={styles.logoBold}>NextGen</span>
            <span className={styles.logoLight}> Course</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.navLink}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.user}>
          <StudentUserMenu />
        </div>
      </div>
    </header>
  );
}
