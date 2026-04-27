'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/password-recovery/${encodeURIComponent(email)}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 404 = email no registrado, lo tratamos igual para no revelar existencia
        if (res.status === 404) {
          setSent(true);
          return;
        }
        throw new Error(body.detail ?? 'Error al enviar el correo');
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
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
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="NextGen" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 900, fontSize: '16px', color: '#0B1B2B', letterSpacing: '-0.2px' }}>
            NEXT GEN <span style={{ fontWeight: 400 }}>Course</span>
          </span>
        </div>

        {sent ? (
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
              Revisa tu correo
            </h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(11,27,43,.65)', fontSize: '15px', lineHeight: 1.5 }}>
              Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <Link href="/" style={{ color: '#00968f', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
              ¿Olvidaste tu contraseña?
            </h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(11,27,43,.65)', fontSize: '15px' }}>
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'rgba(11,27,43,.78)' }}>Correo</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  borderRadius: '14px', background: 'white',
                  border: '1px solid rgba(0,150,143,.16)',
                  padding: '14px 16px',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
                    <path d="M4 6h16v12H4V6Z" stroke="#0B1B2B" strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d="m4 7 8 6 8-6" stroke="#0B1B2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="email"
                    placeholder="tu@usuario.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                disabled={loading}
                style={{
                  border: 0, width: '100%', padding: '14px 16px', borderRadius: '14px',
                  fontWeight: 800, color: 'white', background: 'var(--color-accent-10)',
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.0625rem',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link href="/" style={{ color: '#00968f', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                ← Volver al inicio de sesión
              </Link>
            </div>
          </>
        )}
      </div>

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: '46px',
        background: 'linear-gradient(90deg, #b2e8e6 0%, #3DC1CC 45%, #00968f 75%, #006b66 100%)',
        opacity: 0.95,
      }} />
    </div>
  );
}
