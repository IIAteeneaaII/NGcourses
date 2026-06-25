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
  const [nota, setNota] = useState('');
  const [notaError, setNotaError] = useState('');

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
    if (action === 'solicitar_cambios' && !nota.trim()) {
      setNotaError('Describe los cambios solicitados.');
      return;
    }
    setActionLoading(id + action);
    try {
      if (action === 'publicar') {
        await cursosApi.update(id, { estado: 'publicado' });
      } else if (action === 'solicitar_cambios') {
        await cursosApi.update(id, { estado: 'borrador', notas_revision: nota.trim() });
      } else if (action === 'rechazar') {
        // No se elimina: el curso se conserva en estado 'rechazado' con el motivo.
        await cursosApi.update(id, { estado: 'rechazado', notas_revision: nota.trim() || undefined });
      }
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Fallo silencioso — el curso sigue en la lista
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
      setNota('');
      setNotaError('');
    }
  };

  const openConfirm = (curso: ApiCurso, action: ActionType) => {
    setNota('');
    setNotaError('');
    setConfirmModal({ id: curso.id, titulo: curso.titulo, action });
  };

  const actionLabel: Record<ActionType, string> = {
    publicar: 'Publicar',
    solicitar_cambios: 'Solicitar cambios',
    rechazar: 'Rechazar',
  };

  const actionMsg: Record<ActionType, string> = {
    publicar: 'El curso quedará visible para los estudiantes inmediatamente.',
    solicitar_cambios: 'El curso regresará al instructor como borrador con tus notas.',
    rechazar: 'El curso se marcará como rechazado (no se elimina) y volverá al instructor con el motivo.',
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/admin')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
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
        <div className={styles.modalOverlay} onClick={() => { setConfirmModal(null); setNota(''); setNotaError(''); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {actionLabel[confirmModal.action]}: &ldquo;{confirmModal.titulo}&rdquo;
            </h3>
            <p className={styles.modalDesc}>{actionMsg[confirmModal.action]}</p>
            {(confirmModal.action === 'solicitar_cambios' || confirmModal.action === 'rechazar') && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  {confirmModal.action === 'solicitar_cambios' ? 'Cambios solicitados *' : 'Motivo del rechazo (opcional)'}
                </label>
                <textarea
                  value={nota}
                  onChange={(e) => { setNota(e.target.value); setNotaError(''); }}
                  rows={3}
                  placeholder={confirmModal.action === 'solicitar_cambios' ? 'Ej: Faltan subtítulos en el módulo 2.' : 'Ej: El contenido no cumple los lineamientos.'}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
                {notaError && <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#dc2626' }}>{notaError}</p>}
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setConfirmModal(null); setNota(''); setNotaError(''); }}>
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
