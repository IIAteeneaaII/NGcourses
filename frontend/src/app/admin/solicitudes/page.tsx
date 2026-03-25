'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cursosApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  instructor_id: string;
  created_at?: string;
}

interface ApiResponse {
  data: ApiCurso[];
  count: number;
}

type ActionType = 'publicar' | 'solicitar_cambios' | 'rechazar';

export default function SolicitudesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<ApiCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ id: string; titulo: string; action: ActionType } | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await cursosApi.list({ limit: 100, estado: 'revision' }) as ApiResponse;
      setCourses(resp.data ?? []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleAction = async (id: string, action: ActionType) => {
    setActionLoading(id + action);
    try {
      if (action === 'publicar') {
        await cursosApi.update(id, { estado: 'publicado' });
      } else if (action === 'solicitar_cambios') {
        await cursosApi.update(id, { estado: 'borrador' });
      } else if (action === 'rechazar') {
        await cursosApi.delete(id);
      }
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Fallo silencioso — el curso sigue en la lista
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const openConfirm = (curso: ApiCurso, action: ActionType) => {
    setConfirmModal({ id: curso.id, titulo: curso.titulo, action });
  };

  const actionLabel: Record<ActionType, string> = {
    publicar: 'Publicar',
    solicitar_cambios: 'Solicitar cambios',
    rechazar: 'Rechazar',
  };

  const actionMsg: Record<ActionType, string> = {
    publicar: 'El curso quedará visible para los estudiantes inmediatamente.',
    solicitar_cambios: 'El curso regresará al instructor como borrador para que realice modificaciones.',
    rechazar: 'El curso y todo su contenido (videos, archivos) serán eliminados permanentemente.',
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/admin')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al inicio
        </button>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-secondary-30)' }}>
          Solicitudes de revisión
        </h1>
      </div>

      <div className={styles.historySection} style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className={styles.historyTitle} style={{ margin: 0 }}>
            Cursos pendientes de aprobación
          </h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {courses.length} curso{courses.length !== 1 ? 's' : ''} pendiente{courses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <p className={styles.emptyState}>Cargando...</p>
        ) : courses.length === 0 ? (
          <p className={styles.emptyState} style={{ padding: '3rem', textAlign: 'center' }}>
            No hay cursos pendientes de revisión.
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((curso) => (
                  <tr key={curso.id}>
                    <td style={{ fontWeight: 600 }}>{curso.titulo}</td>
                    <td style={{ color: 'var(--color-text-secondary)', maxWidth: '280px' }}>
                      {curso.descripcion || '—'}
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.btnView}
                          onClick={() => router.push(`/admin/cursos/${curso.id}/preview`)}
                        >
                          Ver curso
                        </button>
                        <button
                          className={styles.btnPublish}
                          disabled={!!actionLoading}
                          onClick={() => openConfirm(curso, 'publicar')}
                        >
                          Publicar
                        </button>
                        <button
                          className={styles.btnChanges}
                          disabled={!!actionLoading}
                          onClick={() => openConfirm(curso, 'solicitar_cambios')}
                        >
                          Solicitar cambios
                        </button>
                        <button
                          className={styles.btnReject}
                          disabled={!!actionLoading}
                          onClick={() => openConfirm(curso, 'rechazar')}
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmModal && (
        <div className={styles.modalOverlay} onClick={() => setConfirmModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {actionLabel[confirmModal.action]}: &ldquo;{confirmModal.titulo}&rdquo;
            </h3>
            <p className={styles.modalDesc}>{actionMsg[confirmModal.action]}</p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button
                className={confirmModal.action === 'rechazar' ? styles.btnReject : styles.btnPublish}
                disabled={!!actionLoading}
                onClick={() => handleAction(confirmModal.id, confirmModal.action)}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
