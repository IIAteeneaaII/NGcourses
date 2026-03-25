'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cursosApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
  actualizado_en: string | null;
  creado_en: string;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

export default function InstructorDashboardPage() {
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cursosApi.list({ limit: 200 }).then((resp) => {
      const r = resp as ApiCursosResp;
      setCursos(r.data);
      setCount(r.count);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const published = cursos.filter((c) => c.estado === 'publicado').length;
  const recent = [...cursos].sort((a, b) =>
    new Date(b.actualizado_en || b.creado_en).getTime() -
    new Date(a.actualizado_en || a.creado_en).getTime()
  ).slice(0, 5);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Bienvenido al panel de instructor. Gestiona tus cursos y monitorea el progreso de tus alumnos.
        </p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCourses}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div className={styles.statNumber}>{loading ? '…' : count}</div>
          <div className={styles.statLabel}>Total Cursos</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconRate}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className={styles.statNumber}>{loading ? '…' : published}</div>
          <div className={styles.statLabel}>Cursos Publicados</div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.optionCard}>
          <div className={styles.optionIcon}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Crear Curso</h2>
          <p className={styles.optionDescription}>Crea un nuevo curso y agrega módulos y lecciones</p>
          <Link href="/instructor/cursos/crear" className={styles.optionButton}>Empezar</Link>
        </div>

        <div className={styles.optionCard}>
          <div className={`${styles.optionIcon} ${styles.students}`}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Ver Alumnos</h2>
          <p className={styles.optionDescription}>Monitorea el progreso de los alumnos en tus cursos</p>
          <Link href="/instructor/alumnos" className={styles.optionButton}>Ver alumnos</Link>
        </div>

        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h3 className={styles.historyTitle}>Cursos Recientes</h3>
            <Link href="/instructor/cursos" className={styles.viewAllLink}>Ver todos los cursos</Link>
          </div>
          <div className={styles.historyList}>
            {loading && <p className={styles.historyEmpty}>Cargando...</p>}
            {!loading && recent.length === 0 && (
              <p className={styles.historyEmpty}>Aún no tienes cursos.</p>
            )}
            {recent.map((curso) => (
              <div key={curso.id} className={styles.historyItem}>
                <div className={styles.historyItemContent}>
                  <div className={styles.historyIcon}>
                    {curso.estado === 'publicado' ? 'CP' : 'BD'}
                  </div>
                  <div className={styles.historyItemInfo}>
                    <span className={styles.historyItemTitle}>{curso.titulo}</span>
                    <span className={styles.historyItemTime}>
                      {formatRelativeTime(curso.actualizado_en || curso.creado_en)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
