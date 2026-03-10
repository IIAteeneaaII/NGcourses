'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cursosApi, inscripcionesApi, calificacionesApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiCurso {
  id: string;
  titulo: string;
  calificacion_prom: number;
  total_resenas: number;
}

interface ApiInscripcion {
  id: string;
  estado: string;
  inscrito_en: string;
  ultimo_acceso_en: string | null;
}

interface ApiInscripcionesResp {
  data: ApiInscripcion[];
  count: number;
}

export default function EstadisticasCursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [curso, setCurso] = useState<ApiCurso | null>(null);
  const [inscripciones, setInscripciones] = useState<ApiInscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cursoRaw, inscResp] = await Promise.all([
          cursosApi.get(courseId) as Promise<ApiCurso>,
          inscripcionesApi.porCurso(courseId).catch(() => ({ data: [], count: 0 })) as Promise<ApiInscripcionesResp>,
        ]);
        setCurso(cursoRaw);
        setInscripciones(inscResp.data);
      } catch {
        setCurso(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingText}>Cargando estadisticas...</p>
      </div>
    );
  }

  if (!curso) {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingText}>No se encontraron estadisticas para este curso.</p>
        <button className={styles.backButton} onClick={() => router.push('/instructor/cursos')}>
          Volver a Mis Cursos
        </button>
      </div>
    );
  }

  const totalInscritos = inscripciones.length;
  const completados = inscripciones.filter((i) => i.estado === 'finalizada').length;
  const activos = inscripciones.filter((i) => i.estado === 'activa').length;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor/cursos')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a Mis Cursos
        </button>
        <h1 className={styles.courseTitle}>{curso.titulo}</h1>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Inscritos</p>
          <p className={styles.statValue}>{totalInscritos}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Alumnos Activos</p>
          <p className={styles.statValue}>{activos}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Completados</p>
          <p className={styles.statValue}>{completados}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Calificacion Prom</p>
          <p className={styles.statValue}>{curso.calificacion_prom?.toFixed(1) ?? '0.0'} ⭐</p>
        </div>
      </div>

      <div className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Historial de Inscripciones</h2>
        <table className={styles.enrollmentTable}>
          <thead>
            <tr>
              <th>Inscripcion</th>
              <th>Estado</th>
              <th>Inscrito el</th>
              <th>Ultimo acceso</th>
            </tr>
          </thead>
          <tbody>
            {inscripciones.slice(0, 20).map((insc) => (
              <tr key={insc.id}>
                <td>{insc.id.slice(0, 8)}…</td>
                <td>{insc.estado}</td>
                <td>{insc.inscrito_en?.slice(0, 10) ?? '—'}</td>
                <td>{insc.ultimo_acceso_en?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
            {inscripciones.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>Sin inscripciones aun</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
