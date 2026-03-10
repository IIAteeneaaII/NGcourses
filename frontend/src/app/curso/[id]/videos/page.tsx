'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import CourseVideoContent from '@/components/course/CourseVideoContent';
import { cursosApi, inscripcionesApi, progresoApi } from '@/lib/api/client';
import type { Course, Module, Lesson } from '@/types/course';

interface ApiLeccion {
  id: string;
  titulo: string;
  tipo: string;
  orden: number;
  duracion_seg: number;
  bunny_video_id: string | null;
  hls_url: string | null;
}

interface ApiModulo {
  id: string;
  titulo: string;
  orden: number;
  lecciones: ApiLeccion[];
}

interface ApiCursoDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  bunny_library_id: string | null;
  modulos: ApiModulo[];
}

interface ApiInscripcionesResp {
  data: { id: string; curso_id: string }[];
  count: number;
}

interface ProgresoLeccion {
  leccion_id: string;
  progreso_pct: number;
  completado: boolean;
}

interface ProgresoResp {
  inscripcion_id: string;
  progreso_por_leccion: ProgresoLeccion[];
}

export default function CursoVideosPage() {
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [inscripcionId, setInscripcionId] = useState<string | null>(null);
  const [bunnyLibraryId, setBunnyLibraryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const cursoDetalle = await cursosApi.get(id) as ApiCursoDetalle;
        setBunnyLibraryId(cursoDetalle.bunny_library_id);

        // Inscripción del usuario en este curso
        const inscResp = await inscripcionesApi.mis() as ApiInscripcionesResp;
        const inscripcion = inscResp.data.find((i) => i.curso_id === id);
        if (inscripcion) setInscripcionId(inscripcion.id);

        // Progreso del usuario
        let completadoMap: Record<string, boolean> = {};
        try {
          const progResp = await progresoApi.curso(id) as ProgresoResp;
          completadoMap = Object.fromEntries(
            progResp.progreso_por_leccion.map((p) => [p.leccion_id, p.completado])
          );
        } catch {
          // Sin progreso aún
        }

        const modules: Module[] = cursoDetalle.modulos.map((m: ApiModulo) => ({
          id: m.id,
          name: m.titulo,
          order: m.orden,
          lessons: m.lecciones.map((l: ApiLeccion): Lesson => ({
            id: l.id,
            name: l.titulo,
            videoId: l.bunny_video_id || undefined,
            videoUrl: l.hls_url || undefined,
            duration: l.duracion_seg,
            completed: completadoMap[l.id] ?? false,
            order: l.orden,
          })),
        }));

        const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
        const completedLessons = modules.reduce(
          (acc, m) => acc + m.lessons.filter((l) => l.completed).length,
          0
        );

        setCourse({
          id: cursoDetalle.id,
          title: cursoDetalle.titulo,
          description: cursoDetalle.descripcion || '',
          modules,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        });
      } catch {
        setHasError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  if (hasError || !course) return notFound();

  return <CourseVideoContent initialCourse={course} inscripcionId={inscripcionId} bunnyLibraryId={bunnyLibraryId} />;
}
