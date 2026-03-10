'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cursosApi } from '@/lib/api/client';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
  creado_en: string;
  portada_url: string | null;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

export default function CursosListPage() {
  const router = useRouter();
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cursosApi.list({ limit: 200 }).then((resp) => {
      const r = resp as ApiCursosResp;
      setCursos(r.data);
      setCount(r.count);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      publicado: 'Publicado',
      borrador: 'Borrador',
      revision: 'En revision',
      archivado: 'Archivado',
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
        <button className={styles.backButton} onClick={() => router.push('/admin')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a opciones
        </button>
        <Link href="/admin/cursos/crear" className={styles.createButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear curso
        </Link>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <h1 className={styles.pageTitle}>Cursos creados</h1>
          <span className={styles.courseCount}>{count} cursos</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <div className={styles.courseList}>
            {cursos.map((course) => (
              <div key={course.id} className={styles.courseItem}>
                {course.portada_url && (
                  <img
                    src={`${API_URL}${course.portada_url}`}
                    alt={course.titulo}
                    className={styles.courseThumbnail}
                  />
                )}
                <div className={styles.courseInfo}>
                  <h3 className={styles.courseTitle}>{course.titulo}</h3>
                  <span className={`${styles.statusBadge} ${getStatusClass(course.estado)}`}>
                    {getStatusLabel(course.estado)}
                  </span>
                </div>
                <div className={styles.courseActions}>
                  <span className={styles.assignedBadge}>
                    {course.creado_en?.slice(0, 10) ?? ''}
                  </span>
                  <Link href={`/admin/cursos/${course.id}/editar`} className={styles.editButton}>
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
