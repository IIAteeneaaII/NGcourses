'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Course {
  id: string;
  title: string;
  assignedCount: number;
  status: 'publicado' | 'borrador' | 'revision';
  createdAt: string;
}

const MOCK_COURSES: Course[] = [
  { id: '1', title: 'Facturacion Electronica Avanzada', assignedCount: 45, status: 'publicado', createdAt: '2024-01-15' },
  { id: '2', title: 'Gestion de Recursos Humanos', assignedCount: 38, status: 'publicado', createdAt: '2024-01-12' },
  { id: '3', title: 'Marketing Digital Corporativo', assignedCount: 0, status: 'borrador', createdAt: '2024-01-10' },
  { id: '4', title: 'Contabilidad Basica', assignedCount: 52, status: 'publicado', createdAt: '2024-01-08' },
  { id: '5', title: 'Atencion al Cliente', assignedCount: 29, status: 'publicado', createdAt: '2024-01-05' },
  { id: '6', title: 'Seguridad Industrial', assignedCount: 0, status: 'revision', createdAt: '2024-01-03' },
  { id: '7', title: 'Liderazgo y Gestion de Equipos', assignedCount: 41, status: 'publicado', createdAt: '2024-01-01' },
  { id: '8', title: 'Excel Avanzado', assignedCount: 67, status: 'publicado', createdAt: '2023-12-28' },
  { id: '9', title: 'Comunicacion Efectiva', assignedCount: 33, status: 'publicado', createdAt: '2023-12-25' },
  { id: '10', title: 'Gestion del Tiempo', assignedCount: 0, status: 'borrador', createdAt: '2023-12-20' },
  { id: '11', title: 'Normativas y Cumplimiento', assignedCount: 25, status: 'publicado', createdAt: '2023-12-18' },
  { id: '12', title: 'Introduccion a la Empresa', assignedCount: 89, status: 'publicado', createdAt: '2023-12-15' },
];

export default function CursosListPage() {
  const router = useRouter();

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      publicado: 'Publicado',
      borrador: 'Borrador',
      revision: 'En revision',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      publicado: styles.statusPublished,
      borrador: styles.statusDraft,
      revision: styles.statusReview,
    };
    return classes[status] || '';
  };

  return (
    <div className={styles.pageContainer}>
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
        <Link href="/admin/cursos/crear" className={styles.createButton}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear curso
        </Link>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <h1 className={styles.pageTitle}>Cursos creados</h1>
          <span className={styles.courseCount}>{MOCK_COURSES.length} cursos</span>
        </div>

        <div className={styles.courseList}>
          {MOCK_COURSES.map((course) => (
            <div key={course.id} className={styles.courseItem}>
              <div className={styles.courseInfo}>
                <h3 className={styles.courseTitle}>{course.title}</h3>
                <span className={`${styles.statusBadge} ${getStatusClass(course.status)}`}>
                  {getStatusLabel(course.status)}
                </span>
              </div>
              <div className={styles.courseActions}>
                <span className={styles.assignedBadge}>
                  {course.assignedCount} asignados
                </span>
                <Link
                  href={`/admin/cursos/${course.id}/editar`}
                  className={styles.editButton}
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
