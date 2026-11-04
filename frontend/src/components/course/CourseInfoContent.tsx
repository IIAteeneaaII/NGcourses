'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import StudentHeader from '@/components/shared/StudentHeader';
import type { CourseInfo, SyllabusLesson } from '@/types/course';
import PayPalCheckout from './PayPalCheckout';
import CourseReviews from './CourseReviews';
import styles from './CourseInfoContent.module.css';

/** Avance del alumno inscrito (GET /progreso/curso/{id}). */
export interface CourseProgress {
  completedLessonIds: string[];
  completed: number;
  total: number;
  pct: number;
}

interface CourseInfoContentProps {
  course: CourseInfo;
  isEnrolled?: boolean;
  progress?: CourseProgress | null;
  onInscribirse?: () => void;
  onPaymentSuccess?: () => void;
  enrollLoading?: boolean;
  backHref?: string;
  bloqueadoPorLicencia?: boolean;
  viewOnlyMode?: boolean;
  viewCourseHref?: string;
  viewCourseLabel?: string;
  /** Vista del alumno real: barra de navegación del alumno y ruta al Dashboard. */
  showUserMenu?: boolean;
}

type LessonKind = 'video' | 'lectura' | 'quiz';

const KIND_LABEL: Record<LessonKind, [string, string]> = {
  video: ['video', 'videos'],
  lectura: ['lectura', 'lecturas'],
  quiz: ['cuestionario', 'cuestionarios'],
};

const KIND_NAME: Record<LessonKind, string> = {
  video: 'Video',
  lectura: 'Lectura',
  quiz: 'Cuestionario',
};

const LEVEL_STEPS: Record<string, number> = { Principiante: 1, Intermedio: 2, Avanzado: 3 };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cleanTitle = (t: string) => t.trim().replace(/\.$/, '');
/** "Módulo 1: Fundamentos de Excel." → "Fundamentos de Excel" (el número ya va en el recuadro). */
const moduleTitle = (t: string) => cleanTitle(t.replace(/^\s*m[oó]dulo\s*\d+\s*[:.\-–]\s*/i, '')) || cleanTitle(t);
const kindOf = (l: SyllabusLesson): LessonKind =>
  l.tipo === 'quiz' || l.tipo === 'lectura' ? l.tipo : 'video';

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

function countKinds(lessons: SyllabusLesson[]): Record<LessonKind, number> {
  const c: Record<LessonKind, number> = { video: 0, lectura: 0, quiz: 0 };
  lessons.forEach((l) => { c[kindOf(l)] += 1; });
  return c;
}

const mixLabel = (c: Record<LessonKind, number>) =>
  (Object.keys(KIND_LABEL) as LessonKind[])
    .filter((k) => c[k] > 0)
    .map((k) => plural(c[k], ...KIND_LABEL[k]))
    .join(' · ');

function KindIcon({ kind }: { kind: LessonKind }) {
  if (kind === 'quiz') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01" />
      </svg>
    );
  }
  if (kind === 'lectura') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <path strokeLinejoin="round" d="M7 3h7l5 5v13H7z" />
        <path strokeLinecap="round" d="M14 3v5h5M10 13h6M10 17h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5v5l4-2.5z" fill="currentColor" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.lessonDoneIcon}>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2L6.6 12l1.4-1.4 2.8 2.8 5.2-5.2 1.4 1.4z" />
    </svg>
  );
}

