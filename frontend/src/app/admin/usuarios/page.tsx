'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usersApi } from '@/lib/api/client';
import styles from './page.module.css';

interface CreateUserForm {
  email: string;
  full_name: string;
  password: string;
  rol: string;
  telefono: string;
}

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  rol: string;
  estado: 'activo' | 'suspendido' | 'pendiente_activacion';
}

interface ApiUsersResp {
  data: ApiUser[];
  count: number;
}

const ROLES: Record<string, string> = {
  administrador: 'Administrador',
  instructor: 'Instructor',
  estudiante: 'Estudiante',
  usuario_control: 'Control',
};

const ITEMS_PER_PAGE = 10;

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({ email: '', full_name: '', password: '', rol: 'estudiante', telefono: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [reenviarId, setReenviarId] = useState<string | null>(null);
  const [reenviarMsg, setReenviarMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await usersApi.list({
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        rol: roleFilter || undefined,
        search: searchTerm || undefined,
      }) as ApiUsersResp;
      setUsers(resp.data);
      setTotal(resp.count);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, roleFilter, searchTerm]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleToggleActive = async (user: ApiUser) => {
    const newEstado = user.estado === 'activo' ? 'suspendido' : 'activo';
    try {
      await usersApi.update(user.id, { estado: newEstado });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, estado: newEstado } : u));
    } catch {
      // Fallo silencioso
    }
  };

  const handleReenviarActivacion = async (userId: string) => {
    setReenviarId(userId);
    setReenviarMsg(null);
    try {
      const res = await fetch(`/api/v1/users/${userId}/reenviar-activacion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (!res.ok) throw new Error();
      setReenviarMsg({ tipo: 'ok', texto: 'Correo de activación reenviado correctamente.' });
    } catch {
      setReenviarMsg({ tipo: 'error', texto: 'No se pudo reenviar el correo. Intenta de nuevo.' });
    } finally {
      setReenviarId(null);
    }
  };

  const handleEliminarInvitacion = async (user: ApiUser) => {
    if (!confirm(`¿Cancelar la invitación de ${user.email}? El usuario no podrá activar su cuenta.`)) return;
    setEliminandoId(user.id);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((t) => t - 1);
    } catch {
      setReenviarMsg({ tipo: 'error', texto: 'No se pudo cancelar la invitación. Intenta de nuevo.' });
    } finally {
      setEliminandoId(null);
    }
  };

  const handleResetSearch = () => {
    setSearchTerm('');
    setRoleFilter('');
    setCurrentPage(1);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await usersApi.create({
        email: createForm.email,
        full_name: createForm.full_name || null,
        password: createForm.password,
        rol: createForm.rol,
        telefono: createForm.telefono || null,
      });
      setShowCreateModal(false);
      setCreateForm({ email: '', full_name: '', password: '', rol: 'estudiante', telefono: '' });
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setCreateError(apiErr?.detail || 'Error al crear el usuario');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.pageTitle}>Editar usuarios</h1>
          <p className={styles.pageSubtitle}>Gestion y edicion de usuarios del sistema</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className={styles.backButton} onClick={() => router.push('/admin')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Inicio
          </button>
          <button className={styles.createButton} style={{ background: 'white', color: '#00968f', border: '1px solid rgba(0,150,143,.3)' }} onClick={() => router.push('/admin/usuarios/crear')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Alta empresa
          </button>
          <button className={styles.createButton} onClick={() => { setShowCreateModal(true); setCreateError(''); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo usuario
          </button>
        </div>
      </div>

      <section className={styles.mainContent}>
        {reenviarMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', marginBottom: '16px', borderRadius: '10px',
            background: reenviarMsg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${reenviarMsg.tipo === 'ok' ? '#6ee7b7' : '#fca5a5'}`,
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: reenviarMsg.tipo === 'ok' ? '#065f46' : '#991b1b' }}>
              {reenviarMsg.texto}
            </span>
            <button
              onClick={() => setReenviarMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: reenviarMsg.tipo === 'ok' ? '#065f46' : '#991b1b', opacity: 0.7 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className={styles.searchInput}
              placeholder="Buscar usuario por nombre o email..."
            />
            <button type="button" className={styles.clearButton} onClick={handleResetSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Borrar
            </button>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            className={styles.roleSelect}
          >
            <option value="">Todos los roles</option>
            {Object.entries(ROLES).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className={styles.emptyState}>Cargando...</td></tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name || '—'}</td>
                    <td>{user.email}</td>
                    <td>{ROLES[user.rol] || user.rol}</td>
                    <td className={styles.actionsCell}>
                      {user.estado === 'pendiente_activacion' ? (
                        <>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 8px' }}>
                            Pendiente
                          </span>
                          <button
                            title="Reenviar correo de activación"
                            onClick={() => handleReenviarActivacion(user.id)}
                            disabled={reenviarId === user.id}
                            style={{ background: 'none', border: '1px solid rgba(0,150,143,.3)', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', color: '#00968f', fontWeight: 600 }}
                          >
                            {reenviarId === user.id ? '...' : 'Reenviar'}
                          </button>
                          <button
                            title="Cancelar invitación"
                            onClick={() => handleEliminarInvitacion(user)}
                            disabled={eliminandoId === user.id}
                            style={{ background: 'none', border: '1px solid rgba(239,68,68,.3)', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}
                          >
                            {eliminandoId === user.id ? '...' : 'Cancelar'}
                          </button>
                        </>
                      ) : (
                        <>
                          <Link href={`/admin/usuarios/${user.id}/editar`} className={styles.editButton} title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </Link>
                          <label className={styles.toggleLabel} title="Activar/Suspender cuenta">
                            <input
                              type="checkbox"
                              checked={user.estado === 'activo'}
                              onChange={() => handleToggleActive(user)}
                              className={styles.toggleInput}
                            />
                            <span className={styles.toggleSlider}></span>
                          </label>
                          <span className={`${styles.statusText} ${user.estado === 'activo' ? styles.active : styles.inactive}`}>
                            {user.estado === 'activo' ? 'Activo' : 'Suspendido'}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className={styles.emptyState}>No hay usuarios registrados</td></tr>
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
              <h2 className={styles.modalTitle}>Nuevo Usuario</h2>
              <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className={styles.formInput}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre completo</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={styles.formInput}
                  placeholder="Nombre Apellido"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contrasena * (min. 8 caracteres)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className={styles.formInput}
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teléfono</label>
                <input
                  type="tel"
                  value={createForm.telefono}
                  onChange={(e) => setCreateForm((f) => ({ ...f, telefono: e.target.value }))}
                  className={styles.formInput}
                  placeholder="+52 55 0000 0000"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Rol</label>
                <select
                  value={createForm.rol}
                  onChange={(e) => setCreateForm((f) => ({ ...f, rol: e.target.value }))}
                  className={styles.formInput}
                >
                  <option value="estudiante">Estudiante</option>
                  <option value="instructor">Instructor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              {createError && <p className={styles.formError}>{createError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton} disabled={createLoading}>
                  {createLoading ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
