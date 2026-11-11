'use client';

import { useState } from 'react';
import Link from 'next/link';
import CourseCard from '@/components/course/CourseCard';
import StudentHeader from '@/components/shared/StudentHeader';
import type { CourseCard as CourseCardType, User } from '@/types/course';
import styles from './CoursesContent.module.css';

interface CoursesContentProps {
  courses: CourseCardType[];
  user: User;
  orgName?: string | null;
  /** Inscripciones activas (sin finalizar) del alumno, para el saludo. */
  activeCount?: number;
}

const LEVEL_ORDER = ['Principiante', 'Intermedio', 'Avanzado'];

/**
 * Cursos que el admin asignó al alumno: los cubiertos por una licencia activa de
 * su organización (es_de_mi_org) y los RAM a los que llegó por invitación (ya
 * inscrito). Tienen prioridad sobre "gratuitos" para no repetir tarjetas.
 */
function isAssigned(c: CourseCardType): boolean {
  return Boolean(c.esDeMiOrg || (c.marca === 'ram' && c.enrolled));
}

function isFreeNextgen(c: CourseCardType): boolean {
  return c.marca === 'nextgen' && Boolean(c.esGratis) && !isAssigned(c);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function CoursesContent({ courses, user, orgName, activeCount = 0 }: CoursesContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean)))
    .sort((a, b) => (a as string).localeCompare(b as string, 'es')) as string[];
  const levels = LEVEL_ORDER.filter((lvl) => courses.some((c) => c.level === lvl));
  const hasActiveFilters = Boolean(searchQuery.trim() || levelFilter || categoryFilter);

  const filteredCourses = courses.filter((course) => {
    const q = searchQuery.trim().toLowerCase();
    // En un curso global también se buscan los títulos de los cursos que tiene dentro.
    const matchesSearch = !q
      || course.title.toLowerCase().includes(q)
      || (course.subcursosTitulos ?? []).some((t) => t.toLowerCase().includes(q));
    const matchesLevel = !levelFilter || course.level === levelFilter;
    const matchesCategory = !categoryFilter || course.category === categoryFilter;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const clearFilters = () => {
    setLevelFilter('');
    setCategoryFilter('');
    setSearchQuery('');
  };

  const groups = [
    {
      key: 'free',
      title: 'Cursos gratuitos NextGenIA',
      note: null as string | null,
      items: filteredCourses.filter(isFreeNextgen),
    },
    {
      key: 'assigned',
      title: 'Cursos RAM asignados',
      note: orgName ? `Licencia de ${orgName}` : null,
      items: filteredCourses.filter(isAssigned),
    },
  ].filter((g) => g.items.length > 0);

  const firstName = user.name.split(/\s+/)[0];

  return (
    <div className={styles.container}>
      <StudentHeader />

      <main className={styles.main}>
        <section className={styles.pageHead} aria-labelledby="dashboard-title">
          <h1 id="dashboard-title" className={styles.pageTitle}>Hola, {firstName}</h1>
          <p className={styles.pageSubtitle}>
            {activeCount > 0 ? (
              <>
                Tienes {plural(activeCount, 'curso', 'cursos')} en curso.{' '}
                <Link href="/mis-cursos" className={styles.inlineLink}>Ver mi progreso</Link>
              </>
            ) : (
              'Elige un curso para empezar.'
            )}
          </p>
        </section>

        <section className={styles.toolbar} aria-label="Buscar y filtrar cursos">
          <div className={styles.searchRow}>
            <label className={styles.searchInputWrapper}>
              <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                placeholder="Buscar por título"
                aria-label="Buscar por título"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            {/* Con un solo nivel en el catálogo el filtro no aporta nada: se oculta. */}
            {levels.length > 1 && (
              <select
                className={styles.select}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                aria-label="Filtrar por nivel"
              >
                <option value="">Todos los niveles</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            )}
          </div>

          {categories.length > 1 && (
            <div className={styles.chips} role="group" aria-label="Categoría">
              {[{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c, label: c }))].map((opt) => (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  className={styles.chip}
                  aria-pressed={categoryFilter === opt.value}
                  onClick={() => setCategoryFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              {hasActiveFilters && (
                <button type="button" className={styles.clearButton} onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </section>

        {groups.length > 0 ? (
          <div className={styles.sections}>
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`}>
                <div className={styles.sectionHead}>
                  <h2 id={`group-${group.key}`} className={styles.sectionTitle}>{group.title}</h2>
                  <span className={styles.sectionCount}>
                    {group.note ? `${group.note} · ` : ''}
                    {plural(group.items.length, 'curso', 'cursos')}
                    {(() => {
                      const pendientes = group.items.filter((c) => !c.enrolled && !c.bloqueadoPorLicencia).length;
                      return pendientes > 0 ? ` · ${pendientes} por inscribir` : '';
                    })()}
                  </span>
                </div>
                <div className={styles.coursesGrid}>
                  {group.items.map((course) => <CourseCard key={course.id} course={course} />)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            {hasActiveFilters ? (
              <>
                <p>Ningún curso coincide con tu búsqueda.</p>
                <button type="button" className={styles.ghostButton} onClick={clearFilters}>
                  Limpiar filtros
                </button>
              </>
            ) : (
              <p>Todavía no hay cursos disponibles para ti.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
