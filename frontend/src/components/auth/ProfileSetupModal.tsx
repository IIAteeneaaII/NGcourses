'use client';

import React, { useState } from 'react';
import { usersApi } from '@/lib/api/client';

interface Props {
  currentEmail: string;
  onComplete: (fullName: string) => void;
}

export default function ProfileSetupModal({ currentEmail, onComplete }: Props) {
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!currentPassword) {
      setError('Ingresa tu contraseña actual.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await usersApi.updateMe({ full_name: fullName.trim() });
      await usersApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      onComplete(fullName.trim());
    } catch {
      setError('Contraseña actual incorrecta o error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '1rem', padding: '2rem',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 0.5rem', color: '#004777', fontSize: '1.4rem' }}>
          Completa tu perfil
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
          Antes de continuar, configura tu nombre y una contraseña segura.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              Nombre completo *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellido"
              required
              style={{
                width: '100%', padding: '0.6rem 0.75rem',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.95rem', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              Contraseña actual *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={`Si tu cuenta es nueva, ingresa tu correo: ${currentEmail}`}
              required
              style={{
                width: '100%', padding: '0.6rem 0.75rem',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.95rem', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              Nueva contraseña *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              style={{
                width: '100%', padding: '0.6rem 0.75rem',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.95rem', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              Confirmar contraseña *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              style={{
                width: '100%', padding: '0.6rem 0.75rem',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.95rem', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem',
              background: loading ? '#9ca3af' : '#f97316',
              color: '#fff', border: 'none', borderRadius: '0.5rem',
              fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
