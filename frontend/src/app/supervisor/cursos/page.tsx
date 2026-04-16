'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface Curso {
  id: string;
  titulo: string;
  descripcion: string | null;
  portada_url: string | null;
  marca: string;
}

export default function SupervisorCursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supervisorApi.cursos()
      .then((data) => setCursos(data as Curso[]))
      .catch((e) => logError('supervisor.cursos', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cursos de la organización</h1>
        <p className={styles.subtitle}>Cursos con licencia activa para tu organización</p>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : cursos.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>Aún no tienes cursos asignados.</p>
          <Link href="/supervisor/solicitudes" className={styles.ctaLink}>Solicitar un curso</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {cursos.map((c) => (
            <div key={c.id} className={styles.cursoCard}>
              <div className={styles.cursoBody}>
                <h3 className={styles.cursoTitle}>{c.titulo}</h3>
                <span className={styles.badge}>{c.marca}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
