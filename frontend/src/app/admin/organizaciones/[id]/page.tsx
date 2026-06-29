'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { organizacionesApi, cursosApi, usersApi } from '@/lib/api/client';
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

interface Miembro {
  user_id: string;
  email: string;
  full_name: string | null;
  rol: string;
  rol_org: string;
  estado: string;
}

// Estado de la cuenta del miembro: distingue al supervisor recién creado que aún
// no activa su cuenta (pendiente_activacion) de uno activo o suspendido.
function EstadoMiembroBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    activo: { label: 'Activo', cls: styles.estadoActivo },
    pendiente_activacion: { label: 'Pendiente de activación', cls: styles.estadoPendiente },
    suspendido: { label: 'Suspendido', cls: styles.estadoSuspendido },
  };
  const { label, cls } = map[estado] ?? { label: estado, cls: styles.estadoPendiente };
  return <span className={`${styles.estadoBadge} ${cls}`}>{label}</span>;
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
  rol: string;
  estado: string;
}

type Tab = 'datos' | 'miembros' | 'licencias' | 'supervisor';

export default function OrganizacionDetallePage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params?.id as string;

  const [tab, setTab] = useState<Tab>('datos');
  const { flags } = useFeatureFlags();
  // Beta: una org tiene un solo supervisor (creado al alta de la org). El tab para
  // crear supervisores extra solo aparece si el flag 'multiples_supervisores' está ON.
  const multiplesSupervisores = !!flags['multiples_supervisores'];
  const tabs: Tab[] = ['datos', 'miembros', 'licencias', ...(multiplesSupervisores ? ['supervisor' as Tab] : [])];
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

  // Borrado de la organización (destructivo, con confirmación)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
      // Quitar al supervisor (ADMIN_ORG) deja la org sin supervisor y al supervisor
      // huérfano → invalida el Router Cache para que la lista de Organizaciones
      // muestre el panel "supervisores sin organización" al volver (sin recargar).
      router.refresh();
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
        telefono: supForm.telefono || undefined,
      });
      setSupMsg('Supervisor creado. Se envió el correo de activación.');
      setSupForm({ email: '', full_name: '', password: '', telefono: '' });
      // La org ya tiene supervisor → refresca la lista de Organizaciones al volver.
      router.refresh();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setSupError(apiErr?.detail || 'Error al crear supervisor');
    } finally {
      setSupLoading(false);
    }
  };

  const handleDeleteOrg = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await organizacionesApi.delete(orgId);
      router.push('/admin/organizaciones');
    } catch (e) {
      logError('organizacion.delete', e);
      setDeleteError((e as { detail?: string })?.detail || 'No se pudo eliminar la organización.');
      setDeleting(false);
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className={styles.backButton} onClick={() => router.push('/admin/organizaciones')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button
            onClick={() => { setDeleteError(''); setDeleteConfirmText(''); setShowDeleteModal(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.1rem', background: '#b91c1c', color: '#fff',
              border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            Eliminar organización
          </button>
        </div>
      </div>

      <section className={styles.mainContent}>
        <div className={styles.tabsRow}>
          {tabs.map((t) => (
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
                  // Solo empleados (estudiantes) YA ACTIVADOS: la pestaña de Miembros
                  // no debe asignar supervisores/admins (se gestionan aparte) ni
                  // cuentas que aún no se activaron (pendientes de activación).
                  .filter((u) => !miembrosIds.has(u.id) && u.rol === 'estudiante' && u.estado === 'activo')
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
                  <th>Estado</th>
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
                    <td><EstadoMiembroBadge estado={m.estado} /></td>
                    <td>{m.rol}</td>
                    <td>{m.rol_org}</td>
                    <td>
                      <button className={styles.deleteButton} onClick={() => handleQuitarMiembro(m.user_id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={styles.emptyState}>Sin miembros</td></tr>
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
              Crea un usuario con rol SUPERVISOR asignado a esta organización. Recibirá
              un correo para activar su cuenta y establecer su contraseña.
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

      {showDeleteModal && (
        <div
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '0.9375rem', padding: '1.75rem',
              maxWidth: '480px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.0625rem', fontWeight: 700, color: '#b91c1c' }}>
              Eliminar &ldquo;{org.nombre}&rdquo;
            </h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              Esta acción es <strong>permanente</strong>. Se eliminarán:
            </p>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <li>La organización y sus <strong>licencias de cursos</strong>.</li>
              <li>La <strong>cuenta del supervisor</strong> (punto de contacto).</li>
              <li>Las solicitudes de cursos de la organización.</li>
              <li>El acceso de los alumnos a los cursos que cubría <strong>solo</strong> esta organización (sus inscripciones se cancelan). Las cuentas de los alumnos NO se borran.</li>
            </ul>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
              Para confirmar, escribe el nombre de la organización: <strong>{org.nombre}</strong>
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className={styles.formInput}
              placeholder={org.nombre}
              autoFocus
            />
            {deleteError && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1.1rem', border: '1.5px solid #e2e8f0', borderRadius: '0.5rem',
                  background: '#fff', color: 'var(--color-text-secondary)', fontWeight: 600,
                  fontSize: '0.875rem', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteOrg}
                disabled={deleting || deleteConfirmText.trim() !== org.nombre}
                style={{
                  padding: '0.5rem 1.1rem', border: 'none', borderRadius: '0.5rem',
                  background: '#b91c1c', color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                  cursor: deleting || deleteConfirmText.trim() !== org.nombre ? 'not-allowed' : 'pointer',
                  opacity: deleting || deleteConfirmText.trim() !== org.nombre ? 0.5 : 1,
                }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
