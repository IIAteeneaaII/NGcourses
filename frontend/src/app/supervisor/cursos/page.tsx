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

function getVisibleDescription(curso: Curso): string | null {
  const descripcion = curso.descripcion?.trim();
  const titulo = curso.titulo.trim().toLowerCase();

  if (!descripcion || descripcion.toLowerCase() === titulo) return null;

  return descripcion;
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
            <Link
              key={c.id}
              href={`/curso/${c.id}`}
              className={styles.cursoCard}
              aria-label={`Ir al curso ${c.titulo}`}
            >
              <div className={styles.cursoBody}>
                <div className={styles.cursoHeader}>
                  <h3 className={styles.cursoTitle}>{c.titulo}</h3>
                  <span className={styles.badge}>{c.marca}</span>
                </div>

                {getVisibleDescription(c) && (
                  <p className={styles.cursoDescription}>{getVisibleDescription(c)}</p>
                )}

                <div className={styles.cardFooter}>
                  <span className={styles.openHint}>Ir al curso</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
