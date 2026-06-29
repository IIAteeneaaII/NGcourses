'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { invitacionesApi, cursosApi } from '@/lib/api/client';
import type {
  CourseInvitation,
  CourseInvitationsResponse,
  EstadoInvitacion,
  InvitacionEnvioResult,
} from '@/types/admin';

import styles from './page.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function EstadoBadge({ estado }: { estado: EstadoInvitacion }) {
  const map: Record<EstadoInvitacion, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente', cls: styles.badgePendiente },
    usada: { label: 'Usada', cls: styles.badgeUsada },
    expirada: { label: 'Expirada', cls: styles.badgeExpirada },
  };
  const { label, cls } = map[estado];
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export default function InvitacionesPage() {
  const params = useParams();
  const cursoId = params.id as string;

  const [emailsInput, setEmailsInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resultados, setResultados] = useState<InvitacionEnvioResult[]>([]);

  // Estado del curso: solo se puede invitar a cursos publicados. Se asume true
  // mientras carga para no parpadear el aviso; el backend bloquea igual.
  const [cursoEstado, setCursoEstado] = useState<string | null>(null);
  const cursoPublicado = cursoEstado === null || cursoEstado === 'publicado';

  const [invitaciones, setInvitaciones] = useState<CourseInvitation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reenvying, setReenvying] = useState<string | null>(null);
  const [reenvioMsg, setReenvioMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const loadInvitaciones = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = (await invitacionesApi.porCurso(cursoId)) as CourseInvitationsResponse;
      setInvitaciones(res.data);
    } catch {
      // ignorar
    } finally {
      setLoadingList(false);
    }
  }, [cursoId]);

  useEffect(() => {
    loadInvitaciones();
  }, [loadInvitaciones]);

  useEffect(() => {
    cursosApi.get(cursoId)
      .then((c) => setCursoEstado((c as { estado?: string })?.estado ?? null))
      .catch(() => setCursoEstado(null));
  }, [cursoId]);

  async function handleSend() {
    const emails = emailsInput
      .split('\n')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) return;
    if (!cursoPublicado) return;

    setSending(true);
    setResultados([]);
    try {
      const res = (await invitacionesApi.crear({
        curso_id: cursoId,
        emails,
      })) as InvitacionEnvioResult[];
      setResultados(res);
      setEmailsInput('');
      await loadInvitaciones();
    } catch (e: any) {
      const status = (e as any)?.status;
      const detalle =
        status === 401 || status === 403
          ? 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.'
          : (e?.detail ?? String(e));
      setResultados([{ email: 'Error al enviar', estado: 'error', detalle }]);
    } finally {
      setSending(false);
    }
  }

  async function handleReenviar(id: string) {
    setReenvying(id);
    setReenvioMsg(null);
    try {
      await invitacionesApi.reenviar(id);
      setReenvioMsg({ id, ok: true, text: 'Invitación reenviada' });
      await loadInvitaciones();
    } catch {
      setReenvioMsg({ id, ok: false, text: 'Error al reenviar' });
    } finally {
      setReenvying(null);
      setTimeout(() => setReenvioMsg(null), 3000);
    }
  }

  async function handleRevocar(id: string) {
    setRevoking(id);
    try {
      await invitacionesApi.revocar(id);
      setInvitaciones((prev) => prev.filter((i) => i.id !== id));
      setReenvioMsg({ id, ok: true, text: 'Invitación revocada.' });
    } catch (e: unknown) {
      // Mostrar el motivo real (p.ej. "ya utilizada" → 409) en vez de fallar mudo.
      const detail = (e as { detail?: string })?.detail;
      setReenvioMsg({ id, ok: false, text: detail || 'No se pudo revocar la invitación.' });
    } finally {
      setRevoking(null);
      setTimeout(() => setReenvioMsg(null), 4000);
    }
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Link href="/admin/cursos" className={styles.backButton} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Volver a cursos
        </Link>
        <h1 className={styles.pageTitle}>Gestionar Invitaciones</h1>
      </div>

      {/* Sección A — Enviar invitaciones */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Enviar invitaciones</h2>
        {!cursoPublicado && (
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              background: '#fef9c3', border: '1px solid #fde047', color: '#854d0e',
              borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem',
              fontSize: '0.875rem', lineHeight: 1.5,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: '0.1rem' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <span>
              Este curso está en <strong>{cursoEstado}</strong>. Solo puedes enviar
              invitaciones de cursos <strong>publicados</strong>. Publícalo para invitar alumnos.
            </span>
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Correos electrónicos{' '}
            <span className={styles.labelHint}>(uno por línea)</span>
          </label>
          <textarea
            className={styles.textarea}
            placeholder={'alumno1@empresa.com\nalumno2@empresa.com'}
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            disabled={!cursoPublicado}
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={sending || !emailsInput.trim() || !cursoPublicado}
            title={!cursoPublicado ? 'Publica el curso para poder invitar' : undefined}
          >
            {sending ? 'Enviando...' : 'Enviar invitaciones'}
          </button>
        </div>

        {resultados.length > 0 && (
          <ul className={styles.resultsList}>
            {resultados.map((r) => (
              <li
                key={r.email}
                className={`${styles.resultItem} ${
                  r.estado === 'enviada'
                    ? styles.resultEnviada
                    : r.estado === 'ya_inscrito'
                    ? styles.resultYaInscrito
                    : styles.resultError
                }`}
              >
                <span className={styles.resultEmail}>{r.email}</span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {r.estado === 'enviada' && <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    {(r.estado === 'error' || r.estado === 'invalido') && <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                    {r.estado === 'enviada'
                      ? 'Enviada'
                      : r.estado === 'ya_inscrito'
                      ? '⚠ Ya inscrito'
                      : r.estado === 'invalido'
                      ? `Correo inválido${r.detalle ? `: ${r.detalle}` : ''}`
                      : `Error${r.detalle ? `: ${r.detalle}` : ''}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sección B — Historial */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          Invitaciones enviadas{' '}
          {!loadingList && `(${invitaciones.length})`}
        </h2>

        {loadingList ? (
          <p className={styles.emptyMsg}>Cargando...</p>
        ) : invitaciones.length === 0 ? (
          <p className={styles.emptyMsg}>No hay invitaciones enviadas aún.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th>Expira</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {invitaciones.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>
                      <EstadoBadge estado={inv.estado} />
                    </td>
                    <td>{formatDate(inv.creado_en)}</td>
                    <td>{formatDate(inv.expira_en)}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.reenviarBtn}
                          disabled={inv.estado === 'usada' || reenvying === inv.id}
                          onClick={() => handleReenviar(inv.id)}
                          title={inv.estado === 'usada' ? 'No se puede reenviar una invitación ya usada' : 'Reenviar invitación'}
                        >
                          {reenvying === inv.id
                            ? '...'
                            : reenvioMsg?.id === inv.id
                              ? (reenvioMsg.ok
                                ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>)
                              : 'Reenviar'}
                        </button>
                        <button
                          className={styles.revocarBtn}
                          disabled={inv.estado !== 'pendiente' || revoking === inv.id}
                          onClick={() => handleRevocar(inv.id)}
                        >
                          {revoking === inv.id ? '...' : 'Revocar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
