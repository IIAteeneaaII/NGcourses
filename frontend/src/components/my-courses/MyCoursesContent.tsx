'use client';

import { useState } from 'react';
import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import StudentHeader from '@/components/shared/StudentHeader';
import type { CourseStatus, UserCourse } from '@/types/course';
import styles from './MyCoursesContent.module.css';

type FilterType = CourseStatus | 'all';

interface MyCoursesContentProps {
  courses: UserCourse[];
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'in_progress', label: 'En curso' },
  { key: 'not_started', label: 'Sin iniciar' },
  { key: 'completed', label: 'Completados' },
  { key: 'all', label: 'Todos' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function MyCoursesContent({ courses }: MyCoursesContentProps) {
  const counts: Record<FilterType, number> = {
    all: courses.length,
    in_progress: courses.filter((c) => c.status === 'in_progress').length,
    not_started: courses.filter((c) => c.status === 'not_started').length,
    completed: courses.filter((c) => c.status === 'completed').length,
  };

  // Abre en "En curso" si hay alguno; si no, en "Todos" para no mostrar una lista vacía.
  const [activeFilter, setActiveFilter] = useState<FilterType>(counts.in_progress > 0 ? 'in_progress' : 'all');

  // Última actividad primero; los cursos sin actividad quedan al final.
  const visible = courses
    .filter((c) => activeFilter === 'all' || c.status === activeFilter)
    .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));
  // Solo el curso más reciente lleva el botón verde: una lista de botones verdes no jerarquiza nada.
  const primaryId = visible.find((c) => c.status === 'in_progress')?.id;

  return (
    <div className={styles.container}>
      <StudentHeader />

      <main className={styles.main}>
        <section className={styles.pageHead} aria-labelledby="progress-title">
          <h1 id="progress-title" className={styles.pageTitle}>Mi progreso</h1>
          <p className={styles.pageSubtitle}>
            {courses.length > 0
              ? `${plural(counts.all, 'curso inscrito', 'cursos inscritos')} · ${counts.in_progress} en curso · ${plural(counts.completed, 'completado', 'completados')}`
              : 'Todavía no te has inscrito a ningún curso.'}
          </p>
        </section>

        {courses.length > 0 && (
          <div className={styles.segmented} role="group" aria-label="Filtrar por estado">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={activeFilter === f.key}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label} <span className={styles.segmentCount}>{counts[f.key]}</span>
              </button>
            ))}
          </div>
        )}

        {visible.length > 0 ? (
          <div className={styles.rows}>
            {visible.map((course) => {
              const title = course.title.trim().replace(/\.$/, '');
              const progress = course.progress ?? 0;
              return (
                <article key={course.id} className={styles.row}>
                  <Link href={`/curso/${course.id}`} className={styles.cover} tabIndex={-1} aria-hidden="true">
                    <CourseCover
                      src={course.image}
                      title={course.title}
                      size="sm"
                      variant="grid"
                      tone={course.marca === 'ram' ? 'ram' : 'nextgen'}
                    />
                  </Link>

                  <div className={styles.info}>
                    <h3 className={styles.rowTitle}>
                      <Link href={`/curso/${course.id}`}>{title}</Link>
                    </h3>
                    <p className={styles.rowSub}>
                      {course.status === 'completed' && `${course.lessonsCount} de ${course.lessonsCount} lecciones · completado`}
                      {course.status === 'in_progress' && (
                        <>
                          Lección {Math.min((course.completedLessons ?? 0) + 1, course.lessonsCount)} de {course.lessonsCount}
                          {course.nextLessonTitle && <> · <b>{course.nextLessonTitle}</b></>}
                        </>
                      )}
                      {course.status === 'not_started' && (
                        <>
                          {plural(course.lessonsCount, 'lección', 'lecciones')}
                          {course.nextLessonTitle && <> · empieza con <b>{course.nextLessonTitle}</b></>}
                        </>
                      )}
                    </p>
                    <div className={styles.progress}>
                      <div
                        className={styles.track}
                        role="progressbar"
                        aria-label={`Avance en ${title}`}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className={styles.fill} style={{ width: `${progress}%` }} />
                      </div>
                      {course.status === 'completed' ? (
                        <span className={styles.done}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                          Completado
                        </span>
                      ) : (
                        <span className={styles.pct}>{progress} %</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.action}>
                    {course.status === 'completed' ? (
                      course.certificadoFolio ? (
                        <Link href="/certificados" className={`${styles.btn} ${styles.btnGhost}`}>
                          Ver certificado
                        </Link>
                      ) : (
                        <Link href={`/curso/${course.id}/videos`} className={`${styles.btn} ${styles.btnGhost}`}>
                          Revisar
                        </Link>
                      )
                    ) : (
                      <Link
                        href={`/curso/${course.id}/videos`}
                        className={`${styles.btn} ${course.id === primaryId ? styles.btnPrimary : styles.btnGhost}`}
                      >
                        {course.status === 'in_progress' ? 'Continuar' : 'Empezar'}
                        <ArrowIcon />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              {courses.length > 0
                ? 'No tienes cursos en este estado.'
                : 'Inscríbete a un curso desde el dashboard para ver aquí tu avance.'}
            </p>
            <Link href="/cursos" className={`${styles.btn} ${styles.btnGhost}`}>
              Explorar cursos
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
