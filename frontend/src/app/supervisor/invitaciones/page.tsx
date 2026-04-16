'use client';

import React, { useEffect, useState } from 'react';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Invitacion {
  id: string;
  curso_id: string;
  curso_titulo: string;
  email: string;
  expira_en: string;
  usado_en: string | null;
  creado_en: string;
  estado: string;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  usada: 'Usada',
  expirada: 'Expirada',
};

export default function SupervisorInvitacionesPage() {
  const [invs, setInvs] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supervisorApi.listarInvitaciones()
      .then((data) => setInvs(data as Invitacion[]))
      .catch((e) => logError('supervisor.listarInvitaciones', e))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-MX');
    } catch {
      return '—';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Invitaciones</h1>
        <p className={styles.subtitle}>Historial de invitaciones enviadas</p>
      </div>

      <section className={styles.card}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Curso</th>
                <th>Estado</th>
                <th>Enviada</th>
                <th>Expira</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyState}>Cargando...</td></tr>
              ) : invs.length > 0 ? (
                invs.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>{inv.curso_titulo}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[inv.estado] || ''}`}>
                        {ESTADO_LABEL[inv.estado] || inv.estado}
                      </span>
                    </td>
                    <td>{formatDate(inv.creado_en)}</td>
                    <td>{formatDate(inv.expira_en)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className={styles.emptyState}>Sin invitaciones enviadas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
