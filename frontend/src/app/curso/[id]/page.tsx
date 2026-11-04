'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import CourseInfoContent, { type CourseProgress } from '@/components/course/CourseInfoContent';
import { categoriasApi, cursosApi, inscripcionesApi, progresoApi, type ApiError } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import type { CourseInfo } from '@/types/course';
import { toSyllabus } from '@/lib/syllabus';

interface ApiLeccion {
  id?: string;
  titulo?: string;
  es_visible?: boolean;
  tipo?: string;
  orden?: number;
  duracion_seg?: number;
}

interface ApiModulo {
  titulo?: string;
  orden?: number;
  lecciones: ApiLeccion[];
}

const API_URL = '';

function getUserRoleFromCookie(): string {
  if (typeof document === 'undefined') return '';

  const rolCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('user_rol='));

  return rolCookie ? decodeURIComponent(rolCookie.split('=')[1] ?? '') : '';
}

function getCourseBackHref(rol: string): string {
  if (rol === 'supervisor') return '/supervisor/cursos';
  if (rol === 'instructor') return '/instructor/cursos';
  if (rol === 'administrador') return '/admin/cursos';

  return '/cursos';
}

function shouldCheckEnrollment(rol: string): boolean {
  // Solo el alumno necesita consultar inscripción en la ficha del curso.
  // Supervisor/admin/instructor entran en modo revisión y no deben esperar endpoints de inscripción.
  return rol !== 'supervisor' && rol !== 'administrador' && rol !== 'instructor';
}

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  duracion_seg: number;
  calificacion_prom: number;
  total_resenas: number;
  modulos: ApiModulo[];
  portada_url: string | null;
  nivel: string | null;
  lo_que_aprenderas: string[];
  requisitos: string | null;
  instructor_nombre: string | null;
  bloqueado_por_licencia?: boolean;
  es_de_mi_org?: boolean;
  es_gratis?: boolean;
  marca?: 'ram' | 'nextgen';
  categoria_id?: string | null;
  precio?: number | string | null;
  moneda?: string;
  destacado?: boolean;
}

interface ApiInscripcionesResp {
  data: { id: string; curso_id: string; estado?: 'activa' | 'finalizada' | 'cancelado' }[];
  count: number;
}

interface ApiProgreso {
  total_lecciones: number;
  lecciones_completadas: number;
  progreso_pct: number;
  progreso_por_leccion: { leccion_id: string; completado: boolean }[];
}

export default function CursoInfoPage() {
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [backHref, setBackHref] = useState('/cursos');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        const rol = getUserRoleFromCookie();
        if (!active) return;
        setUserRole(rol);
        setBackHref(getCourseBackHref(rol));

        const cursoRaw = await cursosApi.get(id) as ApiCurso;

        const esAlumno = shouldCheckEnrollment(rol);
        let inscResp: ApiInscripcionesResp = { data: [], count: 0 };
        let categorias: { id: string; nombre: string }[] = [];
        if (esAlumno) {
          [inscResp, categorias] = await Promise.all([
            inscripcionesApi.mis().catch(() => ({ data: [], count: 0 })) as Promise<ApiInscripcionesResp>,
            categoriasApi.list().catch(() => []) as Promise<{ id: string; nombre: string }[]>,
          ]);
        }
        // Una inscripción cancelada no cuenta: el alumno vuelve a ver "Inscribirme".
        const enrolled = inscResp.data.some((i) => i.curso_id === id && i.estado !== 'cancelado');

        // El alumno no ve lecciones ocultas (el progreso del backend tampoco las cuenta).
        if (esAlumno) {
          cursoRaw.modulos = (cursoRaw.modulos ?? []).map((m) => ({
            ...m,
            lecciones: m.lecciones.filter((l) => l.es_visible !== false),
          }));
        }

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
          reviewsCount: cursoRaw.total_resenas ?? 0,
          level: (cursoRaw.nivel && nivelLabel[cursoRaw.nivel]) || 'No especificado',
          duration: `${duracionHoras}h`,
          lessonsCount: totalLecciones,
          description: cursoRaw.descripcion || '',
          learningOutcomes: cursoRaw.lo_que_aprenderas ?? [],
          requirements: cursoRaw.requisitos || '',
          syllabus: toSyllabus(cursoRaw.modulos),
          image: cursoRaw.portada_url ? `${API_URL}${cursoRaw.portada_url}` : '/placeholder-course.jpg',
          bloqueadoPorLicencia: cursoRaw.bloqueado_por_licencia ?? false,
          esDeMiOrg: cursoRaw.es_de_mi_org ?? false,
          esGratis: cursoRaw.es_gratis,
          marca: cursoRaw.marca,
          category: categorias.find((c) => c.id === cursoRaw.categoria_id)?.nombre,
          precio: cursoRaw.precio != null ? Number(cursoRaw.precio) : null,
          moneda: cursoRaw.moneda || 'MXN',
          destacado: cursoRaw.destacado ?? false,
        };

        // Avance real del alumno inscrito; si falla, la ficha se muestra sin él.
        let courseProgress: CourseProgress | null = null;
        if (enrolled) {
          try {
            const pr = await progresoApi.curso(id) as ApiProgreso;
            courseProgress = {
              completedLessonIds: pr.progreso_por_leccion.filter((p) => p.completado).map((p) => p.leccion_id),
              completed: pr.lecciones_completadas,
              total: pr.total_lecciones,
              pct: Math.round(pr.progreso_pct),
            };
          } catch (e) {
            logError('CursoInfoPage/progreso', e);
          }
        }

        if (!active) return;
        setCourse(courseInfo);
        setIsEnrolled(enrolled);
        setProgress(courseProgress);
      } catch (e) {
        logError('CursoInfoPage/fetchData', e);
        if (active) setHasError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [id]);

  const handleInscribirse = async () => {
    setEnrollLoading(true);
    try {
      await inscripcionesApi.inscribirse(id);
      setIsEnrolled(true);
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 403) {
        // Defensa en profundidad: si el flag se perdió por race, sincronizar UI.
        setCourse((prev) => (prev ? { ...prev, bloqueadoPorLicencia: true } : prev));
      }
      logError('CursoInfoPage/inscribirse', e);
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
      progress={progress}
      onInscribirse={handleInscribirse}
      onPaymentSuccess={() => setIsEnrolled(true)}
      enrollLoading={enrollLoading}
      bloqueadoPorLicencia={course.bloqueadoPorLicencia}
      backHref={backHref}
      viewOnlyMode={userRole === 'supervisor'}
      viewCourseHref={`/curso/${course.id}/videos?from=supervisor`}
      viewCourseLabel="Ver curso"
      showUserMenu={shouldCheckEnrollment(userRole)}
    />
  );
}
