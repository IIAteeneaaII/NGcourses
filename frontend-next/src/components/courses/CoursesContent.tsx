'use client';

import { useState } from 'react';
import Link from 'next/link';
import CourseCard from '@/components/course/CourseCard';
import type { CourseCard as CourseCardType, User } from '@/types/course';
import styles from './CoursesContent.module.css';

interface CoursesContentProps {
  courses: CourseCardType[];
  user: User;
}

export default function CoursesContent({ courses, user }: CoursesContentProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
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
                <button className={styles.dropdownItem} onClick={closeDropdown}>
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
          <button className={styles.filterButton}>Categoría</button>
          <button className={styles.filterButton}>Nivel</button>
          <button className={styles.filterButton}>Duración</button>
        </div>

        <div className={styles.coursesGrid}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </main>
    </div>
  );
}
