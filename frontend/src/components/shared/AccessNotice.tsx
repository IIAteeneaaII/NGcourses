'use client';

import { useEffect, useState } from 'react';

export function AccessNotice() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'role') setMessage('No tienes permisos para acceder a esa sección.');
    if (error === 'auth') setMessage('Debes iniciar sesión para acceder a esa página.');
  }, []);

  if (!message) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: '#fff3cd',
      borderBottom: '1px solid #f59e0b',
      color: '#92400e',
      fontSize: '0.875rem',
      fontWeight: 500,
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      {message}
    </div>
  );
}
