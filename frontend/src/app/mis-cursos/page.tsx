'use client';

import { useEffect, useState } from 'react';
import MyCoursesContent from '@/components/my-courses/MyCoursesContent';
import type { UserCourse, MyCoursesStatistics } from '@/types/course';
import { inscripcionesApi, cursosApi, certificadosApi } from '@/lib/api/client';

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

interface ApiModulo {
  lecciones: unknown[];
}

interface ApiCurso {
  id: string;
  titulo: string;
  instructor_id: string;
  duracion_seg: number;
  modulos?: ApiModulo[];
}

interface ApiCertificado {
  curso_id: string;
  folio: string;
  url_pdf: string | null;
}

interface ApiCertificadosResp {
  data: ApiCertificado[];
  count: number;
}

const EMPTY_STATS: MyCoursesStatistics = {
  totalCourses: 0,
  inProgress: 0,
  completed: 0,
  totalHours: '0h',
};

export default function MisCursosPage() {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [statistics, setStatistics] = useState<MyCoursesStatistics>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [inscResp, certResp] = await Promise.all([
          inscripcionesApi.mis() as Promise<ApiInscripcionesResp>,
          certificadosApi.mis() as Promise<ApiCertificadosResp>,
        ]);
        const inscripciones = inscResp.data;
        const certByCursoId = Object.fromEntries(
          certResp.data.map((c) => [c.curso_id, c])
        );

        const cursoDetails = await Promise.allSettled(
          inscripciones.map((i) => cursosApi.get(i.curso_id) as Promise<ApiCurso>)
        );

        const userCourses: UserCourse[] = inscripciones.map((insc, idx) => {
          const cursoResult = cursoDetails[idx];
          const curso = cursoResult.status === 'fulfilled' ? cursoResult.value : null;
          const isCompleted = insc.estado === 'finalizada';
          const cert = certByCursoId[insc.curso_id];

          return {
            id: insc.curso_id,
            title: curso?.titulo || 'Curso',
            instructor: '',
            lessonsCount: curso?.modulos?.reduce((acc, m) => acc + m.lecciones.length, 0) ?? 0,
            image: '/placeholder-course.jpg',
            status: isCompleted ? 'completed' : 'in_progress',
            progress: isCompleted ? 100 : undefined,
            completedDate: isCompleted ? insc.inscrito_en.slice(0, 10) : undefined,
            certificadoFolio: cert?.url_pdf ? cert.folio : undefined,
          };
        });

        const inProgress = userCourses.filter((c) => c.status === 'in_progress').length;
        const completed = userCourses.filter((c) => c.status === 'completed').length;
        const totalSeg = inscripciones.reduce((acc, _, idx) => {
          const res = cursoDetails[idx];
          return acc + (res.status === 'fulfilled' ? (res.value.duracion_seg || 0) : 0);
        }, 0);

        setCourses(userCourses);
        setStatistics({
          totalCourses: userCourses.length,
          inProgress,
          completed,
          totalHours: `${Math.round(totalSeg / 3600)}h`,
        });
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
        <span>Cargando mis cursos...</span>
      </div>
    );
  }

  return <MyCoursesContent courses={courses} statistics={statistics} />;
}
