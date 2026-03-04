'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getManagedInstructors } from '@/data/instructor';
import type { ManagedInstructor } from '@/types/instructor';
import styles from './page.module.css';

export default function AdminInstructoresPage() {
  const router = useRouter();
  const instructors: ManagedInstructor[] = getManagedInstructors();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInstructorId, setExpandedInstructorId] = useState<string | null>(null);

  const filteredInstructors = instructors.filter((instructor) =>
    instructor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedInstructorId((prev) => (prev === id ? null : id));
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    const stars: React.ReactNode[] = [];

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg
          key={`full-${i}`}
          className={styles.starIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <svg
          key="half"
          className={styles.starIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="none"
        >
          <defs>
            <linearGradient id="halfGrad">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#d1d5db" />
            </linearGradient>
          </defs>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="url(#halfGrad)"
          />
        </svg>
      );
    }

    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg
          key={`empty-${i}`}
          className={styles.starIconEmpty}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="#d1d5db"
          stroke="none"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    }

    return stars;
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.headerBar}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/admin')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a opciones
        </button>
      </div>

      <div className={styles.titleSection}>
        <h1 className={styles.pageTitle}>Instructores</h1>
        <p className={styles.pageSubtitle}>Todos los instructores registrados en la plataforma</p>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar instructor por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Instructor Cards Grid */}
      <div className={styles.instructorsGrid}>
        {filteredInstructors.length === 0 && (
          <div className={styles.emptyState}>
            <p>No se encontraron instructores que coincidan con la busqueda.</p>
          </div>
        )}

        {filteredInstructors.map((instructor) => (
          <div key={instructor.id} className={styles.instructorCard}>
            <div className={styles.cardTop}>
              {/* Avatar and Info */}
              <div className={styles.instructorHeader}>
                <div className={styles.avatar}>
                  {instructor.initials}
                </div>
                <div className={styles.instructorInfo}>
                  <h3 className={styles.instructorName}>{instructor.name}</h3>
                  <p className={styles.instructorEmail}>{instructor.email}</p>
                  <p className={styles.instructorDepartment}>{instructor.department}</p>
                </div>
              </div>

              <div className={styles.cardActions}>
                {/* Status Badge */}
                <span
                  className={`${styles.statusBadge} ${
                    instructor.status === 'active'
                      ? styles.statusActive
                      : styles.statusInactive
                  }`}
                >
                  {instructor.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>

                {/* Edit Button */}
                <Link
                  href={`/admin/usuarios/${instructor.id}/editar`}
                  className={styles.editButton}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar
                </Link>
              </div>
            </div>

            {/* Stats Row */}
            <div className={styles.statsRow}>
              <span className={styles.statItem}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                {instructor.assignedCoursesCount} cursos
              </span>
              <span className={styles.statDivider}>|</span>
              <span className={styles.statItem}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {instructor.totalStudents} alumnos
              </span>
              <span className={styles.statDivider}>|</span>
              <span className={styles.statItem}>
                <span className={styles.starsContainer}>
                  {renderStars(instructor.averageRating)}
                </span>
                <span className={styles.ratingNumber}>{instructor.averageRating}</span>
              </span>
            </div>

            {/* Expand/Collapse Button */}
            <button
              className={styles.expandButton}
              onClick={() => toggleExpand(instructor.id)}
            >
              <span>
                {expandedInstructorId === instructor.id
                  ? 'Ocultar cursos asignados'
                  : 'Ver cursos asignados'}
              </span>
              <svg
                className={`${styles.expandIcon} ${
                  expandedInstructorId === instructor.id ? styles.expandIconRotated : ''
                }`}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Expanded Course List */}
            {expandedInstructorId === instructor.id && (
              <div className={styles.coursesList}>
                <h4 className={styles.coursesListTitle}>Cursos asignados</h4>
                {instructor.courses.length === 0 ? (
                  <p className={styles.noCourses}>
                    Este instructor no tiene cursos asignados.
                  </p>
                ) : (
                  <ul className={styles.coursesUl}>
                    {instructor.courses.map((course) => (
                      <li key={course.id} className={styles.courseItem}>
                        <div className={styles.courseInfo}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                          <span className={styles.courseTitle}>{course.title}</span>
                        </div>
                        <span className={styles.enrolledBadge}>
                          {course.enrolledCount} inscritos
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
