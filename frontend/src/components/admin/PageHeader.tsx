import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Botones de acción a la derecha (acción principal al final). */
  actions?: ReactNode;
  /** Enlace "volver" solo para pantallas de segundo nivel (editar, detalle). */
  back?: { href: string; label: string };
}

/**
 * Encabezado común de las pantallas de los paneles: título a la izquierda,
 * subtítulo gris y acciones a la derecha. La navegación general vive en la
 * barra lateral, así que no se agregan botones de "Inicio".
 */
export default function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {back && (
          <Link href={back.href} className={styles.back}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
