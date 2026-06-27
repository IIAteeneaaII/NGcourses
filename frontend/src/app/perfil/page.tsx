'use client';

import React, { useEffect, useRef, useState } from 'react';
import ProfileContent from '@/components/profile/ProfileContent';
import { authApi, cursosApi, inscripcionesApi, progresoApi, usersApi } from '@/lib/api/client';
import type { UserProfile, UserStatistics, CourseInProgress } from '@/types/course';
import styles from './page.module.css';
import { EditProfileSchema, ChangePasswordSchema } from '@/schemas/profile';

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
  const [editForm, setEditForm] = useState({ full_name: '', email: '', telefono: '' });
  const [rawFullName, setRawFullName] = useState('');
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
        setRawFullName(userRaw.full_name || '');
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

        // Progreso real por curso. Se AÍSLA por completo: si la consulta de progreso
        // falla o devuelve algo inesperado, NO debe vaciar la lista de cursos —
        // simplemente cae a 0%. (Antes un valor undefined tiraba el map y el catch
        // global dejaba "Cursos en progreso" vacío.)
        let progresoDetails: PromiseSettledResult<{ progreso_pct: number }>[] = [];
        try {
          progresoDetails = await Promise.allSettled(
            activasRaw.map((i) => progresoApi.curso(i.curso_id) as Promise<{ progreso_pct: number }>)
          );
        } catch {
          progresoDetails = [];
        }

        const inProgress: CourseInProgress[] = activasRaw.map((insc, idx) => {
          const res = cursoDetails[idx];
          const titulo = res.status === 'fulfilled' ? res.value.titulo : 'Curso';
          const pr = progresoDetails[idx];
          const progress = pr?.status === 'fulfilled' && pr.value
            ? Math.round(pr.value.progreso_pct ?? 0)
            : 0;
          return { id: insc.curso_id, title: titulo, progress, order: idx + 1 };
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
    setEditForm({ full_name: rawFullName, email: profile.email, telefono: profile.phone });
    setPwdForm({ current: '', nueva: '', confirmar: '' });
    setSaveError('');
    setPwdError('');
    setPwdOk('');
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError('');
    const validation = EditProfileSchema.safeParse(editForm);
    if (!validation.success) {
      setSaveError(validation.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        full_name: editForm.full_name.trim() || undefined,
        telefono: editForm.telefono || null,
      }) as ApiUser;
      const nombre = updated.full_name || updated.email.split('@')[0];
      const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
      setRawFullName(updated.full_name || '');
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
    const validation = ChangePasswordSchema.safeParse(pwdForm);
    if (!validation.success) {
      setPwdError(validation.error.issues[0].message);
      return;
    }
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
                <label className={styles.formLabel}>Nombre completo</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Tu nombre y apellido"
                />
                <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Se usa tal cual en tu certificado. Asegúrate de que sea tu nombre real.
                </small>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Correo electrónico</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={editForm.email}
                  disabled
                  style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  El correo no se puede cambiar: es el identificador de tu cuenta.
                </small>
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
