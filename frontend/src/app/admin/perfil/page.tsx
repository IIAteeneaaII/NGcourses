'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, cursosApi, usersApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  telefono: string | null;
  rol: string;
}

interface ApiCursosResp {
  count: number;
  data: unknown[];
}

interface ApiUsersResp {
  count: number;
  data: unknown[];
}

export default function PerfilAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [stats, setStats] = useState({ coursesCreated: 0, activeStudents: 0 });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', telefono: '' });
  const [pwdForm, setPwdForm] = useState({ current: '', nueva: '', confirmar: '' });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdOk, setPwdOk] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRaw, cursosResp, usersResp] = await Promise.all([
          authApi.me() as Promise<ApiUser>,
          cursosApi.list({ limit: 1 }) as Promise<ApiCursosResp>,
          usersApi.list({ limit: 1 }) as Promise<ApiUsersResp>,
        ]);
        setUser(userRaw);
        setStats({
          coursesCreated: cursosResp.count ?? 0,
          activeStudents: usersResp.count ?? 0,
        });
        const stored = localStorage.getItem(`avatar_${userRaw.id}`);
        if (stored) setAvatarUrl(stored);
      } catch {
        // fallo silencioso
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleOpenEdit = () => {
    if (!user) return;
    setEditForm({ email: user.email, telefono: user.telefono ?? '' });
    setPwdForm({ current: '', nueva: '', confirmar: '' });
    setSaveError('');
    setPwdError('');
    setPwdOk('');
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await usersApi.updateMe({
        email: editForm.email,
        telefono: editForm.telefono || null,
      }) as ApiUser;
      setUser(updated);
      setEditOpen(false);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setSaveError(apiErr?.detail || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdOk('');
    if (!pwdForm.nueva || !pwdForm.current) { setPwdError('Completa todos los campos.'); return; }
    if (pwdForm.nueva !== pwdForm.confirmar) { setPwdError('Las contraseñas no coinciden.'); return; }
    if (pwdForm.nueva.length < 8) { setPwdError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setSavingPwd(true);
    try {
      await usersApi.changePassword({ current_password: pwdForm.current, new_password: pwdForm.nueva });
      setPwdOk('Contraseña actualizada correctamente.');
      setPwdForm({ current: '', nueva: '', confirmar: '' });
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setPwdError(apiErr?.detail || 'Error al cambiar la contraseña.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarUrl(dataUrl);
      localStorage.setItem(`avatar_${user.id}`, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  const nombre = user?.full_name || user?.email?.split('@')[0] || 'Admin';
  const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || 'A';

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backButton} onClick={() => router.push('/admin')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Volver a opciones
      </button>

      <div className={styles.profileContainer}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrapper}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={nombre} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarLarge}>{initials}</div>
            )}
            <button
              className={styles.changeAvatarBtn}
              onClick={() => fileRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{nombre}</h1>
            <p className={styles.profileEmail}>{user?.email ?? ''}</p>
            <button className={styles.editProfileBtn} onClick={handleOpenEdit}>
              Editar perfil
            </button>
          </div>
        </div>

        <div className={styles.profileSections}>
          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Estadisticas</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.coursesCreated}</div>
                <div className={styles.statLabel}>Cursos en plataforma</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.activeStudents}</div>
                <div className={styles.statLabel}>Usuarios registrados</div>
              </div>
            </div>
          </div>

          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Informacion Personal</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre Completo</span>
                <div className={styles.infoValue}>{nombre}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Correo Electronico</span>
                <div className={styles.infoValue}>{user?.email ?? ''}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rol</span>
                <div className={styles.infoValue}>{user?.rol ?? 'administrador'}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefono</span>
                <div className={styles.infoValue}>{user?.telefono || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <div className={styles.modalOverlay} onClick={() => setEditOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar perfil</h2>
              <button className={styles.modalClose} onClick={() => setEditOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Correo electrónico *</label>
                <input
                  type="email"
                  required
                  className={styles.formInput}
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teléfono</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  value={editForm.telefono}
                  onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+52 55 0000 0000"
                />
              </div>
              {saveError && <p className={styles.formError}>{saveError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>

            <div className={styles.modalDivider} />
            <div className={styles.pwdSection}>
              <h3 className={styles.pwdTitle}>Cambiar contraseña</h3>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contraseña actual</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={pwdForm.current}
                  onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nueva contraseña</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={pwdForm.nueva}
                  onChange={(e) => setPwdForm((f) => ({ ...f, nueva: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirmar nueva contraseña</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={pwdForm.confirmar}
                  onChange={(e) => setPwdForm((f) => ({ ...f, confirmar: e.target.value }))}
                />
              </div>
              {pwdError && <p className={styles.formError}>{pwdError}</p>}
              {pwdOk && <p className={styles.formSuccess}>{pwdOk}</p>}
              <button
                className={styles.saveBtn}
                onClick={handleChangePassword}
                disabled={savingPwd}
                style={{ marginTop: '0.5rem' }}
              >
                {savingPwd ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
