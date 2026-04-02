'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { invitacionesApi } from '@/lib/api/client';

import styles from './page.module.css';

interface CanjearResponse {
  inscripcion_id: string;
  curso_id: string;
  curso_titulo: string;
  email: string;
  usuario_creado: boolean;
  password_temporal: string | null;
}

type Estado =
  | { type: 'loading' }
  | { type: 'success'; data: CanjearResponse }
  | { type: 'already'; data: CanjearResponse }
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

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Contenido ─────────────────────────────────────────────────────────────────

function InvitacionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [estado, setEstado] = useState<Estado>({ type: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setEstado({ type: 'no_token' }); return; }
    invitacionesApi.canjear(token)
      .then((res) => setEstado({ type: 'success', data: res as CanjearResponse }))
      .catch((err: any) => {
        const s = err?.status ?? 0;
        setEstado(s === 409 ? { type: 'used' } : s === 410 ? { type: 'expired' } : { type: 'invalid' });
      });
  }, [token]);

  function copyPassword(pw: string) {
    navigator.clipboard.writeText(pw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

  // ── Éxito / ya inscrito ───────────────────────────────────────────────────
  if (estado.type === 'success' || estado.type === 'already') {
    const { data } = estado;
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
            <h1 className={styles.title}>
              {estado.type === 'success' ? 'Inscripcion exitosa' : 'Ya estas inscrito'}
            </h1>
            <p className={styles.subtitle}>
              {estado.type === 'success' ? 'Tienes acceso al curso:' : 'Ya tenias acceso a:'}
            </p>
            <span className={styles.coursePill}>{data.curso_titulo}</span>

            {data.usuario_creado && data.password_temporal && (
              <div className={styles.passwordBox}>
                <p className={styles.passwordLabel}>Tu nueva cuenta</p>
                <p className={styles.passwordEmail}>
                  Cuenta creada con <strong>{data.email}</strong>
                </p>
                <div className={styles.passwordValue}>
                  <span className={styles.passwordText}>{data.password_temporal}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyPassword(data.password_temporal!)}
                    title="Copiar contraseña"
                  >
                    <IconCopy />
                  </button>
                </div>
                <p className={styles.passwordWarning}>
                  {copied ? 'Copiado al portapapeles.' : 'Guarda esta contrasena — no se volvera a mostrar.'}
                </p>
              </div>
            )}

            <Link href={`/curso/${data.curso_id}`} className={styles.primaryBtn}>
              Acceder al curso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Estados de error ──────────────────────────────────────────────────────
  const errorMap = {
    used:     { icon: <IconLock />,  wrap: styles.iconWrapWarning, title: 'Enlace ya utilizado',  msg: 'Este enlace ya fue canjeado anteriormente y no puede usarse de nuevo.' },
    expired:  { icon: <IconClock />, wrap: styles.iconWrapWarning, title: 'Enlace expirado',      msg: 'Este enlace ha expirado. Solicita al administrador una nueva invitacion.' },
    invalid:  { icon: <IconX />,     wrap: styles.iconWrapError,   title: 'Enlace no valido',     msg: 'Este enlace de invitacion no existe o es incorrecto.' },
    no_token: { icon: <IconX />,     wrap: styles.iconWrapError,   title: 'Enlace no valido',     msg: 'No se proporcionó un token de invitacion en la URL.' },
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
        </div>
      </div>
    </div>
  );
}

export default function InvitacionPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.spinnerWrap}>
            <span className={styles.spinner} />
            <span className={styles.spinnerText}>Cargando...</span>
          </div>
        </div>
      </div>
    }>
      <InvitacionContent />
    </Suspense>
  );
}
