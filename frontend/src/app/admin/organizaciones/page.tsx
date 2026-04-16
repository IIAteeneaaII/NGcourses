'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { organizacionesApi } from '@/lib/api/client';
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

interface CreateOrgForm {
  nombre: string;
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
    nombre: '', email_contacto: '', telefono_contacto: '', plan_de_cursos: '', fecha_compra: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await organizacionesApi.create({
        nombre: createForm.nombre,
        email_contacto: createForm.email_contacto || null,
        telefono_contacto: createForm.telefono_contacto || null,
        plan_de_cursos: createForm.plan_de_cursos || null,
        fecha_compra: createForm.fecha_compra ? new Date(createForm.fecha_compra).toISOString() : null,
      });
      setShowCreateModal(false);
      setCreateForm({ nombre: '', email_contacto: '', telefono_contacto: '', plan_de_cursos: '', fecha_compra: '' });
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
              <path d="M19 12H5M12 19l-7-7 7-7" />
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
                      <button className={styles.editButton} onClick={() => router.push(`/admin/organizaciones/${o.id}`)} title="Ver detalle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
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
                <label className={styles.formLabel}>Email de contacto</label>
                <input
                  type="email"
                  value={createForm.email_contacto}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email_contacto: e.target.value }))}
                  className={styles.formInput}
                  placeholder="contacto@empresa.com"
                />
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
