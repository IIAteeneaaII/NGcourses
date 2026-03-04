'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getInstructorCourses } from '@/data/instructor';
import styles from './page.module.css';

export default function InstructorCursosPage() {
  const router = useRouter();
  const allCourses = getInstructorCourses();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const filteredCourses = useMemo(() => {
    return allCourses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || course.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allCourses, searchTerm, statusFilter]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      publicado: 'Publicado',
      borrador: 'Borrador',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      publicado: styles.statusPublished,
      borrador: styles.statusDraft,
    };
    return classes[status] || '';
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/instructor')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al dashboard
        </button>
        <Link href="/instructor/cursos/crear" className={styles.createButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear curso
        </Link>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <h1 className={styles.pageTitle}>Mis Cursos</h1>
          <span className={styles.courseCount}>{filteredCourses.length} cursos</span>
        </div>

        {/* Filters */}
        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Buscar por nombre o instructor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todos">Todos</option>
            <option value="publicado">Publicado</option>
            <option value="borrador">Borrador</option>
          </select>
        </div>

        <div className={styles.courseList}>
          {filteredCourses.map((course) => (
            <div key={course.id} className={styles.courseItem}>
              <div className={styles.courseInfo}>
                <div className={styles.courseTitleRow}>
                  <h3 className={styles.courseTitle}>{course.title}</h3>
                  <span className={`${styles.statusBadge} ${getStatusClass(course.status)}`}>
                    {getStatusLabel(course.status)}
                  </span>
                </div>
                <div className={styles.courseMeta}>
                  <span className={styles.metaItem}>Instructor: {course.instructor}</span>
                  <span className={styles.metaItem}>{course.enrolledCount} alumnos inscritos</span>
                </div>
                {course.status === 'publicado' && (
                  <div className={styles.progressRow}>
                    <span className={styles.progressLabel}>Completado: {course.completionRate}%</span>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${course.completionRate}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.courseActions}>
                <Link href={`/instructor/cursos/${course.id}/editar`} className={styles.editButton}>
                  Editar
                </Link>
                {course.status === 'publicado' && (
                  <Link href={`/instructor/cursos/${course.id}/estadisticas`} className={styles.statsButton}>
                    Estadisticas
                  </Link>
                )}
              </div>
            </div>
          ))}

          {filteredCourses.length === 0 && (
            <div className={styles.emptyState}>
              <p>No se encontraron cursos con los filtros seleccionados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
