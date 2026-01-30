'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LoginContent.module.css';

export default function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar autenticación con backend
    router.push('/cursos');
  };

  return (
    <div className={styles.container}>
      {/* Patrón de puntos decorativos */}
      <div className={styles.dots} aria-hidden="true" />

      <main className={styles.content}>
        {/* Panel izquierdo - Brand */}
        <section className={styles.leftPanel}>
          <div className={styles.brandContainer}>
            <div className={styles.brandIcon}>P</div>
            <div className={styles.brandText}>Plataforma interna</div>
          </div>

          <h1 className={styles.title}>
            Inicia sesión<br />
            y continúa aprendiendo
          </h1>

          <p className={styles.description}>
            Accede a tu plataforma de capacitación empresarial. Retoma tus cursos en progreso,
            descubre nuevas capacitaciones y desarrolla tus habilidades profesionales.
          </p>

          <div className={styles.features}>
            <span className={styles.featureTag}>Cursos empresariales</span>
            <span className={styles.featureTag}>Certificaciones</span>
            <span className={styles.featureTag}>Aprende a tu ritmo</span>
          </div>
        </section>

        {/* Panel derecho - Login Card */}
        <section className={styles.rightPanel}>
          <div className={styles.loginCard}>
            <h2 className={styles.loginTitle}>Bienvenido</h2>
            <p className={styles.loginSubtitle}>Ingresa tus credenciales para continuar.</p>

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
                <button type="button" className={styles.forgotPassword}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button type="submit" className={styles.submitButton}>
                Iniciar sesión
              </button>
            </form>

            <p className={styles.registerText}>
              ¿No tienes cuenta?{' '}
              <button type="button" className={styles.registerLink}>
                Regístrate aquí
              </button>
            </p>
          </div>
        </section>
      </main>

      {/* Barra inferior */}
      <div className={styles.bottomBar} aria-hidden="true" />
    </div>
  );
}
