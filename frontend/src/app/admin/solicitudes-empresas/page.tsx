'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { solicitudesAdminApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface ApiSolicitud {
  id: string;
  organizacion_id: string;
  organizacion_nombre: string | null;
  solicitante_nombre: string | null;
  solicitante_email: string | null;
  titulo_solicitud: string;
  descripcion: string | null;
  estado: string;
  creado_en: string;
  actualizado_en: string | null;
}

interface ApiResponse {
  data: ApiSolicitud[];
  count: number;
}

type ActionType = 'aprobada' | 'rechazada' | 'en_revision';

const ESTADO_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};

const ESTADO_CLASS: Record<string, string> = {
  abierta: styles.statusPending,
  en_revision: styles.statusReview,
  aprobada: styles.statusApproved,
  rechazada: styles.statusRejected,
  cerrada: styles.statusReview,
};

const ACTION_LABEL: Record<ActionType, string> = {
  aprobada: 'Aprobar',
  rechazada: 'Rechazar',
  en_revision: 'Poner en revisión',
};

const ACTION_MSG: Record<ActionType, string> = {
  aprobada: 'La solicitud se marcará como aprobada. Después podrás crear el curso correspondiente.',
  rechazada: 'La solicitud se marcará como rechazada. Puedes dejar un motivo para el supervisor.',
  en_revision: 'La solicitud quedará en revisión mientras la evalúas.',
};

export default function SolicitudesEmpresasPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApiSolicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ id: string; titulo: string; action: ActionType } | null>(null);
  const [comentario, setComentario] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await solicitudesAdminApi.listar() as ApiResponse;
      setItems(resp.data ?? []);
    } catch (e) {
      logError('admin/solicitudes-empresas/fetch', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      const updated = await solicitudesAdminApi.actualizar(confirmModal.id, {
        estado: confirmModal.action,
        comentario: comentario.trim() || undefined,
      }) as ApiSolicitud;
      setItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      logError('admin/solicitudes-empresas/action', e);
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
      setComentario('');
    }
  };

  const openConfirm = (s: ApiSolicitud, action: ActionType) => {
    setComentario('');
    setConfirmModal({ id: s.id, titulo: s.titulo_solicitud, action });
  };

  const formatDate = (d: string) => d.slice(0, 10);
  const pendientes = items.filter((s) => s.estado === 'abierta' || s.estado === 'en_revision').length;

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
          Solicitudes de empresas
        </h1>
      </div>

      <div className={styles.historySection} style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className={styles.historyTitle} style={{ margin: 0 }}>
            Solicitudes de curso de supervisores
          </h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {pendientes} pendiente{pendientes !== 1 ? 's' : ''} de {items.length}
          </span>
        </div>

        {loading ? (
          <p className={styles.emptyState}>Cargando...</p>
        ) : items.length === 0 ? (
          <p className={styles.emptyState} style={{ padding: '3rem', textAlign: 'center' }}>
            No hay solicitudes de empresas.
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Solicitante</th>
                  <th>Curso solicitado</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const cerrada = s.estado === 'aprobada' || s.estado === 'rechazada' || s.estado === 'cerrada';
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.organizacion_nombre || '—'}</td>
                      <td>
                        <div>{s.solicitante_nombre || '—'}</div>
                        {s.solicitante_email && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{s.solicitante_email}</div>
                        )}
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600 }}>{s.titulo_solicitud}</div>
                        {s.descripcion && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{s.descripcion}</div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${ESTADO_CLASS[s.estado] ?? ''}`}>
                          {ESTADO_LABEL[s.estado] ?? s.estado}
                        </span>
                      </td>
                      <td>{formatDate(s.creado_en)}</td>
                      <td>
                        {cerrada ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>—</span>
                        ) : (
                          <div className={styles.actionButtons}>
                            <button className={styles.btnPublish} disabled={actionLoading} onClick={() => openConfirm(s, 'aprobada')}>
                              Aprobar
                            </button>
                            <button className={styles.btnChanges} disabled={actionLoading} onClick={() => openConfirm(s, 'en_revision')}>
                              En revisión
                            </button>
                            <button className={styles.btnReject} disabled={actionLoading} onClick={() => openConfirm(s, 'rechazada')}>
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmModal && (
        <div className={styles.modalOverlay} onClick={() => { setConfirmModal(null); setComentario(''); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {ACTION_LABEL[confirmModal.action]}: &ldquo;{confirmModal.titulo}&rdquo;
            </h3>
            <p className={styles.modalDesc}>{ACTION_MSG[confirmModal.action]}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Comentario para el supervisor {confirmModal.action === 'rechazada' ? '(motivo)' : '(opcional)'}
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Ej: Ya tenemos un curso equivalente en el catálogo."
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setConfirmModal(null); setComentario(''); }}>
                Cancelar
              </button>
              <button
                className={confirmModal.action === 'rechazada' ? styles.btnReject : styles.btnPublish}
                disabled={actionLoading}
                onClick={handleAction}
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
