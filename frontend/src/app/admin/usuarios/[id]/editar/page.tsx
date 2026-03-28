'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usersApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  rol: string;
  estado: 'activo' | 'suspendido';
  telefono?: string | null;
}

interface EditForm {
  full_name: string;
  email: string;
  rol: string;
  estado: string;
  telefono: string;
  password: string;
}

const ROLES: Record<string, string> = {
  administrador: 'Administrador',
  instructor: 'Instructor',
  estudiante: 'Estudiante',
  usuario_control: 'Control',
};

export default function EditarUsuarioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<EditForm>({
    full_name: '',
    email: '',
    rol: 'estudiante',
    estado: 'activo',
    telefono: '',
    password: '',
  });

  useEffect(() => {
    usersApi.get(id).then((data) => {
      const u = data as ApiUser;
      setForm({
        full_name: u.full_name ?? '',
        email: u.email,
        rol: u.rol,
        estado: u.estado,
        telefono: u.telefono ?? '',
        password: '',
      });
    }).catch(() => {
      setError('No se pudo cargar el usuario.');
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name || null,
        email: form.email,
        rol: form.rol,
        estado: form.estado,
        telefono: form.telefono || null,
      };
      if (form.password) payload.password = form.password;
      await usersApi.update(id, payload);
      setSuccess(true);
      setTimeout(() => router.push('/admin/usuarios'), 1200);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <span>Cargando usuario...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push('/admin/usuarios')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Usuarios
        </button>
        <h1 className={styles.title}>Editar usuario</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Nombre completo</label>
          <input
            type="text"
            className={styles.input}
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Nombre Apellido"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Email *</label>
          <input
            type="email"
            required
            className={styles.input}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="correo@ejemplo.com"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Teléfono</label>
          <input
            type="tel"
            className={styles.input}
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            placeholder="+52 55 0000 0000"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Rol</label>
            <select
              className={styles.input}
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              {Object.entries(ROLES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Estado</label>
            <select
              className={styles.input}
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
            >
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Nueva contraseña (dejar vacío para no cambiar)</label>
          <input
            type="password"
            minLength={8}
            className={styles.input}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.successMsg}>Cambios guardados. Redirigiendo...</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={() => router.push('/admin/usuarios')}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
