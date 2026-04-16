'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Stats {
  usuarios_totales: number;
  usuarios_activos: number;
  progreso_promedio: number;
  cursos_disponibles: number;
  inscripciones_totales: number;
}

export default function SupervisorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supervisorApi.stats()
      .then((s) => setStats(s as Stats))
      .catch((e) => logError('supervisor.stats', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Panel Supervisor</h1>
        <p className={styles.subtitle}>
          Gestiona los usuarios y los cursos asignados a tu organización.
        </p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Usuarios totales</p>
          <p className={styles.statValue}>{loading ? '—' : stats?.usuarios_totales ?? 0}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Usuarios activos</p>
          <p className={styles.statValue}>{loading ? '—' : stats?.usuarios_activos ?? 0}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Progreso promedio</p>
          <p className={styles.statValue}>{loading ? '—' : `${Math.round(stats?.progreso_promedio ?? 0)}%`}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Cursos asignados</p>
          <p className={styles.statValue}>{loading ? '—' : stats?.cursos_disponibles ?? 0}</p>
        </div>
      </div>

      <div className={styles.optionsGrid}>
        <Link href="/supervisor/usuarios" className={styles.optionCard}>
          <h2 className={styles.optionTitle}>Gestionar usuarios</h2>
          <p className={styles.optionDescription}>Da de alta o invita usuarios de tu organización.</p>
        </Link>
        <Link href="/supervisor/cursos" className={styles.optionCard}>
          <h2 className={styles.optionTitle}>Ver cursos</h2>
          <p className={styles.optionDescription}>Cursos con licencia activa para tu organización.</p>
        </Link>
        <Link href="/supervisor/invitaciones" className={styles.optionCard}>
          <h2 className={styles.optionTitle}>Invitaciones</h2>
          <p className={styles.optionDescription}>Historial de invitaciones enviadas y su estado.</p>
        </Link>
        <Link href="/supervisor/solicitudes" className={styles.optionCard}>
          <h2 className={styles.optionTitle}>Solicitar cursos</h2>
          <p className={styles.optionDescription}>Pide nuevos cursos a NextGen para tu organización.</p>
        </Link>
      </div>
    </div>
  );
}
