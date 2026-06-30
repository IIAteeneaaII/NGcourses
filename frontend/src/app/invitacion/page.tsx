'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { invitacionesApi } from '@/lib/api/client';

import styles from './page.module.css';

interface CanjearResponse {
  inscripcion_id: string;
  curso_id: string;
  curso_titulo: string;
  email: string;
  usuario_creado: boolean;
  requiere_activacion: boolean;
}

type Estado =
  | { type: 'loading' }
  | { type: 'success'; data: CanjearResponse }
  | { type: 'used' }
  | { type: 'expired' }
  | { type: 'invalid' }
  | { type: 'no_token' };

// ── Iconos SVG ────────────────────────────────────────────────────────────────

function IconSuccess() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ── Contenido ─────────────────────────────────────────────────────────────────

function InvitacionContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ type: 'loading' });

  useEffect(() => {
    const hash = window.location.hash;
    const t = hash.startsWith('#token=') ? decodeURIComponent(hash.slice(7)) : '';
    setToken(t);
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) { setEstado({ type: 'no_token' }); return; }
    invitacionesApi.canjear(token)
      .then((res) => setEstado({ type: 'success', data: res as CanjearResponse }))
      .catch((err: unknown) => {
        const s = (err as { status?: number })?.status ?? 0;
        setEstado(s === 409 ? { type: 'used' } : s === 410 ? { type: 'expired' } : { type: 'invalid' });
      });
  }, [token]);

  if (estado.type === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.spinnerWrap}>
            <span className={styles.spinner} />
            <span className={styles.spinnerText}>Verificando invitación...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Éxito ─────────────────────────────────────────────────────────────────
  if (estado.type === 'success') {
    const { data } = estado;
    // requiere_activacion cubre cuenta nueva y cuenta pendiente de activar
    // (invitada antes pero nunca activada): en ambos casos llega un correo.
    const necesitaActivar = data.requiere_activacion;

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.brand}>NGcourses</p>
            <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>
              <IconSuccess />
            </div>
          </div>
          <div className={styles.cardBody}>
            <h1 className={styles.title}>Inscripción exitosa</h1>
            <p className={styles.subtitle}>Tienes acceso al curso:</p>
            <span className={styles.coursePill}>{data.curso_titulo}</span>

            <div className={styles.loginPrompt}>
              {necesitaActivar ? (
                <p className={styles.loginPromptText}>
                  Te enviamos un correo a <strong>{data.email}</strong> para
                  <strong> activar tu cuenta y establecer tu contraseña</strong>:
                  ábrelo, crea tu contraseña (eso activa la cuenta) y después inicia sesión
                  para acceder al curso.
                </p>
              ) : (
                <p className={styles.loginPromptText}>
                  Tu cuenta ya existe. Inicia sesión con <strong>{data.email}</strong> para
                  acceder al curso.
                </p>
              )}
              <button
                className={styles.primaryBtn}
                onClick={() => router.push('/')}
              >
                Ir al inicio de sesión →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Estados de error ──────────────────────────────────────────────────────
  const errorMap = {
    used:     { icon: <IconLock />,  wrap: styles.iconWrapWarning, title: 'Enlace ya utilizado',  msg: 'Este enlace ya fue canjeado anteriormente y no puede usarse de nuevo. Si ya tienes cuenta, inicia sesión para acceder al curso.' },
    expired:  { icon: <IconClock />, wrap: styles.iconWrapWarning, title: 'Enlace expirado',      msg: 'Este enlace ha expirado. Solicita al administrador o supervisor una nueva invitación.' },
    invalid:  { icon: <IconX />,     wrap: styles.iconWrapError,   title: 'Enlace no válido',     msg: 'Este enlace de invitación no existe o es incorrecto.' },
    no_token: { icon: <IconX />,     wrap: styles.iconWrapError,   title: 'Enlace no válido',     msg: 'No se proporcionó un token de invitación en la URL.' },
  };

  const err = errorMap[estado.type as keyof typeof errorMap];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.brand}>NGcourses</p>
          <div className={`${styles.iconWrap} ${err.wrap}`}>
            {err.icon}
          </div>
        </div>
        <div className={styles.cardBody}>
          <h1 className={styles.title}>{err.title}</h1>
          <p className={styles.subtitle}>{err.msg}</p>
          <div className={styles.loginPrompt}>
            <button
              className={styles.primaryBtn}
              onClick={() => router.push('/')}
            >
              Ir al inicio de sesión →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitacionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Cargando...</span>
      </div>
    }>
      <InvitacionContent />
    </Suspense>
  );
}
