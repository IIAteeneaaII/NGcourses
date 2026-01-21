'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { UserCourse, MyCoursesStatistics } from '@/types/course';
import styles from './MyCoursesContent.module.css';

type FilterType = 'all' | 'in_progress' | 'completed';

interface MyCoursesContentProps {
  courses: UserCourse[];
  statistics: MyCoursesStatistics;
}

export default function MyCoursesContent({ courses, statistics }: MyCoursesContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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
          <div className={styles.logo}>Cursos Online</div>
          <Link href="/cursos" className={styles.backButton}>
            ← Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Mis Cursos</h1>
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
              En Progreso
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
              <span className={styles.statLabel}>Total de Cursos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.inProgress}</span>
              <span className={styles.statLabel}>En Progreso</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.completed}</span>
              <span className={styles.statLabel}>Completados</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.totalHours}</span>
              <span className={styles.statLabel}>Horas Totales</span>
            </div>
          </div>
        </div>

        {(activeFilter === 'all' || activeFilter === 'in_progress') && coursesInProgress.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>En Progreso</h2>
            <div className={styles.coursesList}>
              {coursesInProgress.map((course) => (
                <div key={course.id} className={styles.courseCard}>
                  <div className={styles.courseImageContainer}>
                    <Image
                      src={course.image}
                      alt={course.title}
                      fill
                      className={styles.courseImage}
                      sizes="80px"
                    />
                  </div>
                  <div className={styles.courseInfo}>
                    <h3 className={styles.courseTitle}>{course.title}</h3>
                    <p className={styles.courseMeta}>
                      {course.instructor} • {course.lessonsCount} lecciones • <span className={styles.statusInProgress}>En Progreso</span>
                    </p>
                    <p className={styles.courseProgress}>Progreso: {course.progress}%</p>
                  </div>
                  <div className={styles.courseActions}>
                    <Link href={`/curso/${course.id}/videos`} className={styles.continueButton}>
                      Continuar
                    </Link>
                    <Link href={`/curso/${course.id}`} className={styles.detailsButton}>
                      Ver Detalles
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
                    <Image
                      src={course.image}
                      alt={course.title}
                      fill
                      className={styles.courseImage}
                      sizes="80px"
                    />
                  </div>
                  <div className={styles.courseInfo}>
                    <h3 className={styles.courseTitle}>{course.title}</h3>
                    <p className={styles.courseMeta}>
                      {course.instructor} • {course.lessonsCount} lecciones • <span className={styles.statusCompleted}>Completado</span>
                    </p>
                    <p className={styles.courseCompletedDate}>{course.completedDate}</p>
                  </div>
                  <div className={styles.courseActions}>
                    <button className={styles.reviewButton}>
                      Revisar
                    </button>
                    <button className={styles.certificateButton}>
                      Certificado
                    </button>
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
