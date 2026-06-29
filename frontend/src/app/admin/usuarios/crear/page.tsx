'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { organizacionesApi, usersApi } from '@/lib/api/client';
import { CreateUserSchema } from '@/schemas/user';

interface Organizacion {
  id: string;
  nombre: string;
}

export default function CrearUsuarioEmpresaPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', full_name: '', organizacion_id: '' });
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    organizacionesApi.list({ limit: 100 })
      .then((r) => setOrgs((r as { data: Organizacion[] }).data))
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoaded(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validation = CreateUserSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await usersApi.createEmpresa({
        email: form.email,
        full_name: form.full_name.trim(),
        organizacion_id: form.organizacion_id,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { detail?: unknown };
      const detail = apiErr?.detail;
      const msg = Array.isArray(detail)
        ? ((detail[0] as { msg?: string })?.msg ?? 'Error de validación')
        : (typeof detail === 'string' ? detail : 'Error al crear el usuario');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
    border: '1px solid rgba(0,150,143,.2)', outline: 'none', color: '#0B1B2B',
    background: '#fff', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: 'rgba(11,27,43,.7)', marginBottom: '6px', display: 'block',
  };

  return (
    <div style={{ padding: '32px', maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button
          onClick={() => router.push('/admin/usuarios')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00968f', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Usuarios
        </button>
        <span style={{ color: 'rgba(11,27,43,.3)' }}>/</span>
        <span style={{ fontSize: '14px', color: 'rgba(11,27,43,.6)' }}>Alta de empleado</span>
      </div>

      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
        Alta de empleado
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'rgba(11,27,43,.55)' }}>
        Crea un <strong>empleado (estudiante)</strong> y lo liga a una organización existente. El empleado
        recibirá un correo para activar su cuenta y establecer su contraseña.
        <br />
        Para dar de alta una <strong>empresa y su supervisor</strong>, usa{' '}
        <a href="/admin/organizaciones" style={{ color: '#00968f', fontWeight: 600 }}>Organizaciones</a>.
      </p>

      {!success && orgsLoaded && orgs.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', background: '#fffbeb',
          border: '1px solid #fcd34d', borderRadius: '12px', marginBottom: '20px',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="#b45309" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span style={{ fontSize: '13px', color: '#92400e' }}>
            Aún no hay organizaciones.{' '}
            <a href="/admin/organizaciones" style={{ color: '#b45309', fontWeight: 700 }}>Crea una empresa y su supervisor →</a>
          </span>
        </div>
      )}

      {success ? (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 18px', background: '#ecfdf5',
            border: '1px solid #6ee7b7', borderRadius: '12px', marginBottom: '20px',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#059669" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span style={{ color: '#065f46', fontSize: '14px', fontWeight: 600 }}>
              Usuario creado. Se envió el correo de activación.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => { setSuccess(false); setForm({ email: '', full_name: '', organizacion_id: '' }); }}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(0,150,143,.3)', background: 'white', color: '#00968f', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
            >
              Crear otro
            </button>
            <button
              onClick={() => router.push('/admin/usuarios')}
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#00968f', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
            >
              Ver usuarios
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={labelStyle}>Correo corporativo *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="empleado@empresa.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Nombre completo *</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Nombre Apellido"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Organización *</label>
            <select
              required
              value={form.organizacion_id}
              onChange={(e) => setForm((f) => ({ ...f, organizacion_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="" disabled>Selecciona una organización</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(11,27,43,.5)' }}>
              Un empleado siempre pertenece a una empresa. Si no aparece, créala en{' '}
              <a href="/admin/organizaciones" style={{ color: '#00968f', fontWeight: 600 }}>Organizaciones</a>.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => router.push('/admin/usuarios')}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(0,150,143,.3)', background: 'white', color: '#00968f', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.organizacion_id}
              style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#00968f', color: 'white', fontWeight: 700, cursor: (loading || !form.organizacion_id) ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: (loading || !form.organizacion_id) ? 0.7 : 1 }}
            >
              {loading ? 'Enviando...' : 'Crear y enviar correo'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
