'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { organizacionesApi, cursosApi, usersApi } from '@/lib/api/client';
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

interface Miembro {
  user_id: string;
  email: string;
  full_name: string | null;
  rol: string;
  rol_org: string;
}

interface Licencia {
  curso_id: string;
  curso_titulo: string;
  activa: boolean;
  creado_en: string;
}

interface Curso {
  id: string;
  titulo: string;
}

interface UserLite {
  id: string;
  email: string;
  full_name: string | null;
}

type Tab = 'datos' | 'miembros' | 'licencias' | 'supervisor';

export default function OrganizacionDetallePage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params?.id as string;

  const [tab, setTab] = useState<Tab>('datos');
  const [org, setOrg] = useState<Organizacion | null>(null);
  const [loading, setLoading] = useState(true);

  const [formDatos, setFormDatos] = useState<Organizacion | null>(null);
  const [savingDatos, setSavingDatos] = useState(false);
  const [datosMsg, setDatosMsg] = useState('');

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [cursosDisponibles, setCursosDisponibles] = useState<Curso[]>([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<UserLite[]>([]);

  const [cursoAAsignar, setCursoAAsignar] = useState('');
  const [userAAsignar, setUserAAsignar] = useState('');

  const [supForm, setSupForm] = useState({ email: '', full_name: '', password: '', telefono: '' });
  const [supLoading, setSupLoading] = useState(false);
  const [supMsg, setSupMsg] = useState('');
  const [supError, setSupError] = useState('');

  const loadOrg = useCallback(async () => {
    setLoading(true);
    try {
      const o = await organizacionesApi.get(orgId) as Organizacion;
      setOrg(o);
      setFormDatos(o);
    } catch (e) {
      logError('organizacion.get', e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadMiembros = useCallback(async () => {
    try {
      const data = await organizacionesApi.listMiembros(orgId) as Miembro[];
      setMiembros(data);
    } catch (e) {
      logError('organizacion.miembros', e);
    }
  }, [orgId]);

  const loadLicencias = useCallback(async () => {
    try {
      const data = await organizacionesApi.listLicencias(orgId) as Licencia[];
      setLicencias(data);
    } catch (e) {
      logError('organizacion.licencias', e);
    }
  }, [orgId]);

  const loadCursos = useCallback(async () => {
    try {
      const resp = await cursosApi.list({ limit: 200 }) as { data: Curso[] };
      setCursosDisponibles(resp.data);
    } catch (e) {
      logError('cursos.list', e);
    }
  }, []);

  const loadUsuarios = useCallback(async () => {
    try {
      const resp = await usersApi.list({ limit: 500 }) as { data: UserLite[] };
      setUsuariosDisponibles(resp.data);
    } catch (e) {
      logError('users.list', e);
    }
  }, []);

  useEffect(() => {
    if (orgId) loadOrg();
  }, [orgId, loadOrg]);

  useEffect(() => {
    if (tab === 'miembros') { loadMiembros(); loadUsuarios(); }
    if (tab === 'licencias') { loadLicencias(); loadCursos(); }
  }, [tab, loadMiembros, loadLicencias, loadCursos, loadUsuarios]);

  const handleSaveDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDatos) return;
    setSavingDatos(true);
    setDatosMsg('');
    try {
      await organizacionesApi.update(orgId, {
        nombre: formDatos.nombre,
        email_contacto: formDatos.email_contacto || null,
        telefono_contacto: formDatos.telefono_contacto || null,
        plan_de_cursos: formDatos.plan_de_cursos || null,
        fecha_compra: formDatos.fecha_compra || null,
      });
      setDatosMsg('Guardado');
      loadOrg();
    } catch (e) {
      logError('organizacion.update', e);
      setDatosMsg('Error al guardar');
    } finally {
      setSavingDatos(false);
    }
  };

  const handleAsignarLicencia = async () => {
    if (!cursoAAsignar) return;
    try {
      await organizacionesApi.asignarLicencia(orgId, cursoAAsignar);
      setCursoAAsignar('');
      loadLicencias();
    } catch (e) {
      logError('organizacion.asignarLicencia', e);
    }
  };

  const handleQuitarLicencia = async (curso_id: string) => {
    try {
      await organizacionesApi.quitarLicencia(orgId, curso_id);
      loadLicencias();
    } catch (e) {
      logError('organizacion.quitarLicencia', e);
    }
  };

  const handleAsignarMiembro = async () => {
    if (!userAAsignar) return;
    try {
      await organizacionesApi.asignarMiembro(orgId, { user_id: userAAsignar });
      setUserAAsignar('');
      loadMiembros();
    } catch (e) {
      logError('organizacion.asignarMiembro', e);
    }
  };

  const handleQuitarMiembro = async (user_id: string) => {
    try {
      await organizacionesApi.quitarMiembro(orgId, user_id);
      loadMiembros();
    } catch (e) {
      logError('organizacion.quitarMiembro', e);
    }
  };

  const handleCrearSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupLoading(true);
    setSupError('');
    setSupMsg('');
    try {
      await organizacionesApi.crearSupervisor(orgId, {
        email: supForm.email,
        full_name: supForm.full_name,
        password: supForm.password,
        telefono: supForm.telefono || undefined,
      });
      setSupMsg('Supervisor creado');
      setSupForm({ email: '', full_name: '', password: '', telefono: '' });
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setSupError(apiErr?.detail || 'Error al crear supervisor');
    } finally {
      setSupLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  if (loading || !org || !formDatos) {
    return <div className={styles.pageContainer}><p>Cargando...</p></div>;
  }

  const licenciadosIds = new Set(licencias.map((l) => l.curso_id));
  const miembrosIds = new Set(miembros.map((m) => m.user_id));

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.pageTitle}>{org.nombre}</h1>
          <p className={styles.pageSubtitle}>Detalle y gestión de la organización</p>
        </div>
        <button className={styles.backButton} onClick={() => router.push('/admin/organizaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
      </div>

      <section className={styles.mainContent}>
        <div className={styles.tabsRow}>
          {(['datos', 'miembros', 'licencias', 'supervisor'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`${styles.tabButton} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'datos' && 'Datos'}
              {t === 'miembros' && 'Miembros'}
              {t === 'licencias' && 'Licencias'}
              {t === 'supervisor' && 'Crear supervisor'}
            </button>
          ))}
        </div>

        {tab === 'datos' && (
          <form onSubmit={handleSaveDatos} className={styles.formColumn}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nombre</label>
              <input type="text" required className={styles.formInput}
                value={formDatos.nombre}
                onChange={(e) => setFormDatos({ ...formDatos, nombre: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email de contacto</label>
              <input type="email" className={styles.formInput}
                value={formDatos.email_contacto || ''}
                onChange={(e) => setFormDatos({ ...formDatos, email_contacto: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Teléfono</label>
              <input type="tel" className={styles.formInput}
                value={formDatos.telefono_contacto || ''}
                onChange={(e) => setFormDatos({ ...formDatos, telefono_contacto: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Plan de cursos</label>
              <textarea rows={3} className={styles.formInput}
                value={formDatos.plan_de_cursos || ''}
                onChange={(e) => setFormDatos({ ...formDatos, plan_de_cursos: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fecha de compra</label>
              <input type="date" className={styles.formInput}
                value={formDatos.fecha_compra ? formatDate(formDatos.fecha_compra) : ''}
                onChange={(e) => setFormDatos({ ...formDatos, fecha_compra: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            {datosMsg && <p className={styles.formMsg}>{datosMsg}</p>}
            <div>
              <button type="submit" className={styles.submitButton} disabled={savingDatos}>
                {savingDatos ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}

        {tab === 'miembros' && (
          <div>
            <div className={styles.assignRow}>
              <select className={styles.formInput} value={userAAsignar} onChange={(e) => setUserAAsignar(e.target.value)}>
                <option value="">-- Seleccionar usuario --</option>
                {usuariosDisponibles
                  .filter((u) => !miembrosIds.has(u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
                  ))}
              </select>
              <button className={styles.createButton} onClick={handleAsignarMiembro} disabled={!userAAsignar}>
                Asignar
              </button>
            </div>
            <table className={styles.usersTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol global</th>
                  <th>Rol en org</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {miembros.length > 0 ? miembros.map((m) => (
                  <tr key={m.user_id}>
                    <td>{m.full_name || '—'}</td>
                    <td>{m.email}</td>
                    <td>{m.rol}</td>
                    <td>{m.rol_org}</td>
                    <td>
                      <button className={styles.deleteButton} onClick={() => handleQuitarMiembro(m.user_id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className={styles.emptyState}>Sin miembros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'licencias' && (
          <div>
            <div className={styles.assignRow}>
              <select className={styles.formInput} value={cursoAAsignar} onChange={(e) => setCursoAAsignar(e.target.value)}>
                <option value="">-- Seleccionar curso --</option>
                {cursosDisponibles
                  .filter((c) => !licenciadosIds.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.titulo}</option>
                  ))}
              </select>
              <button className={styles.createButton} onClick={handleAsignarLicencia} disabled={!cursoAAsignar}>
                Asignar
              </button>
            </div>
            <table className={styles.usersTable}>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Estado</th>
                  <th>Asignado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {licencias.length > 0 ? licencias.map((l) => (
                  <tr key={l.curso_id}>
                    <td>{l.curso_titulo}</td>
                    <td>{l.activa ? 'Activa' : 'Inactiva'}</td>
                    <td>{new Date(l.creado_en).toLocaleDateString('es-MX')}</td>
                    <td>
                      <button className={styles.deleteButton} onClick={() => handleQuitarLicencia(l.curso_id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className={styles.emptyState}>Sin licencias asignadas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'supervisor' && (
          <form onSubmit={handleCrearSupervisor} className={styles.formColumn}>
            <p className={styles.helpText}>
              Crea un usuario con rol SUPERVISOR asignado a esta organización.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nombre completo *</label>
              <input type="text" required className={styles.formInput}
                value={supForm.full_name}
                onChange={(e) => setSupForm({ ...supForm, full_name: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email *</label>
              <input type="email" required className={styles.formInput}
                value={supForm.email}
                onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Contraseña * (mín. 8 caracteres)</label>
              <input type="password" required minLength={8} className={styles.formInput}
                value={supForm.password}
                onChange={(e) => setSupForm({ ...supForm, password: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Teléfono</label>
              <input type="tel" className={styles.formInput}
                value={supForm.telefono}
                onChange={(e) => setSupForm({ ...supForm, telefono: e.target.value })} />
            </div>
            {supError && <p className={styles.formError}>{supError}</p>}
            {supMsg && <p className={styles.formMsg}>{supMsg}</p>}
            <div>
              <button type="submit" className={styles.submitButton} disabled={supLoading}>
                {supLoading ? 'Creando...' : 'Crear supervisor'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
