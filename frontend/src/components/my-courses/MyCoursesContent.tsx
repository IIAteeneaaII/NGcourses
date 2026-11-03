'use client';

import { useState } from 'react';
import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import type { UserCourse, MyCoursesStatistics, User } from '@/types/course';
import { certificadosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import StudentUserMenu from '@/components/shared/StudentUserMenu';
import styles from './MyCoursesContent.module.css';

type FilterType = 'all' | 'in_progress' | 'completed';

interface MyCoursesContentProps {
  courses: UserCourse[];
  statistics: MyCoursesStatistics;
  user?: User;
}

export default function MyCoursesContent({ courses, statistics }: MyCoursesContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDescargar = async (folio: string) => {
    setDownloading(folio);
    try {
      await certificadosApi.descargar(folio);
    } catch (e) {
      logError('MyCoursesContent/descargarCertificado', e);
      // CP20: el backend puede rechazar la descarga (409) si el curso cambió y
      // hay contenido pendiente. Mostramos el motivo al alumno.
      const detail = (e as { detail?: string })?.detail || 'No se pudo descargar el certificado.';
      alert(detail);
    } finally {
      setDownloading(null);
    }
  };

  const filteredCourses = courses.filter((course) => {
    if (activeFilter === 'all') return true;
    return course.status === activeFilter;
  });

  const coursesInProgress = filteredCourses.filter((c) => c.status === 'in_progress');
  const coursesCompleted = filteredCourses.filter((c) => c.status === 'completed');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/cursos" className={styles.logoGroup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="NextGen" className={styles.logoImg} />
            <span className={styles.logoTitle}>
              <span className={styles.logoBold}>NextGen</span>
              <span className={styles.logoLight}> Course</span>
            </span>
          </Link>
          <StudentUserMenu />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Mis cursos</h1>
          <div className={styles.filterButtons}>
            <button
              className={`${styles.filterButton} ${activeFilter === 'all' ? styles.filterButtonActive : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              Todos
            </button>
            <button
              className={`${styles.filterButton} ${activeFilter === 'in_progress' ? styles.filterButtonActive : ''}`}
              onClick={() => setActiveFilter('in_progress')}
            >
              En progreso
            </button>
            <button
              className={`${styles.filterButton} ${activeFilter === 'completed' ? styles.filterButtonActive : ''}`}
              onClick={() => setActiveFilter('completed')}
            >
              Completados
            </button>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.totalCourses}</span>
              <span className={styles.statLabel}>Total de cursos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.inProgress}</span>
              <span className={styles.statLabel}>En progreso</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.completed}</span>
              <span className={styles.statLabel}>Completados</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.totalHours}</span>
              <span className={styles.statLabel}>Horas totales</span>
            </div>
          </div>
        </div>

        {(activeFilter === 'all' || activeFilter === 'in_progress') && coursesInProgress.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>En progreso</h2>
            <div className={styles.coursesList}>
              {coursesInProgress.map((course) => (
                <div key={course.id} className={styles.courseCard}>
                  <div className={styles.courseImageContainer}>
                    <CourseCover src={course.image} title={course.title} size="sm" />
                  </div>
                  <div className={styles.courseInfo}>
                    <h3 className={styles.courseTitle}>{course.title}</h3>
                    <p className={styles.courseMeta}>
                      {course.instructor ? `${course.instructor} • ` : ''}{course.lessonsCount} lecciones • <span className={styles.statusInProgress}>En progreso</span>
                    </p>
                    <div className={styles.progressRow}>
                      <div className={styles.progressTrack} role="progressbar" aria-valuenow={course.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div className={styles.progressFill} style={{ width: `${course.progress}%` }} />
                      </div>
                      <span className={styles.courseProgress}>{course.progress}%</span>
                    </div>
                  </div>
                  <div className={styles.courseActions}>
                    <Link href={`/curso/${course.id}/videos`} className={styles.continueButton}>
                      Continuar
                    </Link>
                    <Link href={`/curso/${course.id}`} className={styles.detailsButton}>
                      Ver detalles
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeFilter === 'all' || activeFilter === 'completed') && coursesCompleted.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Completados</h2>
            <div className={styles.coursesList}>
              {coursesCompleted.map((course) => (
                <div key={course.id} className={styles.courseCard}>
                  <div className={styles.courseImageContainer}>
                    <CourseCover src={course.image} title={course.title} size="sm" />
                  </div>
                  <div className={styles.courseInfo}>
                    <h3 className={styles.courseTitle}>{course.title}</h3>
                    <p className={styles.courseMeta}>
                      {course.instructor ? `${course.instructor} • ` : ''}{course.lessonsCount} lecciones • <span className={styles.statusCompleted}>Completado</span>
                    </p>
                    <p className={styles.courseCompletedDate}>{course.completedDate}</p>
                  </div>
                  <div className={styles.courseActions}>
                    <Link href={`/curso/${course.id}/videos`} className={styles.reviewButton}>
                      Revisar
                    </Link>
                    {course.certificadoFolio ? (
                      <button
                        className={styles.certificateButton}
                        onClick={() => handleDescargar(course.certificadoFolio!)}
                        disabled={downloading === course.certificadoFolio}
                      >
                        {downloading === course.certificadoFolio ? 'Descargando...' : 'Descargar Certificado'}
                      </button>
                    ) : (
                      <button
                        className={styles.certificateButton}
                        disabled
                        title="Si ya completaste el curso, verifica que tu perfil tenga tu nombre completo (sin el correo) para generar el certificado."
                      >
                        Sin certificado
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
