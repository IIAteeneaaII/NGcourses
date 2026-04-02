'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cursosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
  duracion_seg: number;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

export default function InstructorCursosPage() {
  const router = useRouter();
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    cursosApi.list({ limit: 200 }).then((resp) => {
      setCursos((resp as ApiCursosResp).data);
    }).catch((e) => logError('instructor/cursos/page/load', e)).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    cursos.filter((c) => {
      const matchSearch = c.titulo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'todos' || c.estado === statusFilter;
      return matchSearch && matchStatus;
    }), [cursos, searchTerm, statusFilter]);

  const getStatusLabel = (s: string) => ({ publicado: 'Publicado', borrador: 'Borrador', revision: 'En revision', archivado: 'Archivado' }[s] || s);
  const getStatusClass = (s: string) => ({ publicado: styles.statusPublished, borrador: styles.statusDraft, revision: styles.statusReview }[s] || '');

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor')}>
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
          <span className={styles.courseCount}>{filtered.length} cursos</span>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
            <option value="todos">Todos</option>
            <option value="publicado">Publicado</option>
            <option value="borrador">Borrador</option>
            <option value="revision">En revision</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <div className={styles.courseList}>
            {filtered.map((course) => (
              <div key={course.id} className={styles.courseItem}>
                <div className={styles.courseInfo}>
                  <div className={styles.courseTitleRow}>
                    <h3 className={styles.courseTitle}>{course.titulo}</h3>
                    <span className={`${styles.statusBadge} ${getStatusClass(course.estado)}`}>
                      {getStatusLabel(course.estado)}
                    </span>
                  </div>
                  <div className={styles.courseMeta}>
                    <span className={styles.metaItem}>{Math.round(course.duracion_seg / 3600)}h de contenido</span>
                  </div>
                </div>
                <div className={styles.courseActions}>
                  <Link href={`/instructor/cursos/${course.id}/editar`} className={styles.editButton}>Editar</Link>
                  <Link href={`/instructor/cursos/${course.id}/estadisticas`} className={styles.statsButton}>Estadisticas</Link>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p>No se encontraron cursos con los filtros seleccionados.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
