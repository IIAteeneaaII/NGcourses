'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { invitacionesApi } from '@/lib/api/client';
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

  const [invitaciones, setInvitaciones] = useState<CourseInvitation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

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

  async function handleSend() {
    const emails = emailsInput
      .split('\n')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) return;

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

  async function handleRevocar(id: string) {
    setRevoking(id);
    try {
      await invitacionesApi.revocar(id);
      setInvitaciones((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignorar
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Link href={`/admin/cursos/${cursoId}/editar`} className={styles.backButton}>
          ← Volver al curso
        </Link>
        <h1 className={styles.pageTitle}>Gestionar Invitaciones</h1>
      </div>

      {/* Sección A — Enviar invitaciones */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Enviar invitaciones</h2>
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
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={sending || !emailsInput.trim()}
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
                  {r.estado === 'enviada'
                    ? '✓ Enviada'
                    : r.estado === 'ya_inscrito'
                    ? '⚠ Ya inscrito'
                    : `✗ Error${r.detalle ? `: ${r.detalle}` : ''}`}
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
                      <button
                        className={styles.revocarBtn}
                        disabled={inv.estado !== 'pendiente' || revoking === inv.id}
                        onClick={() => handleRevocar(inv.id)}
                      >
                        {revoking === inv.id ? '...' : 'Revocar'}
                      </button>
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
