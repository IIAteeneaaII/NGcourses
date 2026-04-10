'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import CourseInfoContent from '@/components/course/CourseInfoContent';
import { cursosApi, inscripcionesApi } from '@/lib/api/client';
import type { CourseInfo } from '@/types/course';

interface ApiModulo {
  titulo?: string;
  lecciones: unknown[];
}

const API_URL = '';

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  duracion_seg: number;
  calificacion_prom: number;
  modulos: ApiModulo[];
  portada_url: string | null;
  nivel: string | null;
  lo_que_aprenderas: string[];
  requisitos: string | null;
  instructor_nombre: string | null;
}

interface ApiInscripcionesResp {
  data: { id: string; curso_id: string }[];
  count: number;
}

export default function CursoInfoPage() {
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cursoRaw, inscResp] = await Promise.all([
          cursosApi.get(id) as Promise<ApiCurso>,
          (inscripcionesApi.mis().catch(() => ({ data: [], count: 0 }))) as Promise<ApiInscripcionesResp>,
        ]);

        const totalLecciones = cursoRaw.modulos?.reduce(
          (acc: number, m: ApiModulo) => acc + m.lecciones.length,
          0
        ) ?? 0;

        const duracionHoras = Math.round((cursoRaw.duracion_seg ?? 0) / 3600);

        const nivelLabel: Record<string, string> = {
          principiante: 'Principiante',
          intermedio: 'Intermedio',
          avanzado: 'Avanzado',
        };

        const courseInfo: CourseInfo = {
          id: cursoRaw.id,
          title: cursoRaw.titulo,
          instructor: cursoRaw.instructor_nombre || '',
          rating: cursoRaw.calificacion_prom ?? 0,
          level: (cursoRaw.nivel && nivelLabel[cursoRaw.nivel]) || 'Todos los niveles',
          duration: `${duracionHoras}h`,
          lessonsCount: totalLecciones,
          description: cursoRaw.descripcion || '',
          learningOutcomes: cursoRaw.lo_que_aprenderas ?? [],
          requirements: cursoRaw.requisitos || '',
          syllabus: cursoRaw.modulos?.map((m: ApiModulo) => m.titulo || '') ?? [],
          image: cursoRaw.portada_url ? `${API_URL}${cursoRaw.portada_url}` : '/placeholder-course.jpg',
        };

        setCourse(courseInfo);
        setIsEnrolled(inscResp.data.some((i) => i.curso_id === id));
      } catch {
        setHasError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleInscribirse = async () => {
    setEnrollLoading(true);
    try {
      await inscripcionesApi.inscribirse(id);
      setIsEnrolled(true);
    } catch {
      // ya inscrito u otro error
    } finally {
      setEnrollLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  if (hasError || !course) return notFound();

  return (
    <CourseInfoContent
      course={course}
      isEnrolled={isEnrolled}
      onInscribirse={handleInscribirse}
      enrollLoading={enrollLoading}
    />
  );
}
