'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cursosApi } from '@/lib/api/client';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import PageHeader from '@/components/admin/PageHeader';
import { courseInitials } from '@/components/shared/CourseCover';
import styles from './page.module.css';

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
  creado_en?: string;
}

interface ApiResponse {
  data: ApiCurso[];
  count: number;
}

export default function AdminDashboardPage() {
  const { flags } = useFeatureFlags();
  const [recentCourses, setRecentCourses] = useState<ApiCurso[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState<{ total: number; publicados: number } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [allResp, pendingResp] = await Promise.allSettled([
          cursosApi.list({ limit: 200 }) as Promise<ApiResponse>,
          cursosApi.list({ limit: 100, estado: 'revision' }) as Promise<ApiResponse>,
        ]);
        if (allResp.status === 'fulfilled') {
          const sorted = [...(allResp.value.data ?? [])].sort((a, b) =>
            new Date(b.creado_en ?? 0).getTime() - new Date(a.creado_en ?? 0).getTime()
          );
          setRecentCourses(sorted.slice(0, 5));
          setStats({ total: sorted.length, publicados: sorted.filter((c) => c.estado === 'publicado').length });
        }
        if (pendingResp.status === 'fulfilled') {
          setPendingCount(pendingResp.value.count ?? 0);
        }
      } catch {
        // silencioso
      }
    }
    fetchData();
  }, []);

  const ESTADO_LABEL: Record<string, string> = {
    publicado: 'Publicado',
    revision: 'En revisión',
    borrador: 'Borrador',
    rechazado: 'Rechazado',
    archivado: 'Archivado',
  };

  const dateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

  const shortcuts = [
    {
      href: '/admin/cursos/crear',
      title: 'Crear curso',
      text: 'Arma un curso nuevo: datos, portada, módulos y lecciones.',
      icon: <path d="M12 5v14M5 12h14" />,
    },
    {
      href: '/admin/solicitudes',
      title: 'Revisión de cursos',
      text: pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? 'curso espera' : 'cursos esperan'} tu aprobación.` : 'No hay cursos pendientes de aprobación.',
      icon: <><path d="M9 12h6M9 16h6" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" /></>,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      href: '/admin/usuarios',
      title: 'Usuarios',
      text: 'Da de alta empleados, cambia roles y estados.',
      icon: <><circle cx="9" cy="7" r="4" /><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75M23 21v-2a4 4 0 0 0-3-3.87" /></>,
    },
    {
      href: '/admin/organizaciones',
      title: 'Organizaciones',
      text: 'Empresas cliente, supervisores y licencias de cursos.',
      icon: <><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" /></>,
    },
    ...(flags.instructores
      ? [{
          href: '/admin/instructores',
          title: 'Instructores',
          text: 'Instructores registrados en la plataforma.',
          icon: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
        }]
      : []),
  ];

  return (
    <div className={styles.dashboard}>
      <PageHeader
        title="Inicio"
        subtitle={stats ? `${stats.total} cursos en la plataforma · ${stats.publicados} publicados` : 'Panel de administración'}
      />

      <div className={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className={styles.shortcut}>
            <span className={styles.shortcutIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
            </span>
            <span className={styles.shortcutBody}>
              <span className={styles.shortcutTitle}>
                {s.title}
                {s.badge !== undefined && <span className={styles.badge}>{s.badge}</span>}
              </span>
              <span className={styles.shortcutText}>{s.text}</span>
            </span>
            <svg className={styles.shortcutArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        ))}
      </div>

      <section className={styles.recent}>
        <div className={styles.recentHeader}>
          <h2 className={styles.recentTitle}>Cursos recientes</h2>
          <Link href="/admin/cursos" className={styles.viewAllLink}>Ver todos</Link>
        </div>

        {recentCourses.length === 0 ? (
          <p className={styles.empty}>Todavía no hay cursos.</p>
        ) : (
          <ul className={styles.recentList}>
            {recentCourses.map((curso) => (
              <li key={curso.id}>
                <Link href={`/admin/cursos/${curso.id}/editar`} className={styles.recentItem}>
                  <span className={styles.recentInitials} aria-hidden="true">{courseInitials(curso.titulo)}</span>
                  <span className={styles.recentName}>{curso.titulo}</span>
                  <span className={`${styles.status} ${styles[`status_${curso.estado}`] ?? ''}`}>{ESTADO_LABEL[curso.estado] ?? curso.estado}</span>
                  <span className={styles.recentDate}>{curso.creado_en ? dateFormat.format(new Date(curso.creado_en)) : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
