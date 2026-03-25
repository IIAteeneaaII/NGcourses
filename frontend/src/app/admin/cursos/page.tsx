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
  const [deleteConfirm, setDeleteConfirm] = useState<ApiCurso | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await cursosApi.delete(id);
      setCursos((prev) => prev.filter((c) => c.id !== id));
      setCount((n) => n - 1);
      setDeleteConfirm(null);
    } catch (err: unknown) {
      console.error('[DELETE CURSO] error object:', err);
      console.error('[DELETE CURSO] detail:', (err as { detail?: string })?.detail);
      console.error('[DELETE CURSO] status:', (err as { status?: number })?.status);
      const apiErr = err as { detail?: string };
      setDeleteError(apiErr?.detail || 'Error al eliminar el curso.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    cursosApi.list({ limit: 200 }).then((resp) => {
      const r = resp as ApiCursosResp;
      // Ordenar por más reciente primero
      const sorted = [...r.data].sort((a, b) =>
        new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
      );
      setCursos(sorted);
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

        <div className={styles.searchBar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre de curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <div className={styles.courseList}>
            {cursos
              .filter((c) => c.titulo.toLowerCase().includes(search.toLowerCase()))
              .map((course) => (
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
                  <button
                    className={styles.deleteButton}
                    onClick={() => { setDeleteError(''); setDeleteConfirm(course); }}
                    title="Eliminar curso"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && cursos.filter((c) => c.titulo.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1.5rem 0' }}>
            No se encontraron cursos con ese nombre.
          </p>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
             onClick={() => { setDeleteConfirm(null); setDeleteError(''); }}>
          <div style={{ background: '#fff', borderRadius: '0.9375rem', padding: '2rem', maxWidth: '420px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
               onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--color-text-primary)' }}>Eliminar curso</h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              ¿Estás seguro de eliminar <strong>&ldquo;{deleteConfirm.titulo}&rdquo;</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 1rem' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirm(null); setDeleteError(''); }}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '0.5rem', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
