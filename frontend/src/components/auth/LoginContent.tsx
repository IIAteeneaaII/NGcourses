'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LoginContent.module.css';
import { login } from '@/lib/auth';

const CAROUSEL_COURSES = [
  'Paquetería Excel',
  'Modelado 3D',
  'Capacitación Interna',
  'Fusionado de Fibra Óptica',
  'Ponchado de cable ethernet'
];

export default function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam === 'auth') setNotice('Debes iniciar sesión para acceder a esa página.');
    if (errorParam === 'role') setNotice('No tienes permisos para acceder a esa sección.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.is_superuser || user.rol === 'administrador') {
        router.push('/admin');
      } else if (user.rol === 'instructor') {
        router.push('/instructor');
      } else if (user.rol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/cursos');
      }
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Patrón de puntos decorativos */}
      <div className={styles.dots} aria-hidden="true" />

      <main className={styles.content}>
        {/* Panel izquierdo - Brand */}
        <section className={styles.leftPanel}>
          <div className={styles.brandContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icono_invertido.png" alt="NextGen" className={styles.brandIcon}/>
            <h1 className={styles.mainTitle}>
              <span className={styles.titleBold}>NEXT GEN</span>{' '}
              <span className={styles.titleLight}>Course</span>
            </h1>
          </div>

          <p className={styles.titleTagline}>
            Potencia tu carrera, domina lo que sigue.
          </p>
          <br />

          <p className={styles.description}>
            Accede a programas diseñados para profesionales que no se conforman con el promedio.
            Aprende a tu ritmo, certifícate y crece.
          </p>
          <br />

          <div className={styles.carouselWrapper}>
            <div className={styles.carouselTrack}>
              {[...CAROUSEL_COURSES, ...CAROUSEL_COURSES].map((curso, i) => (
                <span key={i} className={styles.carouselItem}>{curso}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Panel derecho - Login Card */}
        <section className={styles.rightPanel}>
          <div className={styles.loginCard}>
            <h2 className={styles.loginTitle}>Tu siguiente nivel te espera</h2>
            <p className={styles.loginSubtitle}>El conocimiento que transforma carreras, a tu ritmo.</p>

            {notice && (
              <div className={styles.notice}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Correo</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="tu@usuario.com"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Contraseña</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M6 11h12v9H6v-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                      <path d="M12 15v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      {showPassword && (
                        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.optionsRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Recordarme</span>
                </label>
              </div>

              {error && (
                <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>
                  {error}
                </p>
              )}

              <button type="submit" className={styles.submitButton} disabled={loading}>
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

          </div>
        </section>
      </main>

      {/* Barra inferior */}
      <div className={styles.bottomBar} aria-hidden="true" />
    </div>
  );
}
