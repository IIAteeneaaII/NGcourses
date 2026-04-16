'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Solicitud {
  id: string;
  titulo_solicitud: string;
  descripcion: string | null;
  estado: string;
  creado_en: string;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  revision: 'En revisión',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

export default function SupervisorSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ titulo_solicitud: '', descripcion: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supervisorApi.listarSolicitudes() as Solicitud[];
      setSolicitudes(data);
    } catch (e) {
      logError('supervisor.listarSolicitudes', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMsg('');
    setErr('');
    try {
      await supervisorApi.crearSolicitud({
        titulo_solicitud: form.titulo_solicitud,
        descripcion: form.descripcion || undefined,
      });
      setMsg('Solicitud enviada');
      setForm({ titulo_solicitud: '', descripcion: '' });
      load();
    } catch (error: unknown) {
      const apiErr = error as { detail?: string };
      setErr(apiErr?.detail || 'Error al enviar solicitud');
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-MX'); } catch { return '—'; }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Solicitudes de cursos</h1>
        <p className={styles.subtitle}>Pide nuevos cursos a NextGen y revisa el estado de solicitudes anteriores</p>
      </div>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Nueva solicitud</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Título *</label>
            <input type="text" required className={styles.formInput}
              value={form.titulo_solicitud}
              onChange={(e) => setForm({ ...form, titulo_solicitud: e.target.value })}
              placeholder="Ej: Curso de liderazgo" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descripción</label>
            <textarea rows={3} className={styles.formInput}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Detalles adicionales sobre el curso solicitado" />
          </div>
          {err && <p className={styles.formError}>{err}</p>}
          {msg && <p className={styles.formMsg}>{msg}</p>}
          <div>
            <button type="submit" className={styles.submitButton} disabled={submitLoading}>
              {submitLoading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Historial</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className={styles.emptyState}>Cargando...</td></tr>
              ) : solicitudes.length > 0 ? (
                solicitudes.map((s) => (
                  <tr key={s.id}>
                    <td>{s.titulo_solicitud}</td>
                    <td>{s.descripcion || '—'}</td>
                    <td>{ESTADO_LABEL[s.estado] || s.estado}</td>
                    <td>{formatDate(s.creado_en)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className={styles.emptyState}>Sin solicitudes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
