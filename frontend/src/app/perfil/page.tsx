'use client';

import React, { useEffect, useRef, useState } from 'react';
import ProfileContent from '@/components/profile/ProfileContent';
import { authApi, cursosApi, inscripcionesApi, usersApi } from '@/lib/api/client';
import type { UserProfile, UserStatistics, CourseInProgress } from '@/types/course';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  telefono: string | null;
  organizacion?: { id: string; nombre: string; rol_org: string } | null;
}

interface ApiInscripcion {
  id: string;
  curso_id: string;
  estado: 'activa' | 'finalizada' | 'cancelado';
  inscrito_en: string;
}

interface ApiInscripcionesResp {
  data: ApiInscripcion[];
  count: number;
}

interface ApiCurso {
  id: string;
  titulo: string;
  duracion_seg: number;
}

const EMPTY_PROFILE: UserProfile = {
  id: '',
  name: 'Usuario',
  initials: 'U',
  email: '',
  phone: '',
  department: '',
  position: '',
  registrationDate: '',
};

const EMPTY_STATS: UserStatistics = {
  coursesEnrolled: 0,
  coursesCompleted: 0,
  totalTime: '0h',
};

export default function PerfilPage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [userId, setUserId] = useState<string>('');
  const [statistics, setStatistics] = useState<UserStatistics>(EMPTY_STATS);
  const [coursesInProgress, setCoursesInProgress] = useState<CourseInProgress[]>([]);
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
        const [userRaw, inscResp] = await Promise.all([
          authApi.me() as Promise<ApiUser>,
          inscripcionesApi.mis().catch(() => ({ data: [], count: 0 })) as Promise<ApiInscripcionesResp>,
        ]);

        const nombre = userRaw.full_name || userRaw.email.split('@')[0];
        const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');

        setUserId(userRaw.id);
        setProfile({
          id: userRaw.id,
          name: nombre,
          initials: initials || 'U',
          email: userRaw.email,
          phone: userRaw.telefono || '',
          department: '',
          position: '',
          registrationDate: '',
          organizacion: userRaw.organizacion || null,
        });

        const stored = localStorage.getItem(`avatar_${userRaw.id}`);
        if (stored) setAvatarUrl(stored);

        const inscripciones = inscResp.data;
        const completed = inscripciones.filter((i) => i.estado === 'finalizada').length;
        const activasRaw = inscripciones.filter((i) => i.estado === 'activa').slice(0, 5);
        const cursoDetails = await Promise.allSettled(
          activasRaw.map((i) => cursosApi.get(i.curso_id) as Promise<ApiCurso>)
        );

        const inProgress: CourseInProgress[] = activasRaw.map((insc, idx) => {
          const res = cursoDetails[idx];
          const titulo = res.status === 'fulfilled' ? res.value.titulo : 'Curso';
          return { id: insc.curso_id, title: titulo, progress: 0, order: idx + 1 };
        });

        const totalSeg = cursoDetails.reduce((acc, res) => {
          return acc + (res.status === 'fulfilled' ? (res.value.duracion_seg ?? 0) : 0);
        }, 0);

        setCoursesInProgress(inProgress);
        setStatistics({
          coursesEnrolled: inscripciones.length,
          coursesCompleted: completed,
          totalTime: `${Math.round(totalSeg / 3600)}h`,
        });
      } catch {
        // Fallo silencioso
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleOpenEdit = () => {
    setEditForm({ email: profile.email, telefono: profile.phone });
    setPwdForm({ current: '', nueva: '', confirmar: '' });
    setSaveError('');
    setPwdError('');
    setPwdOk('');
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const updated = await usersApi.updateMe({
        email: editForm.email,
        telefono: editForm.telefono || null,
      }) as ApiUser;
      const nombre = updated.full_name || updated.email.split('@')[0];
      const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
      setProfile((p) => ({ ...p, email: updated.email, phone: updated.telefono || '', name: nombre, initials: initials || 'U' }));
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
    if (!file || !userId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarUrl(dataUrl);
      localStorage.setItem(`avatar_${userId}`, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando perfil...</span>
      </div>
    );
  }

  return (
    <>
      <ProfileContent
        profile={profile}
        statistics={statistics}
        coursesInProgress={coursesInProgress}
        avatarUrl={avatarUrl}
        onEditClick={handleOpenEdit}
        onAvatarClick={() => fileRef.current?.click()}
      />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

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
                <input type="password" className={styles.formInput} value={pwdForm.current}
                  onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nueva contraseña</label>
                <input type="password" className={styles.formInput} value={pwdForm.nueva}
                  onChange={(e) => setPwdForm((f) => ({ ...f, nueva: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirmar nueva contraseña</label>
                <input type="password" className={styles.formInput} value={pwdForm.confirmar}
                  onChange={(e) => setPwdForm((f) => ({ ...f, confirmar: e.target.value }))} />
              </div>
              {pwdError && <p className={styles.formError}>{pwdError}</p>}
              {pwdOk && <p className={styles.formSuccess}>{pwdOk}</p>}
              <button className={styles.saveBtn} onClick={handleChangePassword} disabled={savingPwd} style={{ marginTop: '0.5rem' }}>
                {savingPwd ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
