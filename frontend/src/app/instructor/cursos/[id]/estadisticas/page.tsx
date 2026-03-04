'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCourseStatistics } from '@/data/instructor';
import type { StudentCourseProgress } from '@/types/instructor';
import styles from './page.module.css';

export default function EstadisticasCursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const stats = getCourseStatistics(courseId);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = useMemo(() => {
    if (!stats) return [];
    return stats.students.filter((s) =>
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats, searchTerm]);

  const getStatusLabel = (status: StudentCourseProgress['status']) => {
    const labels = {
      en_progreso: 'En progreso',
      completado: 'Completado',
      sin_iniciar: 'Sin iniciar',
    };
    return labels[status];
  };

  const getStatusClass = (status: StudentCourseProgress['status']) => {
    const classes = {
      en_progreso: styles.statusEnProgreso,
      completado: styles.statusCompletado,
      sin_iniciar: styles.statusSinIniciar,
    };
    return classes[status];
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!stats) {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingText}>No se encontraron estadisticas para este curso.</p>
        <button className={styles.backButton} onClick={() => router.push('/instructor/cursos')}>
          Volver a Mis Cursos
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor/cursos')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a Mis Cursos
        </button>
        <h1 className={styles.courseTitle}>{stats.courseTitle}</h1>
      </div>

      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Inscritos</p>
          <p className={styles.statValue}>{stats.totalEnrolled}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Alumnos Activos</p>
          <p className={styles.statValue}>{stats.activeStudents}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Completados</p>
          <p className={styles.statValue}>{stats.completedStudents}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Progreso Promedio</p>
          <p className={styles.statValue}>{stats.averageProgress}%</p>
        </div>
      </div>

      {/* Enrollment History */}
      <div className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Historial de Inscripciones</h2>
        <table className={styles.enrollmentTable}>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Nuevos inscritos</th>
            </tr>
          </thead>
          <tbody>
            {stats.enrollmentHistory.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lesson Completion Rates */}
      <div className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Tasa de Completado por Leccion</h2>
        <div className={styles.lessonList}>
          {stats.lessonCompletionRates.map((lesson) => (
            <div key={lesson.lessonName} className={styles.lessonItem}>
              <div className={styles.lessonHeader}>
                <span className={styles.lessonName}>{lesson.lessonName}</span>
                <span className={styles.lessonPercentage}>{lesson.completionRate}%</span>
              </div>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${lesson.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Progress */}
      <div className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Progreso de Alumnos</h2>
        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.studentTableWrapper}>
          <table className={styles.studentTable}>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Email</th>
                <th>Progreso</th>
                <th>Lecciones</th>
                <th>Ultimo acceso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.studentId}>
                  <td>
                    <div className={styles.studentNameCell}>
                      <div className={styles.avatarCircle}>{student.studentInitials}</div>
                      <span className={styles.studentName}>{student.studentName}</span>
                    </div>
                  </td>
                  <td>{student.studentEmail}</td>
                  <td>
                    <div className={styles.studentProgressCell}>
                      <div className={styles.studentProgressTrack}>
                        <div
                          className={styles.studentProgressFill}
                          style={{ width: `${student.progress}%` }}
                        />
                      </div>
                      <span className={styles.studentProgressText}>{student.progress}%</span>
                    </div>
                  </td>
                  <td>{student.completedLessons}/{student.totalLessons}</td>
                  <td>{formatDate(student.lastAccessed)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusClass(student.status)}`}>
                      {getStatusLabel(student.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                    No se encontraron alumnos con ese criterio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
