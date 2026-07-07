'use client';


import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CourseCard from '@/components/course/CourseCard';
import type { CourseCard as CourseCardType, User } from '@/types/course';
import { logout } from '@/lib/auth';
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

  const levels = Array.from(new Set(courses.map((c) => c.level).filter(Boolean))) as string[];
  const categories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean))) as string[];

  const filteredCourses = courses.filter((course) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || course.title.toLowerCase().includes(q);
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

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

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

          <div className={styles.userDropdown}>
            <button className={styles.userButton} onClick={toggleDropdown}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className={styles.userAvatarImg} />
              ) : (
                <div className={styles.userAvatar}>{user.initials}</div>
              )}
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Mi Perfil
                </Link>
                <Link
                  href="/mis-cursos"
                  className={styles.dropdownItem}
                  onClick={closeDropdown}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  Mis Cursos
                </Link>
                <button className={styles.dropdownItem} onClick={handleLogout}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.dropdownIcon}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
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

          <div className={styles.searchToolbar}>
            <div className={styles.searchInputWrapper}>
              <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por título"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.filtersContainer}>
              <div className={styles.filterSelectWrapper}>
                <select
                  className={styles.filterSelect}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtrar por categoría"
                >
                  <option value="">Categoría</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className={styles.filterSelectWrapper}>
                <select
                  className={styles.filterSelect}
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  aria-label="Filtrar por nivel"
                >
                  <option value="">Nivel</option>
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className={styles.clearFiltersButton}
              onClick={() => { setLevelFilter(''); setCategoryFilter(''); setSearchQuery(''); }}
            >
              Limpiar
            </button>

            <button className={styles.coursesButton}>Cursos</button>
          </div>
        </section>

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
