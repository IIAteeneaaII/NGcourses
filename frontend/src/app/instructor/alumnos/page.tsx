'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getInstructorStudents, getInstructorCourses } from '@/data/instructor';
import styles from './page.module.css';

const ITEMS_PER_PAGE = 10;

export default function AlumnosInstructorPage() {
  const router = useRouter();
  const allStudents = getInstructorStudents();
  const allCourses = getInstructorCourses();

  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStudents = useMemo(() => {
    return allStudents.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());
      // For demo purposes all students match any course filter
      return matchesSearch;
    });
  }, [allStudents, searchTerm, courseFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleCourseFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCourseFilter(e.target.value);
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al dashboard
        </button>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <div>
            <h1 className={styles.pageTitle}>Alumnos</h1>
            <p className={styles.pageSubtitle}>Progreso de alumnos en tus cursos</p>
          </div>
          <span className={styles.totalCount}>{filteredStudents.length} alumnos</span>
        </div>

        {/* Filters */}
        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
          <select
            value={courseFilter}
            onChange={handleCourseFilterChange}
            className={styles.filterSelect}
          >
            <option value="todos">Todos los cursos</option>
            {allCourses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Email</th>
                <th>Departamento</th>
                <th>Inscritos</th>
                <th>Completados</th>
                <th>Progreso General</th>
                <th>Ultima Actividad</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>{student.initials}</div>
                      <span className={styles.name}>{student.name}</span>
                    </div>
                  </td>
                  <td className={styles.emailCell}>{student.email}</td>
                  <td>{student.department}</td>
                  <td className={styles.centerCell}>{student.enrolledCourses}</td>
                  <td className={styles.centerCell}>{student.completedCourses}</td>
                  <td>
                    <div className={styles.progressCell}>
                      <div className={styles.progressTrack}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${student.overallProgress}%` }}
                        />
                      </div>
                      <span className={styles.progressText}>{student.overallProgress}%</span>
                    </div>
                  </td>
                  <td className={styles.dateCell}>{formatDate(student.lastActivity)}</td>
                </tr>
              ))}
              {paginatedStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    No se encontraron alumnos con ese criterio de busqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.paginationButton}
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span className={styles.paginationInfo}>
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              className={styles.paginationButton}
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
