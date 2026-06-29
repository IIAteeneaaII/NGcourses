'use client';

import React, { useState } from 'react';
import { usersApi } from '@/lib/api/client';
import { ProfileSetupSchema } from '@/schemas/profile';

interface Props {
  currentEmail: string;
  onComplete: (fullName: string) => void;
}

export default function ProfileSetupModal({ currentEmail, onComplete }: Props) {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validation = ProfileSetupSchema.safeParse({ fullName });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await usersApi.updateMe({ full_name: fullName.trim() });
      onComplete(fullName.trim());
    } catch {
      setError('No se pudo guardar tu nombre. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(11,27,43,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '36px',
        width: '100%', maxWidth: '440px',
        border: '1px solid rgba(0,150,143,.12)',
        boxShadow: '0 18px 55px rgba(11,27,43,.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="NextGen" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 900, fontSize: '15px', color: '#0B1B2B' }}>
            NextGen <span style={{ fontWeight: 400 }}>Course</span>
          </span>
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
          Completa tu perfil
        </h2>
        <p style={{ margin: '0 0 24px', color: 'rgba(11,27,43,.65)', fontSize: '15px' }}>
          Para terminar, dinos tu nombre. Así aparecerá en tus certificados.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'rgba(11,27,43,.78)' }}>Nombre completo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px', background: 'white', border: '1px solid rgba(0,150,143,.16)', padding: '14px 16px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
                <circle cx="12" cy="8" r="4" stroke="#0B1B2B" strokeWidth="1.8" />
                <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="#0B1B2B" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(''); }}
                placeholder="Tu nombre y apellido"
                required
                autoFocus
                style={{ border: 0, outline: 0, width: '100%', fontSize: '15px', background: 'transparent', color: '#0B1B2B' }}
              />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(11,27,43,.5)' }}>
            Cuenta: {currentEmail}
          </p>

          {error && (
            <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ border: 0, width: '100%', padding: '14px 16px', borderRadius: '14px', fontWeight: 800, color: 'white', background: 'var(--color-accent-10)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.0625rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
