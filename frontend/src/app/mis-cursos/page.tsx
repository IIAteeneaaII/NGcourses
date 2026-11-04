'use client';

import { useEffect, useState } from 'react';
import MyCoursesContent from '@/components/my-courses/MyCoursesContent';
import type { UserCourse } from '@/types/course';
import { inscripcionesApi, cursosApi, certificadosApi, progresoApi } from '@/lib/api/client';

interface ApiInscripcion {
  id: string;
  curso_id: string;
  estado: 'activa' | 'finalizada' | 'cancelado';
  inscrito_en: string;
}

interface ApiInscripcionesResp {
  data: ApiInscripcion[];
  count: number;
}

interface ApiLeccion {
  id: string;
  titulo: string;
  orden: number;
  es_visible?: boolean;
}

interface ApiModulo {
  orden: number;
  lecciones: ApiLeccion[];
}

interface ApiCurso {
  id: string;
  titulo: string;
  marca?: 'ram' | 'nextgen';
  portada_url?: string | null;
  modulos?: ApiModulo[];
}

interface ApiCertificado {
  curso_id: string;
  folio: string;
  emitido_en: string;
}

interface ApiCertificadosResp {
  data: ApiCertificado[];
  count: number;
}

interface ApiProgreso {
  total_lecciones: number;
  lecciones_completadas: number;
  progreso_pct: number;
  progreso_por_leccion: { leccion_id: string; completado: boolean; actualizado_en: string | null }[];
}

/** Lecciones visibles en orden de módulo y lección (mismo orden que el reproductor). */
function orderedLessons(curso: ApiCurso | null): ApiLeccion[] {
  if (!curso?.modulos) return [];
  return [...curso.modulos]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((m) => [...m.lecciones].sort((a, b) => a.orden - b.orden))
    .filter((l) => l.es_visible !== false);
}

export default function MisCursosPage() {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [inscResp, certResp] = await Promise.all([
          inscripcionesApi.mis() as Promise<ApiInscripcionesResp>,
          certificadosApi.mis() as Promise<ApiCertificadosResp>,
        ]);
        const inscripciones = inscResp.data.filter((i) => i.estado !== 'cancelado');
        const certByCursoId = Object.fromEntries(
          certResp.data.map((c) => [c.curso_id, c])
        );

        const cursoDetails = await Promise.allSettled(
          inscripciones.map((i) => cursosApi.get(i.curso_id) as Promise<ApiCurso>)
        );

        // Progreso real por curso (mismo índice que inscripciones). Aislado: si
        // el fetch de progreso falla o devuelve algo inesperado, NO debe vaciar
        // la lista — cae a 0%. (Mismo patrón que /perfil.)
        let progresoDetails: PromiseSettledResult<ApiProgreso>[] = [];
        try {
          progresoDetails = await Promise.allSettled(
            inscripciones.map((i) => progresoApi.curso(i.curso_id) as Promise<ApiProgreso>)
          );
        } catch {
          progresoDetails = [];
        }

        const userCourses: UserCourse[] = inscripciones.map((insc, idx) => {
          const cursoResult = cursoDetails[idx];
          const curso = cursoResult.status === 'fulfilled' ? cursoResult.value : null;
          const pr = progresoDetails[idx];
          const progreso = pr?.status === 'fulfilled' && pr.value ? pr.value : null;
          const isCompleted = insc.estado === 'finalizada';
          const cert = certByCursoId[insc.curso_id];

          const lessons = orderedLessons(curso);
          const done = new Set(
            (progreso?.progreso_por_leccion ?? []).filter((p) => p.completado).map((p) => p.leccion_id)
          );
          const next = lessons.find((l) => !done.has(l.id));
          const lastActivity = (progreso?.progreso_por_leccion ?? [])
            .map((p) => p.actualizado_en)
            .filter((d): d is string => Boolean(d))
            .sort()
            .pop();

          const progress = isCompleted ? 100 : Math.round(progreso?.progreso_pct ?? 0);
          const completedLessons = progreso?.lecciones_completadas ?? 0;

          return {
            id: insc.curso_id,
            title: curso?.titulo || 'Curso',
            instructor: '',
            lessonsCount: progreso?.total_lecciones ?? lessons.length,
            image: curso?.portada_url ?? '/placeholder-course.jpg',
            marca: curso?.marca,
            status: isCompleted ? 'completed' : completedLessons > 0 || progress > 0 ? 'in_progress' : 'not_started',
            progress,
            completedLessons,
            nextLessonTitle: next?.titulo,
            lastActivity: lastActivity ?? (cert ? cert.emitido_en : undefined),
            completedDate: cert ? cert.emitido_en.slice(0, 10) : undefined,
            // Basta el folio: la descarga regenera el PDF si hiciera falta.
            certificadoFolio: cert ? cert.folio : undefined,
          };
        });

        setCourses(userCourses);
      } catch {
        // Si falla, mostrar vacío
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando tu progreso...</span>
      </div>
    );
  }

  return <MyCoursesContent courses={courses} />;
}