export default function CourseInfoContent({
  course,
  isEnrolled,
  progress,
  onInscribirse,
  onPaymentSuccess,
  enrollLoading,
  backHref = '/cursos',
  bloqueadoPorLicencia,
  viewOnlyMode = false,
  viewCourseHref,
  viewCourseLabel = 'Ver curso',
  showUserMenu,
}: CourseInfoContentProps) {
  const price = formatPrice(course.precio, course.moneda);
  const requierePago = !price.isFree;
  const completedIds = new Set(progress?.completedLessonIds ?? []);

  // Lección siguiente: la primera sin completar en orden de módulo/lección.
  let nextLessonKey: string | null = null;
  let nextLessonTitle: string | null = null;
  if (isEnrolled) {
    outer: for (let m = 0; m < course.syllabus.length; m++) {
      const lessons = course.syllabus[m].lessons;
      for (let i = 0; i < lessons.length; i++) {
        if (!lessons[i].id || !completedIds.has(lessons[i].id!)) {
          nextLessonKey = `${m}-${i}`;
          nextLessonTitle = cleanTitle(lessons[i].title);
          break outer;
        }
      }
    }
  }
  const nextModuleIndex = nextLessonKey ? Number(nextLessonKey.split('-')[0]) : 0;

  const [openModules, setOpenModules] = useState<Set<number>>(new Set([nextModuleIndex]));
  const [descExpanded, setDescExpanded] = useState(false);

  const toggleModule = (index: number) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const allOpen = course.syllabus.length > 0 && openModules.size === course.syllabus.length;
  const toggleAll = () =>
    setOpenModules(allOpen ? new Set() : new Set(course.syllabus.map((_, i) => i)));

  const lessonsSec = course.syllabus.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + (l.durationSec ?? 0), 0),
    0,
  );
  const durationLabel = lessonsSec > 0 ? formatTotal(lessonsSec) : course.duration && course.duration !== '0h' ? course.duration : null;
  const outcomes = course.learningOutcomes.filter((o) => o && o.trim());
  const requirements = (course.requirements ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  const hasReviews = !!course.reviewsCount && course.reviewsCount > 0;
  const kinds = countKinds(course.syllabus.flatMap((m) => m.lessons));
  const levelSteps = LEVEL_STEPS[course.level] ?? 0;
  const descriptionIsLong = course.description.length > 280;

  // Ruta: el alumno vuelve a la sección del Dashboard de la que viene el curso.
  const section = course.esDeMiOrg
    ? 'Cursos RAM asignados'
    : course.marca === 'nextgen' && (course.esGratis ?? price.isFree)
      ? 'Cursos gratuitos NextGenIA'
      : null;
  const eyebrow = [course.category, course.marca === 'nextgen' ? 'NextGenIA' : course.marca === 'ram' ? 'RAM' : null]
    .filter(Boolean)
    .join(' · ');

  const ArrowIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  const includes = (
    <ul className={styles.includes}>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx="12" cy="9" r="5" /><path strokeLinejoin="round" d="M9 13.5L8 21l4-2 4 2-1-7.5" /></svg>
        Certificado al completar el curso
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
        A tu ritmo, sin fechas límite
      </li>
      {kinds.quiz > 0 && (
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01" /></svg>
          {plural(kinds.quiz, 'cuestionario', 'cuestionarios')} para evaluar tu avance
        </li>
      )}
    </ul>
  );

  let actionBody: ReactNode;
  if (viewOnlyMode) {
    actionBody = (
      <Link href={viewCourseHref ?? `/curso/${course.id}/videos?from=supervisor`} className={`${styles.btn} ${styles.btnPrimary}`}>
        {viewCourseLabel}
      </Link>
    );
  } else if (isEnrolled) {
    const pct = progress?.pct ?? 0;
    const started = (progress?.completed ?? 0) > 0;
    actionBody = (
      <>
        <div>
          <div className={styles.progressLabel}>
            <span>Tu avance</span>
            <b>{pct} %</b>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label="Avance del curso"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.fill} style={{ width: `${pct}%` }} />
          </div>
          {progress && (
            <p className={styles.progressSub}>
              {progress.completed} de {progress.total} lecciones
            </p>
          )}
        </div>
        {nextLessonTitle && (
          <p className={styles.nextUp}>
            {started ? 'Siguiente' : 'Empieza con'}
            <b>{nextLessonTitle}</b>
          </p>
        )}
        <Link href={`/curso/${course.id}/videos`} className={`${styles.btn} ${styles.btnPrimary}`}>
          {started ? 'Continuar' : 'Empezar curso'}
          {ArrowIcon}
        </Link>
      </>
    );
  } else if (requierePago) {
    // Precio > 0: PayPal tiene prioridad sobre el bloqueo de licencia, ya que
    // RF10 permite que cualquier alumno compre el curso individualmente.
    actionBody = (
      <>
        <div className={styles.price}>
          <b>{price.label}</b>
          <span>{plural(course.lessonsCount, 'lección', 'lecciones')}</span>
        </div>
        <PayPalCheckout
          cursoId={course.id}
          monedaCurso={course.moneda}
          onSuccess={() => {
            if (onPaymentSuccess) onPaymentSuccess();
          }}
        />
        {includes}
      </>
    );
  } else if (bloqueadoPorLicencia) {
    actionBody = (
      <div className={styles.lockedBlock} role="status" aria-live="polite">
        <h3 className={styles.lockedTitle}>Curso no disponible</h3>
        <p className={styles.lockedMessage}>
          Tu organización no ha adquirido este curso. Contacta a tu administrador para más información.
        </p>
      </div>
    );
  } else {
    actionBody = (
      <>
        <div className={styles.price}>
          <b>{price.label}</b>
          <span>{plural(course.lessonsCount, 'lección', 'lecciones')}</span>
        </div>
        {onInscribirse && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onInscribirse} disabled={enrollLoading}>
            {enrollLoading ? 'Inscribiendo…' : 'Inscribirme gratis'}
          </button>
        )}
        {includes}
      </>
    );
  }

  return (
    <div className={styles.container}>
      {showUserMenu ? (
        <StudentHeader />
      ) : (
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
          </div>
        </header>
      )}

      <main className={styles.page}>
        {showUserMenu ? (
          <nav className={styles.crumbs} aria-label="Ruta">
            <Link href={backHref}>Dashboard</Link>
            {section && (
              <>
                <span aria-hidden="true">/</span>
                <span>{section}</span>
              </>
            )}
          </nav>
        ) : (
          <Link href={backHref} className={styles.backLink}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Volver
          </Link>
        )}

        <div className={styles.layout}>
          <section className={styles.hero} aria-labelledby="course-title">
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h1 id="course-title" className={styles.courseTitle}>{cleanTitle(course.title)}</h1>
            {course.description && (
              <>
                <p
                  id="course-description"
                  className={`${styles.lead} ${descriptionIsLong && !descExpanded ? styles.leadClamped : ''}`}
                >
                  {course.description}
                </p>
                {descriptionIsLong && (
                  <button
                    type="button"
                    className={styles.moreButton}
                    aria-expanded={descExpanded}
                    aria-controls="course-description"
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? 'Leer menos' : 'Leer más'}
                  </button>
                )}
              </>
            )}

            <div className={styles.facts}>
              {levelSteps > 0 && (
                <span className={styles.fact}>
                  <span className={styles.meter} aria-hidden="true">
                    {[1, 2, 3].map((i) => <i key={i} className={i <= levelSteps ? styles.meterOn : undefined} />)}
                  </span>
                  <b>{course.level}</b>
                </span>
              )}
              {course.syllabus.length > 0 && (
                <span className={styles.fact}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
                  <b>{course.syllabus.length}</b> {course.syllabus.length === 1 ? 'módulo' : 'módulos'}
                </span>
              )}
              {(Object.keys(KIND_LABEL) as LessonKind[]).filter((k) => kinds[k] > 0).map((k) => (
                <span key={k} className={styles.fact}>
                  <KindIcon kind={k} />
                  <b>{kinds[k]}</b> {kinds[k] === 1 ? KIND_LABEL[k][0] : KIND_LABEL[k][1]}
                </span>
              ))}
              {durationLabel && (
                <span className={styles.fact}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
                  <b>{durationLabel}</b>
                </span>
              )}
              {hasReviews && (
                <span className={styles.fact}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.star}><path d="M12 17.3l-6.2 3.7 1.7-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.8 1.7 7z" /></svg>
                  <b>{course.rating.toFixed(1)}</b> ({course.reviewsCount})
                </span>
              )}
            </div>

            {course.instructor && (
              <p className={styles.instructor}>
                Impartido por <strong>{course.instructor}</strong>
              </p>
            )}
          </section>

          <aside className={styles.aside} aria-label={isEnrolled ? 'Tu avance' : 'Inscripción'}>
            <div className={styles.actionCard}>
              <div className={styles.cover}>
                <CourseCover
                  src={course.image}
                  title={course.title}
                  caption={course.category}
                  variant="grid"
                  tone={course.marca === 'ram' ? 'ram' : 'nextgen'}
                />
              </div>
              <div className={styles.actionBody}>{actionBody}</div>
            </div>
          </aside>

          <div className={styles.body}>
            {outcomes.length > 0 && (
              <section className={styles.section} aria-labelledby="learn-title">
                <h2 id="learn-title" className={styles.sectionTitle}>Lo que aprenderás</h2>
                <ul className={styles.outcomes}>
                  {outcomes.map((outcome, index) => (
                    <li key={index}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.section} aria-labelledby="syllabus-title">
              <div className={styles.sectionHead}>
                <h2 id="syllabus-title" className={styles.sectionTitle}>Temario</h2>
                {course.syllabus.length > 1 && (
                  <button type="button" className={styles.linkButton} onClick={toggleAll}>
                    {allOpen ? 'Contraer todo' : 'Expandir todo'}
                  </button>
                )}
              </div>
              {course.syllabus.length === 0 ? (
                <p className={styles.sectionText}>El temario se publicará pronto.</p>
              ) : (
                <div className={styles.modules}>
                  {course.syllabus.map((modulo, index) => {
                    const isOpen = openModules.has(index);
                    const hasLessons = modulo.lessons.length > 0;
                    const doneCount = modulo.lessons.filter((l) => l.id && completedIds.has(l.id)).length;
                    const moduleDone = isEnrolled && hasLessons && doneCount === modulo.lessons.length;
                    return (
                      <div key={index} className={`${styles.module} ${moduleDone ? styles.moduleDone : ''}`}>
                        <button
                          type="button"
                          className={styles.moduleButton}
                          onClick={() => toggleModule(index)}
                          aria-expanded={isOpen}
                          aria-controls={`modulo-${index}`}
                          disabled={!hasLessons}
                        >
                          <span className={styles.moduleNum} aria-hidden="true">
                            {moduleDone ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className={styles.moduleText}>
                            <span className={styles.moduleTitle}>{moduleTitle(modulo.title)}</span>
                            {hasLessons && <span className={styles.moduleMix}>{mixLabel(countKinds(modulo.lessons))}</span>}
                          </span>
                          {hasLessons && (
                            <span className={styles.moduleCount}>
                              {isEnrolled
                                ? `${doneCount}/${modulo.lessons.length}`
                                : plural(modulo.lessons.length, 'lección', 'lecciones')}
                            </span>
                          )}
                          <svg className={styles.moduleChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isOpen && hasLessons && (
                          <ul id={`modulo-${index}`} className={styles.lessons}>
                            {modulo.lessons.map((leccion, i) => {
                              const kind = kindOf(leccion);
                              const done = !!leccion.id && completedIds.has(leccion.id);
                              const isNext = nextLessonKey === `${index}-${i}`;
                              return (
                                <li
                                  key={leccion.id ?? i}
                                  className={`${styles.lesson} ${done ? styles.lessonDone : ''} ${isNext ? styles.lessonNext : ''}`}
                                >
                                  {done ? <CheckCircle /> : <KindIcon kind={kind} />}
                                  <span className={styles.lessonTitle}>{cleanTitle(leccion.title)}</span>
                                  <span className={styles.lessonKind}>
                                    {isNext
                                      ? 'Siguiente'
                                      : leccion.durationSec && kind !== 'quiz'
                                        ? formatDuration(leccion.durationSec)
                                        : KIND_NAME[kind]}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {requirements.length > 0 && (
              <section className={styles.section} aria-labelledby="req-title">
                <h2 id="req-title" className={styles.sectionTitle}>Requisitos</h2>
                <ul className={styles.requirements}>
                  {requirements.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </section>
            )}

            <CourseReviews courseId={course.id} canReview={Boolean(isEnrolled) && !viewOnlyMode} />
          </div>
        </div>
      </main>
    </div>
  );
}
