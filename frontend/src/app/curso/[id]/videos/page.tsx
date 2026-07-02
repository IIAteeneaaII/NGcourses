'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter, notFound } from 'next/navigation';
import CourseVideoContent from '@/components/course/CourseVideoContent';
import ErrorBoundary from '@/components/ErrorBoundary';
import { cursosApi, inscripcionesApi, progresoApi } from '@/lib/api/client';
import { normalizeQuizData } from '@/lib/quizData';
import type { Course, Module, Lesson } from '@/types/course';

interface ApiRecurso {
  id: string;
  tipo: string;
  titulo: string;
  url: string;
}

const API_URL = '';

interface ApiLeccion {
  id: string;
  titulo: string;
  tipo: string;
  orden: number;
  duracion_seg: number;
  bunny_video_id: string | null;
  hls_url: string | null;
  contenido?: unknown;
  contenido_json?: unknown;
  content?: unknown;
  quiz?: unknown;
  quizData?: unknown;
  quiz_data?: unknown;
  preguntas?: unknown;
  questions?: unknown;
  recursos?: ApiRecurso[];
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

function getLessonContent(leccion: ApiLeccion): unknown {
  if (leccion.contenido != null) return leccion.contenido;
  if (leccion.contenido_json != null) return leccion.contenido_json;
  if (leccion.content != null) return leccion.content;
  if (leccion.quiz != null) return leccion.quiz;
  if (leccion.quizData != null) return leccion.quizData;
  if (leccion.quiz_data != null) return leccion.quiz_data;
  if (Array.isArray(leccion.preguntas)) return { preguntas: leccion.preguntas };
  if (Array.isArray(leccion.questions)) return { preguntas: leccion.questions };
  return null;
}

export default function CursoVideosPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const fromAdmin = searchParams.get('from') === 'admin';
  const fromSupervisor = searchParams.get('from') === 'supervisor';
  const previewMode = fromAdmin || fromSupervisor;

  const [course, setCourse] = useState<Course | null>(null);
  const [inscripcionId, setInscripcionId] = useState<string | null>(null);
  const [bunnyLibraryId, setBunnyLibraryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const cursoDetalle = await cursosApi.get(id) as ApiCursoDetalle;
        setBunnyLibraryId(cursoDetalle.bunny_library_id);

        let inscripcion: { id: string; curso_id: string } | undefined;

        if (!previewMode) {
          // Inscripción del usuario en este curso. En vista de supervisor/admin no se consulta
          // porque esos roles no tienen inscripción y el endpoint de progreso responde 404.
          const inscResp = await inscripcionesApi.mis() as ApiInscripcionesResp;
          inscripcion = inscResp.data.find((i) => i.curso_id === id);

          // CP18: el reproductor es solo para inscritos. Sin inscripción se redirige
          // a la ficha del curso, que muestra el CTA para inscribirse.
          if (!inscripcion) {
            setRedirecting(true);
            router.replace(`/curso/${id}`);
            return;
          }

          setInscripcionId(inscripcion.id);
        } else {
          setInscripcionId(null);
        }

        // Progreso del usuario. En vista previa/supervisor no se consulta ni se marca avance.
        let completadoMap: Record<string, boolean> = {};
        if (!previewMode) {
          try {
            const progResp = await progresoApi.curso(id) as ProgresoResp;
            completadoMap = Object.fromEntries(
              progResp.progreso_por_leccion.map((p) => [p.leccion_id, p.completado])
            );
          } catch {
            // Sin progreso aún
          }
        }

        const modules: Module[] = cursoDetalle.modulos.map((m: ApiModulo) => ({
          id: m.id,
          name: m.titulo,
          order: m.orden,
          lessons: m.lecciones.map((l: ApiLeccion): Lesson => {
            const tipo = (l.tipo === 'quiz' ? 'quiz' : l.tipo === 'lectura' ? 'lectura' : 'video') as Lesson['tipo'];
            const rawContent = getLessonContent(l);

            return {
              id: l.id,
              name: l.titulo,
              tipo,
              moduleId: m.id,
              videoId: l.bunny_video_id || undefined,
              videoUrl: l.hls_url || undefined,
              duration: l.duracion_seg,
              completed: completadoMap[l.id] ?? false,
              order: l.orden,
              // Para quiz normalizamos aquí. Si el backend manda el contenido como string,
              // objeto, quizData, quiz_data, preguntas o questions, queda listo para mostrarse.
              contenido: tipo === 'quiz' ? normalizeQuizData(rawContent ?? l) : rawContent,
              resources: (l.recursos || []).map((r) => ({
                id: r.id,
                name: r.titulo,
                url: r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url,
                type: (r.tipo === 'docx' || r.tipo === 'xlsx' || r.tipo === 'pdf') ? r.tipo : 'other' as const,
              })),
            };
          }),
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
  }, [id, previewMode, router]);

  if (loading || redirecting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  if (hasError || !course) return notFound();

  return (
    <ErrorBoundary context="CourseVideoPage" fallback={<p style={{ padding: '2rem' }}>Error al cargar el contenido del curso. Recarga la página.</p>}>
      <CourseVideoContent
        initialCourse={course}
        inscripcionId={inscripcionId}
        bunnyLibraryId={bunnyLibraryId}
        backHref={fromAdmin ? `/admin/cursos/${id}/preview` : fromSupervisor ? `/curso/${id}` : undefined}
        navHref={fromSupervisor ? '/supervisor/cursos' : fromAdmin ? '/admin/cursos' : undefined}
        previewMode={previewMode}
        readOnlyMode={fromSupervisor}
      />
    </ErrorBoundary>
  );
}
