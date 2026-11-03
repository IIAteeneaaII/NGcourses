'use client';

import { useState } from 'react';
import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import type { CourseInfo } from '@/types/course';
import PayPalCheckout from './PayPalCheckout';
import StudentUserMenu from '@/components/shared/StudentUserMenu';
import styles from './CourseInfoContent.module.css';

interface CourseInfoContentProps {
  course: CourseInfo;
  isEnrolled?: boolean;
  onInscribirse?: () => void;
  onPaymentSuccess?: () => void;
  enrollLoading?: boolean;
  backHref?: string;
  bloqueadoPorLicencia?: boolean;
  viewOnlyMode?: boolean;
  viewCourseHref?: string;
  viewCourseLabel?: string;
  /** Muestra el menú de usuario del alumno en la barra superior (solo alumno real). */
  showUserMenu?: boolean;
}

function formatPrice(precio: number | null | undefined, moneda?: string): { label: string; isFree: boolean } {
  if (precio == null || Number(precio) === 0) return { label: 'Gratis', isFree: true };
  const valor = Number(precio);
  const entero = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
  return { label: `$${entero} ${moneda || 'MXN'}`, isFree: false };
}

function formatDuration(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Duración total legible ("1 h 30 min", "45 min") a partir de segundos. */
function formatTotal(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default function CourseInfoContent({ course, isEnrolled, onInscribirse, onPaymentSuccess, enrollLoading, backHref = '/cursos', bloqueadoPorLicencia, viewOnlyMode = false, viewCourseHref, viewCourseLabel = 'Ver curso', showUserMenu }: CourseInfoContentProps) {
  const price = formatPrice(course.precio, course.moneda);
  const requierePago = !price.isFree;
  const [openModules, setOpenModules] = useState<Set<number>>(new Set([0]));

  const toggleModule = (index: number) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // La duración del curso viene en horas redondeadas ("0h" en cursos cortos);
  // si es posible, se calcula sumando la duración de las lecciones.
  const lessonsSec = course.syllabus.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + (l.durationSec ?? 0), 0),
    0,
  );
  const durationLabel = lessonsSec > 0 ? formatTotal(lessonsSec) : course.duration && course.duration !== '0h' ? course.duration : null;
  const outcomes = course.learningOutcomes.filter((o) => o && o.trim());
  const requirements = course.requirements?.trim();
  const hasReviews = !!course.reviewsCount && course.reviewsCount > 0;

  const meta = [
    course.level && course.level !== 'No especificado' ? course.level : null,
    `${course.lessonsCount} ${course.lessonsCount === 1 ? 'lección' : 'lecciones'}`,
    durationLabel,
    hasReviews ? `★ ${course.rating.toFixed(1)} (${course.reviewsCount})` : null,
  ].filter(Boolean) as string[];

  const action = viewOnlyMode ? (
    <Link href={viewCourseHref ?? `/curso/${course.id}/videos?from=supervisor`} className={styles.startButton}>
      {viewCourseLabel}
    </Link>
  ) : isEnrolled ? (
    <Link href={`/curso/${course.id}/videos`} className={styles.startButton}>
      Continuar curso
    </Link>
  ) : requierePago ? (
    // Precio > 0: PayPal tiene prioridad sobre el bloqueo de licencia, ya que
    // RF10 permite que cualquier alumno compre el curso individualmente.
    <PayPalCheckout
      cursoId={course.id}
      monedaCurso={course.moneda}
      onSuccess={() => {
        if (onPaymentSuccess) onPaymentSuccess();
      }}
    />
  ) : bloqueadoPorLicencia ? (
    <div className={styles.lockedBlock} role="status" aria-live="polite">
      <h3 className={styles.lockedTitle}>Curso no disponible</h3>
      <p className={styles.lockedMessage}>
        Tu organización no ha adquirido este curso. Contacta a tu administrador para más información.
      </p>
    </div>
  ) : (
    onInscribirse && (
      <button className={styles.startButton} onClick={onInscribirse} disabled={enrollLoading}>
        {enrollLoading ? 'Inscribiendo…' : 'Inscribirme gratis'}
      </button>
    )
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href={backHref} className={styles.logoLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="NextGen" className={styles.logoImg} />
            <span className={styles.logoTitle}>
              <span className={styles.logoBold}>NextGen</span>
              <span className={styles.logoLight}> Course</span>
            </span>
          </Link>
          {showUserMenu && <StudentUserMenu />}
        </div>
      </header>

      <main className={styles.main}>
        <Link href={backHref} className={styles.backLink}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a cursos
        </Link>

        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.courseTitle}>{course.title}</h1>
            {course.description && <p className={styles.heroDescription}>{course.description}</p>}
            <ul className={styles.metaList}>
              {meta.map((m) => (
                <li key={m} className={styles.metaItem}>{m}</li>
              ))}
            </ul>
            {course.instructor && (
              <p className={styles.instructor}>
                Impartido por <strong>{course.instructor}</strong>
              </p>
            )}
          </div>

          <aside className={styles.heroAside}>
            <div className={styles.cover}>
              <CourseCover src={course.image} title={course.title} caption={course.level} />
            </div>
            <div className={styles.purchase}>
              <span className={`${styles.priceValue} ${price.isFree ? styles.priceFree : ''}`}>{price.label}</span>
              <div className={styles.actionsContainer}>{action}</div>
            </div>
          </aside>
        </section>

        <div className={styles.body}>
          {outcomes.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Lo que aprenderás</h2>
              <ul className={styles.outcomes}>
                {outcomes.map((outcome, index) => (
                  <li key={index}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Temario</h2>
              <span className={styles.sectionMeta}>
                {course.syllabus.length} {course.syllabus.length === 1 ? 'módulo' : 'módulos'} · {course.lessonsCount} {course.lessonsCount === 1 ? 'lección' : 'lecciones'}
              </span>
            </div>
            {course.syllabus.length === 0 ? (
              <p className={styles.sectionText}>El temario se publicará pronto.</p>
            ) : (
              <ul className={styles.temarioList}>
                {course.syllabus.map((modulo, index) => {
                  const isOpen = openModules.has(index);
                  const hasLessons = modulo.lessons.length > 0;
                  return (
                    <li key={index} className={styles.temarioItem}>
                      <button
                        type="button"
                        className={styles.temarioToggle}
                        onClick={() => toggleModule(index)}
                        aria-expanded={isOpen}
                        disabled={!hasLessons}
                      >
                        <span className={`${styles.temarioChevron} ${isOpen ? styles.temarioChevronOpen : ''}`} aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        <span className={styles.temarioModuleTitle}>{modulo.title}</span>
                        {hasLessons && (
                          <span className={styles.temarioCount}>
                            {modulo.lessons.length} {modulo.lessons.length === 1 ? 'lección' : 'lecciones'}
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <ul className={styles.temarioLessons}>
                          {modulo.lessons.map((leccion, i) => (
                            <li key={i} className={styles.temarioLesson}>
                              <span>{leccion.title}</span>
                              {leccion.tipo === 'quiz' ? (
                                <span className={styles.temarioLessonMeta}>Quiz</span>
                              ) : leccion.durationSec ? (
                                <span className={styles.temarioLessonMeta}>{formatDuration(leccion.durationSec)}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {requirements && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Requisitos</h2>
              <p className={styles.sectionText}>{requirements}</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
