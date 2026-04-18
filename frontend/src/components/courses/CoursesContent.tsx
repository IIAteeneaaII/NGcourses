'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CourseCard from '@/components/course/CourseCard';
import type { CourseCard as CourseCardType, User } from '@/types/course';
import styles from './CoursesContent.module.css';

interface CoursesContentProps {
  courses: CourseCardType[];
  user: User;
  orgName?: string | null;
}

export default function CoursesContent({ courses, user, orgName }: CoursesContentProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const levels = Array.from(new Set(courses.map((c) => c.level).filter(Boolean)));
  const categories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean))) as string[];

  const filteredCourses = courses.filter((course) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      course.title.toLowerCase().includes(q) ||
      course.instructor.toLowerCase().includes(q) ||
      (course.category?.toLowerCase().includes(q) ?? false);
    const matchesLevel = !levelFilter || course.level === levelFilter;
    const matchesCategory = !categoryFilter || course.category === categoryFilter;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    document.cookie = 'access_token=; Max-Age=0; path=/';
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Cursos Online</div>

          <div className={styles.userDropdown}>
            <button className={styles.userButton} onClick={toggleDropdown}>
              <div className={styles.userAvatar}>{user.initials}</div>
              <span className={styles.userName}>{user.name}</span>
              <span
                className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.dropdownArrowOpen : ''}`}
              >
                ▼
              </span>
            </button>

            {isDropdownOpen && (
              <div className={styles.dropdownMenu}>
                <Link
                  href="/perfil"
                  className={styles.dropdownItem}
                  onClick={closeDropdown}
                >
                  Mi Perfil
                </Link>
                <Link
                  href="/mis-cursos"
                  className={styles.dropdownItem}
                  onClick={closeDropdown}
                >
                  Mis Cursos
                </Link>
                <button className={styles.dropdownItem} onClick={handleLogout}>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.searchSection}>
          <h1 className={styles.searchTitle}>Buscar cursos</h1>

          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar por título, categoría o instructor"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className={styles.coursesButton}>Cursos</button>
          </div>
        </section>

        <div className={styles.filtersContainer}>
          <select
            className={styles.filterButton}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Categoría</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            className={styles.filterButton}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="">Nivel</option>
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
          {(levelFilter || categoryFilter || searchQuery) && (
            <button
              className={styles.filterButton}
              onClick={() => { setLevelFilter(''); setCategoryFilter(''); setSearchQuery(''); }}
              style={{ color: 'var(--color-accent-10)' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {(() => {
          const orgCourses = filteredCourses.filter((c) => c.marca === 'ram');
          const nextgenCourses = filteredCourses.filter((c) => c.marca === 'nextgen');
          const untagged = filteredCourses.filter((c) => !c.marca);
          const hasGroups = orgCourses.length > 0 || nextgenCourses.length > 0;

          if (!hasGroups) {
            return (
              <div className={styles.coursesGrid}>
                {untagged.length > 0 ? (
                  untagged.map((course) => <CourseCard key={course.id} course={course} />)
                ) : (
                  <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem 0' }}>
                    No se encontraron cursos con los filtros aplicados.
                  </p>
                )}
              </div>
            );
          }

          return (
            <>
              {orgCourses.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>{orgName ? `Cursos ${orgName}` : 'Cursos de tu organización'}</h2>
                  <div className={styles.coursesGrid}>
                    {orgCourses.map((course) => <CourseCard key={course.id} course={course} />)}
                  </div>
                </>
              )}
              {nextgenCourses.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Cursos NextGen</h2>
                  <div className={styles.coursesGrid}>
                    {nextgenCourses.map((course) => <CourseCard key={course.id} course={course} />)}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}
