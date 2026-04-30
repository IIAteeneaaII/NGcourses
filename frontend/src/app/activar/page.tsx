'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ActivarForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('El enlace no es válido. Contacta al administrador.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/users/activar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail: string = body.detail ?? '';
        if (detail === 'Token expirado') throw new Error('El enlace ha expirado. Contacta al administrador para que reenvíe la invitación.');
        if (detail === 'Token inválido') throw new Error('El enlace no es válido. Contacta al administrador.');
        throw new Error(detail || 'Error al activar la cuenta.');
      }

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1100px 700px at 12% 18%, rgba(61,193,204,.30) 0%, rgba(242,242,242,0) 60%), radial-gradient(900px 650px at 86% 22%, rgba(0,150,143,.20) 0%, rgba(242,242,242,0) 58%), linear-gradient(180deg, #ffffff 0%, #F2F2F2 100%)',
      display: 'grid',
      placeItems: 'center',
      padding: '28px 16px 70px',
    }}>
      <div style={{
        width: 'min(440px, 92%)',
        background: 'rgba(255,255,255,.86)',
        border: '1px solid rgba(0,150,143,.12)',
        borderRadius: '20px',
        boxShadow: '0 18px 55px rgba(11,27,43,.12)',
        padding: '36px',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="NextGen" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 900, fontSize: '16px', color: '#0B1B2B' }}>
            NEXT GEN <span style={{ fontWeight: 400 }}>Course</span>
          </span>
        </div>

        {done ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', background: '#ecfdf5',
              border: '1px solid #6ee7b7', borderRadius: '12px', marginBottom: '20px',
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#059669" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span style={{ color: '#065f46', fontSize: '14px', fontWeight: 600 }}>
                ¡Cuenta activada correctamente!
              </span>
            </div>
            <Link href="/" style={{ display: 'block', textAlign: 'center', padding: '13px 16px', borderRadius: '14px', fontWeight: 800, color: 'white', background: 'var(--color-accent-10)', textDecoration: 'none', fontSize: '1rem' }}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
              Activa tu cuenta
            </h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(11,27,43,.65)', fontSize: '15px' }}>
              Elige una contraseña para acceder a la plataforma.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'rgba(11,27,43,.78)' }}>Nueva contraseña</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px', background: 'white', border: '1px solid rgba(0,150,143,.16)', padding: '14px 16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="#0B1B2B" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M6 11h12v9H6v-9Z" stroke="#0B1B2B" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ border: 0, outline: 0, width: '100%', fontSize: '15px', background: 'transparent', color: '#0B1B2B' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 0, display: 'flex', color: '#0B1B2B' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      {showPassword && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>}
                    </svg>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'rgba(11,27,43,.78)' }}>Confirmar contraseña</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px', background: 'white', border: `1px solid ${confirm && confirm !== password ? 'rgba(239,68,68,.5)' : 'rgba(0,150,143,.16)'}`, padding: '14px 16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="#0B1B2B" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M6 11h12v9H6v-9Z" stroke="#0B1B2B" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    style={{ border: 0, outline: 0, width: '100%', fontSize: '15px', background: 'transparent', color: '#0B1B2B' }}
                  />
                </div>
              </div>

              {error && (
                <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                style={{ border: 0, width: '100%', padding: '14px 16px', borderRadius: '14px', fontWeight: 800, color: 'white', background: 'var(--color-accent-10)', cursor: (loading || !token) ? 'not-allowed' : 'pointer', fontSize: '1.0625rem', opacity: (loading || !token) ? 0.7 : 1 }}
              >
                {loading ? 'Activando...' : 'Activar cuenta'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: '46px', background: 'linear-gradient(90deg, #b2e8e6 0%, #3DC1CC 45%, #00968f 75%, #006b66 100%)', opacity: 0.95 }} />
    </div>
  );
}

export default function ActivarPage() {
  return (
    <Suspense>
      <ActivarForm />
    </Suspense>
  );
}
