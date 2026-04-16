'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface SupervisorUser {
  id: string;
  email: string;
  full_name: string | null;
  telefono: string | null;
  is_active: boolean;
  rol_org: string;
  progreso_promedio: number;
  cursos_inscritos: number;
}

interface Curso {
  id: string;
  titulo: string;
}

export default function SupervisorUsuariosPage() {
  const [users, setUsers] = useState<SupervisorUser[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAlta, setShowAlta] = useState(false);
  const [altaForm, setAltaForm] = useState({ email: '', full_name: '', password: '', telefono: '' });
  const [altaLoading, setAltaLoading] = useState(false);
  const [altaError, setAltaError] = useState('');

  const [showInvitar, setShowInvitar] = useState(false);
  const [invitarForm, setInvitarForm] = useState({ email: '', curso_id: '' });
  const [invitarLoading, setInvitarLoading] = useState(false);
  const [invitarMsg, setInvitarMsg] = useState('');
  const [invitarError, setInvitarError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supervisorApi.usuarios() as SupervisorUser[];
      setUsers(data);
    } catch (e) {
      logError('supervisor.usuarios', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCursos = useCallback(async () => {
    try {
      const data = await supervisorApi.cursos() as Curso[];
      setCursos(data);
    } catch (e) {
      logError('supervisor.cursos', e);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadCursos();
  }, [loadUsers, loadCursos]);

  const handleAlta = async (e: React.FormEvent) => {
    e.preventDefault();
    setAltaLoading(true);
    setAltaError('');
    try {
      await supervisorApi.crearUsuario({
        email: altaForm.email,
        password: altaForm.password,
        full_name: altaForm.full_name || undefined,
        telefono: altaForm.telefono || undefined,
      });
      setShowAlta(false);
      setAltaForm({ email: '', full_name: '', password: '', telefono: '' });
      loadUsers();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setAltaError(apiErr?.detail || 'Error al crear el usuario');
    } finally {
      setAltaLoading(false);
    }
  };

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitarLoading(true);
    setInvitarError('');
    setInvitarMsg('');
    try {
      const result = await supervisorApi.invitar({
        curso_id: invitarForm.curso_id,
        emails: [invitarForm.email],
      }) as Array<{ email: string; estado: string; detalle?: string }>;
      const r = result[0];
      if (r?.estado === 'error') {
        setInvitarError(r.detalle || 'Error al enviar invitación');
      } else if (r?.estado === 'ya_inscrito') {
        setInvitarMsg('El usuario ya está inscrito en ese curso');
      } else {
        setInvitarMsg('Invitación enviada correctamente');
        setInvitarForm({ email: '', curso_id: '' });
      }
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setInvitarError(apiErr?.detail || 'Error al enviar invitación');
    } finally {
      setInvitarLoading(false);
    }
  };

  const handleQuitar = async (user_id: string) => {
    if (!confirm('¿Quitar este usuario de la organización?')) return;
    try {
      await supervisorApi.quitarUsuario(user_id);
      loadUsers();
    } catch (e) {
      logError('supervisor.quitarUsuario', e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Usuarios de tu organización</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => { setShowInvitar(true); setInvitarError(''); setInvitarMsg(''); }}>
            Invitar por email
          </button>
          <button className={styles.primaryBtn} onClick={() => { setShowAlta(true); setAltaError(''); }}>
            Dar de alta
          </button>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Progreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyState}>Cargando...</td></tr>
              ) : users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.statusText} ${u.is_active ? styles.active : styles.inactive}`}>
                        {u.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td>{Math.round(u.progreso_promedio)}%</td>
                    <td>
                      <button className={styles.deleteButton} onClick={() => handleQuitar(u.id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className={styles.emptyState}>Sin usuarios en tu organización</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAlta && (
        <div className={styles.modalOverlay} onClick={() => setShowAlta(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Dar de alta usuario</h2>
              <button className={styles.modalClose} onClick={() => setShowAlta(false)}>✕</button>
            </div>
            <form onSubmit={handleAlta} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre completo</label>
                <input type="text" className={styles.formInput}
                  value={altaForm.full_name}
                  onChange={(e) => setAltaForm({ ...altaForm, full_name: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
                <input type="email" required className={styles.formInput}
                  value={altaForm.email}
                  onChange={(e) => setAltaForm({ ...altaForm, email: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contraseña * (mín. 8 caracteres)</label>
                <input type="password" required minLength={8} className={styles.formInput}
                  value={altaForm.password}
                  onChange={(e) => setAltaForm({ ...altaForm, password: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teléfono</label>
                <input type="tel" className={styles.formInput}
                  value={altaForm.telefono}
                  onChange={(e) => setAltaForm({ ...altaForm, telefono: e.target.value })} />
              </div>
              {altaError && <p className={styles.formError}>{altaError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowAlta(false)}>Cancelar</button>
                <button type="submit" className={styles.submitButton} disabled={altaLoading}>
                  {altaLoading ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvitar && (
        <div className={styles.modalOverlay} onClick={() => setShowInvitar(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Invitar por email</h2>
              <button className={styles.modalClose} onClick={() => setShowInvitar(false)}>✕</button>
            </div>
            <form onSubmit={handleInvitar} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
                <input type="email" required className={styles.formInput}
                  value={invitarForm.email}
                  onChange={(e) => setInvitarForm({ ...invitarForm, email: e.target.value })}
                  placeholder="alumno@empresa.com" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Curso *</label>
                <select required className={styles.formInput}
                  value={invitarForm.curso_id}
                  onChange={(e) => setInvitarForm({ ...invitarForm, curso_id: e.target.value })}>
                  <option value="">-- Seleccionar curso --</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>{c.titulo}</option>
                  ))}
                </select>
              </div>
              {invitarError && <p className={styles.formError}>{invitarError}</p>}
              {invitarMsg && <p className={styles.formMsg}>{invitarMsg}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowInvitar(false)}>Cancelar</button>
                <button type="submit" className={styles.submitButton} disabled={invitarLoading}>
                  {invitarLoading ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
