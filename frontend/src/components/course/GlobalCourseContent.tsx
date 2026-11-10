'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import StudentHeader from '@/components/shared/StudentHeader';
import styles from './CourseInfoContent.module.css';
import own from './GlobalCourseContent.module.css';

/** Un curso dentro del curso global, con el avance del alumno (GET /cursos/{id}). */
export interface Subcurso {
  id: string;
  titulo: string;
  estado: string;
  total_modulos: number;
  total_lecciones: number;
  lecciones_completadas: number;
  inscrito: boolean;
  completado: boolean;
  modulos: string[];
}

export interface GlobalCourse {
  id: string;
  titulo: string;
  descripcion: string;
  nivel: string;
  image: string;
  marca?: 'ram' | 'nextgen';
  esDeMiOrg?: boolean;
  puedeInscribirse?: boolean;
  subcursos: Subcurso[];
  leccionesTotal: number;
  leccionesCompletadas: number;
  subcursosCompletados: number;
}

interface Props {
  course: GlobalCourse;
  onInscribirse?: () => void;
  enrollLoading?: boolean;
  enrollError?: string | null;
  backHref?: string;
  /** Vista del alumno real (barra del alumno y miga de pan al Dashboard). */
  showUserMenu?: boolean;
  /** Supervisor o admin: solo lectura, cada curso se abre en modo revisión. */
  viewOnlyMode?: boolean;
}

const LEVEL_STEPS: Record<string, number> = { Principiante: 1, Intermedio: 2, Avanzado: 3 };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cleanTitle = (t: string) => t.trim().replace(/\.$/, '');

/** "Testeo: Desensamble" dentro de Testeo → "Desensamble". El título guardado no cambia. */
export function sinPrefijo(titulo: string, padre: string): string {
  const t = cleanTitle(titulo);
  const p = cleanTitle(padre).toLowerCase();
  const idx = t.indexOf(':');
  if (idx > 0 && t.slice(0, idx).trim().toLowerCase() === p) {
    const resto = t.slice(idx + 1).trim();
    return resto ? resto.charAt(0).toLocaleUpperCase('es') + resto.slice(1) : t;
  }
  return t;
}

