'use client';

import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { authApi, invitacionesApi, usersApi } from '@/lib/api/client';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [estado, setEstado] = useState<Estado>({ type: 'loading' });
  const [copied, setCopied] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Estado onboarding
  const [onboardingForm, setOnboardingForm] = useState({
    full_name: '',
    telefono: '',
    new_password: '',
    confirm_password: '',
  });
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!token) { setEstado({ type: 'no_token' }); return; }
    invitacionesApi.canjear(token)
      .then((res) => setEstado({ type: 'success', data: res as CanjearResponse }))
      .catch((err: any) => {
        const s = err?.status ?? 0;
        setEstado(s === 409 ? { type: 'used' } : s === 410 ? { type: 'expired' } : { type: 'invalid' });
      });
  }, [token]);

  async function copyPassword(pw: string) {
    try {
      await navigator.clipboard.writeText(pw);
    } catch {
      // Fallback para cuando el documento no tiene foco
      const el = document.createElement('textarea');
      el.value = pw;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingError('');

    const { full_name, telefono, new_password, confirm_password } = onboardingForm;

    if (!full_name.trim()) {
      setOnboardingError('El nombre completo es requerido.');
      return;
    }
    if (new_password.length < 8) {
      setOnboardingError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (new_password !== confirm_password) {
      setOnboardingError('Las contraseñas no coinciden.');
      return;
    }

    const data = (estado as { type: 'success'; data: CanjearResponse }).data;

    setOnboardingSaving(true);
    try {
      // 1. Autenticar con contraseña temporal para obtener token
      const { access_token } = await authApi.login(data.email, data.password_temporal!);
      localStorage.setItem('access_token', access_token);

      // 2. Actualizar nombre y teléfono
      await usersApi.updateMe({
        full_name: full_name.trim(),
        telefono: telefono.trim() || null,
      });

      // 3. Cambiar contraseña temporal por la nueva
      await usersApi.changePassword({
        current_password: data.password_temporal!,
        new_password,
      });

      setOnboardingDone(true);
    } catch (err: any) {
      setOnboardingError(err?.detail ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setOnboardingSaving(false);
    }
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
    const esNuevoUsuario = data.usuario_creado && data.password_temporal;

    return (
      <div className={styles.page}>
        <div className={`${styles.card} ${esNuevoUsuario ? styles.cardWide : ''}`}>
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

            {esNuevoUsuario && !onboardingDone && (
              <div className={styles.passwordBox}>
                <p className={styles.passwordLabel}>Tu nueva cuenta</p>
                <p className={styles.passwordEmail}>
                  Cuenta creada con <strong>{data.email}</strong>
                </p>
                <div className={styles.passwordWarningBanner}>
                  ⚠️ Guarda estos datos ahora — la contraseña <strong>NO</strong> se volverá a mostrar.
                </div>
                <div className={styles.passwordValue}>
                  <span className={styles.passwordText}>{data.password_temporal}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyPassword(data.password_temporal!)}
                    title="Copiar contraseña"
                  >
                    {copied ? <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>✓</span> : <IconCopy />}
                  </button>
                </div>
                {copied && <p className={styles.passwordCopied}>¡Copiado al portapapeles!</p>}
              </div>
            )}

            {/* Formulario de onboarding solo para usuarios nuevos */}
            {esNuevoUsuario && !onboardingDone && (
              <div className={styles.onboardingSection}>
                <h2 className={styles.onboardingTitle}>Completa tu perfil</h2>
                <p className={styles.onboardingSubtitle}>
                  Necesitamos tu nombre para emitir tu certificado al completar el curso.
                </p>
                <form onSubmit={handleOnboarding} className={styles.onboardingForm}>
                  <div className={styles.onboardingField}>
                    <label className={styles.onboardingLabel}>
                      Nombre completo <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className={styles.onboardingInput}
                      placeholder="Ej. María García López"
                      value={onboardingForm.full_name}
                      onChange={(e) => setOnboardingForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className={styles.onboardingField}>
                    <label className={styles.onboardingLabel}>Teléfono <span className={styles.optional}>(opcional)</span></label>
                    <input
                      type="tel"
                      className={styles.onboardingInput}
                      placeholder="+52 55 0000 0000"
                      value={onboardingForm.telefono}
                      onChange={(e) => setOnboardingForm((f) => ({ ...f, telefono: e.target.value }))}
                    />
                  </div>
                  <div className={styles.onboardingField}>
                    <label className={styles.onboardingLabel}>
                      Nueva contraseña <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.passwordInputWrap}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        className={styles.onboardingInput}
                        placeholder="Mínimo 8 caracteres"
                        value={onboardingForm.new_password}
                        onChange={(e) => setOnboardingForm((f) => ({ ...f, new_password: e.target.value }))}
                      />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowPw((v) => !v)}>
                        {showPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.onboardingField}>
                    <label className={styles.onboardingLabel}>
                      Confirmar contraseña <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.passwordInputWrap}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        className={styles.onboardingInput}
                        placeholder="Repite la nueva contraseña"
                        value={onboardingForm.confirm_password}
                        onChange={(e) => setOnboardingForm((f) => ({ ...f, confirm_password: e.target.value }))}
                      />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((v) => !v)}>
                        {showConfirm ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {onboardingError && (
                    <p className={styles.onboardingError}>{onboardingError}</p>
                  )}
                  <button
                    type="submit"
                    className={styles.onboardingBtn}
                    disabled={onboardingSaving}
                  >
                    {onboardingSaving ? 'Guardando...' : 'Guardar y acceder al curso →'}
                  </button>
                </form>
              </div>
            )}

            {/* Usuario nuevo: botón después de completar onboarding */}
            {esNuevoUsuario && onboardingDone && (
              <button
                className={styles.primaryBtn}
                onClick={() => router.push(`/curso/${data.curso_id}`)}
              >
                Acceder al curso →
              </button>
            )}

            {/* Cuenta existente: pedir que inicie sesión (no tocar localStorage/cookies) */}
            {!esNuevoUsuario && (
              <div className={styles.loginPrompt}>
                <p className={styles.loginPromptText}>
                  Tu cuenta ya existe. Inicia sesión para acceder al curso.
                </p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => router.push('/')}
                >
                  Ir al inicio de sesión →
                </button>
              </div>
            )}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Cargando...</span>
      </div>
    }>
      <InvitacionContent />
    </Suspense>
  );
}
