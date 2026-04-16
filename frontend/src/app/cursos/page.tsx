'use client';

import { useEffect, useState } from 'react';
import CoursesContent from '@/components/courses/CoursesContent';
import type { CourseCard, User } from '@/types/course';
import { cursosApi } from '@/lib/api/client';
import { getCurrentUser } from '@/lib/auth';

const API_URL = '';

interface ApiCurso {
  id: string;
  titulo: string;
  instructor_id: string;
  calificacion_prom: number;
  descripcion: string | null;
  portada_url: string | null;
  marca?: 'RAM' | 'NEXTGEN';
}

interface ApiResponse {
  data: ApiCurso[];
  count: number;
}

const FALLBACK_USER: User = { id: '1', name: 'Usuario', initials: 'U' };

export default function CursosPage() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [user, setUser] = useState<User>(FALLBACK_USER);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [apiUser, resp] = await Promise.allSettled([
          getCurrentUser(),
          cursosApi.list({ limit: 100 }) as Promise<ApiResponse>,
        ]);

        if (apiUser.status === 'fulfilled') {
          const u = apiUser.value;
          setUser({
            id: u.id,
            name: u.full_name || u.email,
            initials: (u.full_name || u.email).slice(0, 2).toUpperCase(),
          });
          if (u.organizacion?.nombre) setOrgName(u.organizacion.nombre);
        }

        if (resp.status === 'fulfilled') {
          const cards: CourseCard[] = resp.value.data.map((c) => ({
            id: c.id,
            title: c.titulo,
            instructor: '',
            level: 'Intermedio',
            rating: c.calificacion_prom || 0,
            image: c.portada_url ? `${API_URL}${c.portada_url}` : '/placeholder-course.jpg',
            marca: c.marca,
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

  return <CoursesContent courses={courses} user={user} orgName={orgName} />;
}