const Check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const ArrowIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function GlobalCourseContent({
  course,
  onInscribirse,
  enrollLoading,
  enrollError,
  backHref = '/cursos',
  showUserMenu,
  viewOnlyMode = false,
}: Props) {
  const subs = course.subcursos;
  const enrolled = subs.some((s) => s.inscrito);
  // El siguiente curso: el primero inscrito que no está terminado.
  const nextIndex = enrolled ? subs.findIndex((s) => s.inscrito && !s.completado) : -1;
  const next = nextIndex >= 0 ? subs[nextIndex] : null;
  const started = course.leccionesCompletadas > 0;
  const pct = course.leccionesTotal > 0
    ? Math.round((course.leccionesCompletadas / course.leccionesTotal) * 100)
    : 0;

  const [open, setOpen] = useState<Set<number>>(new Set(nextIndex >= 0 ? [nextIndex] : []));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const allOpen = subs.length > 0 && open.size === subs.length;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(subs.map((_, i) => i)));

  const totalModulos = subs.reduce((a, s) => a + s.total_modulos, 0);
  const levelSteps = LEVEL_STEPS[course.nivel] ?? 0;
  const linkSub = (s: Subcurso) => (viewOnlyMode ? `/curso/${s.id}?from=global` : `/curso/${s.id}`);

  let actionBody: ReactNode;
  if (viewOnlyMode) {
    actionBody = (
      <p className={styles.nextUp}>
        Curso global con {plural(subs.length, 'curso', 'cursos')}. Abre cada uno para revisar su contenido.
      </p>
    );
  } else if (enrolled) {
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
          <p className={styles.progressSub}>
            {course.leccionesCompletadas} de {course.leccionesTotal} lecciones · {course.subcursosCompletados} de {plural(subs.length, 'curso terminado', 'cursos terminados')}
          </p>
        </div>
        {next ? (
          <>
            <p className={styles.nextUp}>
              {started ? 'Continúa con' : 'Empieza con'}
              <b>{sinPrefijo(next.titulo, course.titulo)}</b>
            </p>
            <Link href={`/curso/${next.id}/videos`} className={`${styles.btn} ${styles.btnPrimary}`}>
              {started ? 'Continuar' : 'Empezar curso'}
              {ArrowIcon}
            </Link>
          </>
        ) : (
          <p className={styles.nextUp}>
            Terminaste todos los cursos de {cleanTitle(course.titulo)}.
          </p>
        )}
      </>
    );
  } else if (course.puedeInscribirse !== false && onInscribirse) {
    actionBody = (
      <>
        <div className={styles.price}>
          <b>{plural(subs.length, 'curso', 'cursos')}</b>
          <span>{plural(course.leccionesTotal, 'lección', 'lecciones')}</span>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onInscribirse} disabled={enrollLoading}>
          {enrollLoading ? 'Inscribiendo…' : 'Inscribirme'}
        </button>
        {enrollError && <p className={own.error} role="alert">{enrollError}</p>}
        <ul className={styles.includes}>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            Te inscribe en los {plural(subs.length, 'curso', 'cursos')}
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx="12" cy="9" r="5" /><path strokeLinejoin="round" d="M9 13.5L8 21l4-2 4 2-1-7.5" /></svg>
            Un certificado por cada curso
          </li>
        </ul>
      </>
    );
  } else {
    actionBody = (
      <div className={styles.lockedBlock} role="status">
        <h3 className={styles.lockedTitle}>Curso no disponible</h3>
        <p className={styles.lockedMessage}>
          Tu organización no ha adquirido este curso. Contacta a tu administrador para más información.
        </p>
      </div>
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
            {course.esDeMiOrg && (
              <>
                <span aria-hidden="true">/</span>
                <span>Cursos RAM asignados</span>
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
            <p className={styles.eyebrow}>{course.marca === 'nextgen' ? 'NextGenIA' : 'RAM'} · Curso global</p>
            <h1 id="course-title" className={styles.courseTitle}>{cleanTitle(course.titulo)}</h1>
            {course.descripcion && <p className={styles.lead}>{course.descripcion}</p>}
            <div className={styles.facts}>
              {levelSteps > 0 && (
                <span className={styles.fact}>
                  <span className={styles.meter} aria-hidden="true">
                    {[1, 2, 3].map((i) => <i key={i} className={i <= levelSteps ? styles.meterOn : undefined} />)}
                  </span>
                  <b>{course.nivel}</b>
                </span>
              )}
              <span className={styles.fact}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></svg>
                <b>{subs.length}</b> {subs.length === 1 ? 'curso' : 'cursos'}
              </span>
              {totalModulos > 0 && (
                <span className={styles.fact}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
                  <b>{totalModulos}</b> {totalModulos === 1 ? 'módulo' : 'módulos'}
                </span>
              )}
              <span className={styles.fact}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4-2.5z" fill="currentColor" /></svg>
                <b>{course.leccionesTotal}</b> {course.leccionesTotal === 1 ? 'lección' : 'lecciones'}
              </span>
            </div>
          </section>

          <aside className={styles.aside} aria-label={enrolled ? 'Tu avance' : 'Inscripción'}>
            <div className={styles.actionCard}>
              <div className={styles.cover}>
                <CourseCover
                  src={course.image}
                  title={course.titulo}
                  variant="grid"
                  tone={course.marca === 'ram' ? 'ram' : 'nextgen'}
                />
              </div>
              <div className={styles.actionBody}>{actionBody}</div>
            </div>
          </aside>

          <div className={styles.body}>
            <section className={styles.section} aria-labelledby="subcursos-title">
              <div className={styles.sectionHead}>
                <h2 id="subcursos-title" className={styles.sectionTitle}>Cursos de {cleanTitle(course.titulo)}</h2>
                {subs.length > 1 && (
                  <button type="button" className={styles.linkButton} onClick={toggleAll}>
                    {allOpen ? 'Contraer todo' : 'Expandir todo'}
                  </button>
                )}
              </div>
              {subs.length === 0 ? (
                <p className={styles.sectionText}>Los cursos se publicarán pronto.</p>
              ) : (
                <div className={styles.modules}>
                  {subs.map((s, i) => {
                    const isOpen = open.has(i);
                    const isNext = i === nextIndex;
                    const titulo = sinPrefijo(s.titulo, course.titulo);
                    return (
                      <div key={s.id} className={`${styles.module} ${s.completado ? styles.moduleDone : ''}`}>
                        <button
                          type="button"
                          className={styles.moduleButton}
                          onClick={() => toggle(i)}
                          aria-expanded={isOpen}
                          aria-controls={`sub-${i}`}
                        >
                          <span className={styles.moduleNum} aria-hidden="true">{s.completado ? Check : i + 1}</span>
                          <span className={styles.moduleText}>
                            <span className={styles.moduleTitle}>{titulo}</span>
                            <span className={styles.moduleMix}>
                              {plural(s.total_modulos, 'módulo', 'módulos')} · {plural(s.total_lecciones, 'lección', 'lecciones')}
                            </span>
                          </span>
                          <span className={`${styles.moduleCount} ${isNext ? own.countNext : ''}`}>
                            {s.inscrito
                              ? `${isNext ? 'Siguiente · ' : ''}${s.lecciones_completadas}/${s.total_lecciones}`
                              : plural(s.total_lecciones, 'lección', 'lecciones')}
                          </span>
                          <svg className={styles.moduleChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isOpen && (
                          <ul id={`sub-${i}`} className={styles.lessons}>
                            {s.modulos.map((m, k) => (
                              <li key={k} className={styles.lesson}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
                                <span className={styles.lessonTitle}>{cleanTitle(m)}</span>
                                <span className={styles.lessonKind}>Módulo {k + 1}</span>
                              </li>
                            ))}
                            <li className={styles.lesson}>
                              <span className={own.openIcon}>{ArrowIcon}</span>
                              <Link href={linkSub(s)} className={own.openLink}>Abrir {titulo}</Link>
                              <span />
                            </li>
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
