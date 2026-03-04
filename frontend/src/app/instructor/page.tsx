'use client';

import Link from 'next/link';
import { getInstructorStats, getInstructorActivities } from '@/data/instructor';
import type { InstructorActivityType } from '@/types/instructor';
import styles from './page.module.css';

const activityIcons: Record<InstructorActivityType, { initials: string; colorClass: string }> = {
  course_created: { initials: 'CC', colorClass: '' },
  course_published: { initials: 'CP', colorClass: 'green' },
  student_enrolled: { initials: 'SE', colorClass: 'blue' },
  student_completed: { initials: 'SC', colorClass: 'gold' },
  instructor_assigned: { initials: 'IA', colorClass: 'purple' },
};

function formatRelativeTime(timestamp: string): string {
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
  const stats = getInstructorStats();
  const activities = getInstructorActivities();

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Bienvenido al panel de instructor. Gestiona cursos, supervisa instructores y monitorea el progreso de los alumnos.
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCourses}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div className={styles.statNumber}>{stats.totalCourses}</div>
          <div className={styles.statLabel}>Total Cursos</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconStudents}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <div className={styles.statNumber}>{stats.totalStudentsEnrolled}</div>
          <div className={styles.statLabel}>Alumnos Inscritos</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconInstructors}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div className={styles.statNumber}>{stats.activeInstructors}</div>
          <div className={styles.statLabel}>Instructores Activos</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconRate}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className={styles.statNumber}>{stats.averageCompletionRate}%</div>
          <div className={styles.statLabel}>Tasa de Completado</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.optionsGrid}>
        <div className={styles.optionCard}>
          <div className={styles.optionIcon}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Crear Curso</h2>
          <p className={styles.optionDescription}>
            Crea un nuevo curso y asignalo a un instructor
          </p>
          <Link href="/instructor/cursos/crear" className={styles.optionButton}>
            Empezar
          </Link>
        </div>

        <div className={styles.optionCard}>
          <div className={`${styles.optionIcon} ${styles.students}`}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Ver Alumnos</h2>
          <p className={styles.optionDescription}>
            Monitorea el progreso de los alumnos en tus cursos
          </p>
          <Link href="/instructor/alumnos" className={styles.optionButton}>
            Ver alumnos
          </Link>
        </div>

        <div className={styles.optionCard}>
          <div className={`${styles.optionIcon} ${styles.instructors}`}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Mis Instructores</h2>
          <p className={styles.optionDescription}>
            Gestiona los instructores bajo tu coordinacion
          </p>
          <Link href="/instructor/instructores" className={styles.optionButton}>
            Ver instructores
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h3 className={styles.historyTitle}>Actividad Reciente</h3>
          <Link href="/instructor/cursos" className={styles.viewAllLink}>
            Ver todos los cursos
          </Link>
        </div>

        <div className={styles.historyList}>
          {activities.slice(0, 5).map((activity) => {
            const iconInfo = activityIcons[activity.type];
            return (
              <div key={activity.id} className={styles.historyItem}>
                <div className={styles.historyItemContent}>
                  <div className={`${styles.historyIcon} ${iconInfo.colorClass ? styles[iconInfo.colorClass] : ''}`}>
                    {iconInfo.initials}
                  </div>
                  <div className={styles.historyItemInfo}>
                    <span className={styles.historyItemTitle}>{activity.description}</span>
                    <span className={styles.historyItemTime}>{formatRelativeTime(activity.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
