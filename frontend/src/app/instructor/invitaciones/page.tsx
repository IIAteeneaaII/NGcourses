'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { cursosApi, instructorInvitacionesApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import type { EstadoInvitacion, InvitacionEnvioResult } from '@/types/admin';
import styles from './page.module.css';

interface Curso {
  id: string;
  titulo: string;
}

interface Invitacion {
  id: string;
  curso_id: string;
  email: string;
  expira_en: string;
  usado_en: string | null;
  creado_en: string;
  estado: EstadoInvitacion;
}

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  pendiente: 'Pendiente',
  usada: 'Usada',
  expirada: 'Expirada',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-MX');
  } catch {
    return '—';
  }
}

export default function InstructorInvitacionesPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoId, setCursoId] = useState('');
  const [emailsInput, setEmailsInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resultados, setResultados] = useState<InvitacionEnvioResult[]>([]);

  const [invs, setInvs] = useState<Invitacion[]>([]);
  const [loadingInvs, setLoadingInvs] = useState(false);

  const [reenvying, setReenvying] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    cursosApi.list().then((res: unknown) => {
      const data = res as { data: Curso[] };
      setCursos(data.data ?? []);
    }).catch((e: unknown) => logError('instructor.invitaciones.cursos', e));
  }, []);

  const loadInvitaciones = useCallback(async (cid: string) => {
    if (!cid) { setInvs([]); return; }
    setLoadingInvs(true);
    try {
      const data = (await instructorInvitacionesApi.listar(cid)) as Invitacion[];
      setInvs(data);
    } catch (e) {
      logError('instructor.invitaciones.listar', e);
    } finally {
      setLoadingInvs(false);
    }
  }, []);

  function handleCursoChange(id: string) {
    setCursoId(id);
    setEmailsInput('');
    setResultados([]);
    setInvs([]);
    loadInvitaciones(id);
  }

  async function handleSend() {
    const emails = emailsInput
      .split('\n')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!cursoId || emails.length === 0) return;

    setSending(true);
    setResultados([]);
    try {
      const res = (await instructorInvitacionesApi.enviar(cursoId, emails)) as InvitacionEnvioResult[];
      setResultados(res);
      setEmailsInput('');
      await loadInvitaciones(cursoId);
    } catch (e: unknown) {
      logError('instructor.invitaciones.enviar', e);
      const err = e as { status?: number; detail?: string };
      const detalle =
        err?.status === 401 || err?.status === 403
          ? 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.'
          : err?.detail ?? 'Error al enviar las invitaciones';
      setResultados([{ email: 'Error al enviar', estado: 'error', detalle }]);
    } finally {
      setSending(false);
    }
  }

  async function handleReenviar(invId: string) {
    setReenvying(invId);
    setRowMsg(null);
    try {
      await instructorInvitacionesApi.reenviar(cursoId, invId);
      setRowMsg({ id: invId, ok: true, text: 'Reenviada' });
      await loadInvitaciones(cursoId);
    } catch (e) {
      logError('instructor.invitaciones.reenviar', e);
      setRowMsg({ id: invId, ok: false, text: 'Error' });
    } finally {
      setReenvying(null);
      setTimeout(() => setRowMsg((m) => (m?.id === invId ? null : m)), 3000);
    }
  }

  async function handleRevocar(invId: string) {
    if (!confirm('¿Revocar esta invitación?')) return;
    setRevoking(invId);
    try {
      await instructorInvitacionesApi.revocar(cursoId, invId);
      setInvs((prev) => prev.filter((i) => i.id !== invId));
    } catch (e) {
      logError('instructor.invitaciones.revocar', e);
    } finally {
      setRevoking(null);
    }
  }

  const puedeEnviar = Boolean(cursoId) && emailsInput.trim().length > 0 && !sending;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Invitaciones</h1>
        <p className={styles.subtitle}>Invita alumnos a tus cursos por email</p>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Enviar invitaciones</h2>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="curso-select">Curso *</label>
          <select
            id="curso-select"
            className={styles.select}
            value={cursoId}
            onChange={(e) => handleCursoChange(e.target.value)}
          >
            <option value="">-- Seleccionar curso --</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.titulo}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="emails-textarea">
            Correos electrónicos{' '}
            <span className={styles.labelHint}>(uno por línea)</span>
          </label>
          <textarea
            id="emails-textarea"
            className={styles.textarea}
            placeholder={'alumno1@empresa.com\nalumno2@empresa.com'}
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            disabled={!cursoId}
          />
          <button
            type="button"
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!puedeEnviar}
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
                    ? 'Enviada'
                    : r.estado === 'ya_inscrito'
                      ? 'Ya inscrito'
                      : `Error${r.detalle ? `: ${r.detalle}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cursoId && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Historial de invitaciones{!loadingInvs && ` (${invs.length})`}
          </h2>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Enviada</th>
                  <th>Expira</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvs ? (
                  <tr><td colSpan={5} className={styles.emptyState}>Cargando...</td></tr>
                ) : invs.length > 0 ? (
                  invs.map((inv) => {
                    const msg = rowMsg?.id === inv.id ? rowMsg : null;
                    const reenviarLabel = reenvying === inv.id
                      ? '...'
                      : msg
                        ? msg.text
                        : 'Reenviar';
                    return (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[inv.estado] || ''}`}>
                            {ESTADO_LABEL[inv.estado] || inv.estado}
                          </span>
                        </td>
                        <td>{formatDate(inv.creado_en)}</td>
                        <td>{formatDate(inv.expira_en)}</td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.reenviarBtn}
                              disabled={inv.estado === 'usada' || reenvying === inv.id}
                              onClick={() => handleReenviar(inv.id)}
                              title={inv.estado === 'usada' ? 'No se puede reenviar una invitación ya usada' : 'Reenviar invitación'}
                            >
                              {reenviarLabel}
                            </button>
                            <button
                              type="button"
                              className={styles.revocarBtn}
                              disabled={inv.estado !== 'pendiente' || revoking === inv.id}
                              onClick={() => handleRevocar(inv.id)}
                            >
                              {revoking === inv.id ? '...' : 'Revocar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={5} className={styles.emptyState}>Sin invitaciones para este curso</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
