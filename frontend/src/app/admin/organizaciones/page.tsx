'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { organizacionesApi } from '@/lib/api/client';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Organizacion {
  id: string;
  nombre: string;
  email_contacto: string | null;
  telefono_contacto: string | null;
  plan_de_cursos: string | null;
  fecha_compra: string | null;
}

interface OrganizacionesResp {
  data: Organizacion[];
  count: number;
}

interface SupervisorSinOrg {
  user_id: string;
  email: string;
  full_name: string | null;
  estado: string;
}

interface CreateOrgForm {
  nombre: string;
  supervisor_nombre: string;
  supervisor_email: string;
  email_contacto: string;
  telefono_contacto: string;
  plan_de_cursos: string;
  fecha_compra: string;
}

const ITEMS_PER_PAGE = 10;

export default function OrganizacionesPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrgForm>({
    nombre: '', supervisor_nombre: '', supervisor_email: '', email_contacto: '', telefono_contacto: '', plan_de_cursos: '', fecha_compra: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Reparación: supervisores legacy sin organización + orgs sin supervisor (para
  // asignar 1 a 1 sin dejar una org con dos supervisores).
  const [orphans, setOrphans] = useState<SupervisorSinOrg[]>([]);
  const [orgsSinSup, setOrgsSinSup] = useState<Organizacion[]>([]);
  const { flags } = useFeatureFlags();
  // Con 'multiples_supervisores' un huérfano puede ir a cualquier org; sin el flag,
  // solo a una org que no tenga supervisor (1 por org en la beta).
  const orgsParaAsignar = flags['multiples_supervisores'] ? orgs : orgsSinSup;
  const [assignSel, setAssignSel] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const fetchReparacion = useCallback(async () => {
    try {
      const [sup, orgsLibres] = await Promise.all([
        organizacionesApi.supervisoresSinOrg(),
        organizacionesApi.orgsSinSupervisor(),
      ]);
      setOrphans(sup as SupervisorSinOrg[]);
      setOrgsSinSup(orgsLibres as Organizacion[]);
    } catch (e) {
      logError('organizaciones.reparacion', e);
    }
  }, []);

  const handleAsignarOrg = async (userId: string) => {
    const orgId = assignSel[userId];
    if (!orgId) return;
    setAssigningId(userId);
    try {
      await organizacionesApi.asignarMiembro(orgId, { user_id: userId, rol_org: 'admin_org' });
      setSuccessMsg('Supervisor asignado a la organización.');
      fetchReparacion();
      fetchOrgs();
    } catch (e) {
      logError('organizaciones.asignarOrgHuerfano', e);
      alert((e as { detail?: string })?.detail || 'No se pudo asignar la organización.');
    } finally {
      setAssigningId(null);
    }
  };

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await organizacionesApi.list({
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
      }) as OrganizacionesResp;
      setOrgs(resp.data);
      setTotal(resp.count);
    } catch (e) {
      logError('organizaciones.list', e);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);
  useEffect(() => { fetchReparacion(); }, [fetchReparacion]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await organizacionesApi.create({
        nombre: createForm.nombre,
        supervisor_nombre: createForm.supervisor_nombre,
        supervisor_email: createForm.supervisor_email,
        email_contacto: createForm.email_contacto || null,
        telefono_contacto: createForm.telefono_contacto || null,
        plan_de_cursos: createForm.plan_de_cursos || null,
        fecha_compra: createForm.fecha_compra ? new Date(createForm.fecha_compra).toISOString() : null,
      });
      setShowCreateModal(false);
      setSuccessMsg(`Organización creada. Se envió el correo de activación a ${createForm.supervisor_email} (pídele que revise Otros/Spam).`);
      setCreateForm({ nombre: '', supervisor_nombre: '', supervisor_email: '', email_contacto: '', telefono_contacto: '', plan_de_cursos: '', fecha_compra: '' });
      fetchOrgs();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setCreateError(apiErr?.detail || 'Error al crear la organización');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-MX');
    } catch {
      return '—';
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.pageTitle}>Organizaciones</h1>
          <p className={styles.pageSubtitle}>Gestión de organizaciones clientes y sus licencias</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className={styles.backButton} onClick={() => router.push('/admin')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
            Inicio
          </button>
          <button className={styles.createButton} onClick={() => { setShowCreateModal(true); setCreateError(''); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva organización
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          padding: '14px 18px', background: '#ecfdf5',
          border: '1px solid #6ee7b7', borderRadius: '12px', margin: '0 0 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#059669" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span style={{ color: '#065f46', fontSize: '14px', fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {orphans.length > 0 && (
        <section className={styles.mainContent} style={{ marginBottom: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            Supervisores sin organización ({orphans.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 0.85rem' }}>
            Estas cuentas de supervisor no tienen organización (datos legacy) y su panel no funciona. Asígnales una para activarlas.
          </p>
          <div className={styles.tableContainer}>
            <table className={styles.usersTable}>
              <thead>
                <tr><th>Email</th><th>Nombre</th><th>Organización</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <tr key={o.user_id}>
                    <td>{o.email}</td>
                    <td>{o.full_name || '—'}</td>
                    <td>
                      <select
                        value={assignSel[o.user_id] || ''}
                        onChange={(e) => setAssignSel((p) => ({ ...p, [o.user_id]: e.target.value }))}
                        disabled={orgsParaAsignar.length === 0}
                      >
                        <option value="">
                          {orgsParaAsignar.length === 0 ? 'No hay organizaciones disponibles' : 'Selecciona organización…'}
                        </option>
                        {orgsParaAsignar.map((org) => <option key={org.id} value={org.id}>{org.nombre}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        className={styles.createButton}
                        disabled={!assignSel[o.user_id] || assigningId === o.user_id}
                        onClick={() => handleAsignarOrg(o.user_id)}
                      >
                        {assigningId === o.user_id ? 'Asignando…' : 'Asignar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.mainContent}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className={styles.searchInput}
              placeholder="Buscar organización..."
            />
            <button type="button" className={styles.clearButton} onClick={() => { setSearchTerm(''); setCurrentPage(1); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Borrar
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Plan</th>
                <th>Compra</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.emptyState}>Cargando...</td></tr>
              ) : orgs.length > 0 ? (
                orgs.map((o) => (
                  <tr key={o.id}>
                    <td>{o.nombre}</td>
                    <td>{o.email_contacto || '—'}</td>
                    <td>{o.telefono_contacto || '—'}</td>
                    <td>{o.plan_de_cursos || '—'}</td>
                    <td>{formatDate(o.fecha_compra)}</td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editButton} onClick={() => router.push(`/admin/organizaciones/${o.id}`)} title="Editar organización">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className={styles.emptyState}>No hay organizaciones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationRow}>
          <button className={styles.pageButton} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className={styles.pageNumber}>{currentPage} / {totalPages || 1}</span>
          <button className={styles.pageButton} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </section>

      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Nueva Organización</h2>
              <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre *</label>
                <input
                  type="text"
                  required
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm((f) => ({ ...f, nombre: e.target.value }))}
                  className={styles.formInput}
                  placeholder="Ej: Coca-Cola"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre del supervisor *</label>
                <input
                  type="text"
                  required
                  value={createForm.supervisor_nombre}
                  onChange={(e) => setCreateForm((f) => ({ ...f, supervisor_nombre: e.target.value }))}
                  className={styles.formInput}
                  placeholder="Nombre del punto de contacto"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Correo del supervisor *</label>
                <input
                  type="email"
                  required
                  value={createForm.supervisor_email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, supervisor_email: e.target.value }))}
                  className={styles.formInput}
                  placeholder="supervisor@empresa.com"
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Se crea como supervisor de la organización y recibe un correo para activar su cuenta.
                </span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email de contacto (opcional)</label>
                <input
                  type="email"
                  value={createForm.email_contacto}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email_contacto: e.target.value }))}
                  className={styles.formInput}
                  placeholder="Si es distinto al del supervisor"
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Déjalo vacío si el contacto es el mismo que el supervisor: se usará su correo.
                </span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teléfono</label>
                <input
                  type="tel"
                  value={createForm.telefono_contacto}
                  onChange={(e) => setCreateForm((f) => ({ ...f, telefono_contacto: e.target.value }))}
                  className={styles.formInput}
                  placeholder="+52 55 0000 0000"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Plan de cursos</label>
                <textarea
                  value={createForm.plan_de_cursos}
                  onChange={(e) => setCreateForm((f) => ({ ...f, plan_de_cursos: e.target.value }))}
                  className={styles.formInput}
                  placeholder="Descripción de los cursos comprados"
                  rows={3}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fecha de compra</label>
                <input
                  type="date"
                  value={createForm.fecha_compra}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fecha_compra: e.target.value }))}
                  className={styles.formInput}
                />
              </div>
              {createError && <p className={styles.formError}>{createError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton} disabled={createLoading}>
                  {createLoading ? 'Creando...' : 'Crear organización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
