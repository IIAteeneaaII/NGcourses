'use client';

import { useEffect, useState } from 'react';
import CoursesContent from '@/components/courses/CoursesContent';
import type { CourseCard, User } from '@/types/course';
import { cursosApi, categoriasApi, inscripcionesApi } from '@/lib/api/client';
import { getCurrentUser } from '@/lib/auth';

const API_URL = '';

interface ApiCurso {
  id: string;
  titulo: string;
  instructor_id: string;
  calificacion_prom: number;
  total_resenas?: number;
  es_gratis?: boolean;
  descripcion: string | null;
  portada_url: string | null;
  categoria_id?: string | null;
  nivel?: string | null;
  marca?: 'ram' | 'nextgen';
  bloqueado_por_licencia?: boolean;
  es_de_mi_org?: boolean;
  precio?: number | string | null;
  moneda?: string;
  destacado?: boolean;
  estado?: string;
}

interface ApiInscripcion {
  curso_id: string;
  estado: 'activa' | 'finalizada' | 'cancelado';
}

interface ApiCategoria {
  id: string;
  nombre: string;
}

const NIVEL_LABEL: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

interface ApiResponse {
  data: ApiCurso[];
  count: number;
}

const FALLBACK_USER: User = { id: '1', name: 'Usuario', initials: 'U' };

export default function CursosPage() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [user, setUser] = useState<User>(FALLBACK_USER);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [apiUser, resp, cats, insc] = await Promise.allSettled([
          getCurrentUser(),
          cursosApi.list({ limit: 100 }) as Promise<ApiResponse>,
          categoriasApi.list() as Promise<ApiCategoria[]>,
          inscripcionesApi.mis() as Promise<{ data: ApiInscripcion[] }>,
        ]);

        // Inscripciones vigentes: marcan "Inscrito" en la tarjeta y cuentan para el saludo.
        const inscripciones = insc.status === 'fulfilled' ? insc.value?.data ?? [] : [];
        const vigentes = inscripciones.filter((i) => i.estado !== 'cancelado');
        const enrolledIds = new Set(vigentes.map((i) => i.curso_id));
        setActiveCount(vigentes.filter((i) => i.estado === 'activa').length);

        if (apiUser.status === 'fulfilled') {
          const u = apiUser.value;
          const stored = localStorage.getItem(`avatar_${u.id}`);
          setUser({
            id: u.id,
            name: u.full_name || u.email,
            initials: (u.full_name || u.email).slice(0, 2).toUpperCase(),
            avatarUrl: stored || null,
          });
          if (u.organizacion?.nombre) setOrgName(u.organizacion.nombre);
        }

        const categoriaNombre = new Map<string, string>(
          cats.status === 'fulfilled' ? cats.value.map((cat) => [cat.id, cat.nombre]) : []
        );

        if (resp.status === 'fulfilled') {
          // El catálogo solo muestra cursos publicados (el admin ve borradores en su panel).
          const cards: CourseCard[] = resp.value.data
            .filter((c) => !c.estado || c.estado === 'publicado')
            .map((c) => ({
            id: c.id,
            title: c.titulo,
            instructor: '',
            level: (c.nivel && NIVEL_LABEL[c.nivel]) || 'No especificado',
            category: (c.categoria_id && categoriaNombre.get(c.categoria_id)) || undefined,
            rating: c.calificacion_prom || 0,
            reviews: c.total_resenas ?? 0,
            image: c.portada_url ? `${API_URL}${c.portada_url}` : '/placeholder-course.jpg',
            marca: c.marca,
            bloqueadoPorLicencia: c.bloqueado_por_licencia ?? false,
            esDeMiOrg: c.es_de_mi_org ?? false,
            precio: c.precio != null ? Number(c.precio) : null,
            moneda: c.moneda || 'MXN',
            destacado: c.destacado ?? false,
            esGratis: c.es_gratis ?? (c.precio == null || Number(c.precio) === 0),
            enrolled: enrolledIds.has(c.id),
          }));
          setCourses(cards);
        }
      } catch {
        // Si falla, las listas quedan vacías
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando cursos...</span>
      </div>
    );
  }

  return <CoursesContent courses={courses} user={user} orgName={orgName} activeCount={activeCount} />;
}
