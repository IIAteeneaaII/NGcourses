'use client';

import React, { useEffect, useState } from 'react';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Organizacion {
  id: string;
  nombre: string;
  email_contacto: string | null;
  telefono_contacto: string | null;
  plan_de_cursos: string | null;
  fecha_compra: string | null;
}

export default function MiOrganizacionPage() {
  const [org, setOrg] = useState<Organizacion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supervisorApi.miOrganizacion()
      .then((o) => setOrg(o as Organizacion))
      .catch((e) => logError('supervisor.miOrganizacion', e))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-MX');
    } catch {
      return '—';
    }
  };

  if (loading) return <div className={styles.container}><p>Cargando...</p></div>;
  if (!org) return <div className={styles.container}><p>No tienes organización asignada.</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mi organización</h1>
        <p className={styles.subtitle}>Información y plan de tu organización</p>
      </div>

      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.label}>Nombre</span>
          <span className={styles.value}>{org.nombre}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Email de contacto</span>
          <span className={styles.value}>{org.email_contacto || '—'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Teléfono</span>
          <span className={styles.value}>{org.telefono_contacto || '—'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Plan de cursos</span>
          <span className={styles.value}>{org.plan_de_cursos || '—'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Fecha de compra</span>
          <span className={styles.value}>{formatDate(org.fecha_compra)}</span>
        </div>
      </section>
    </div>
  );
}
