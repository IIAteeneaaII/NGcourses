'use client';

import { useEffect, useState } from 'react';
import ProfileContent from '@/components/profile/ProfileContent';
import { authApi, cursosApi, inscripcionesApi } from '@/lib/api/client';
import type { UserProfile, UserStatistics, CourseInProgress } from '@/types/course';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  telefono: string | null;
}

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

interface ApiCurso {
  id: string;
  titulo: string;
  duracion_seg: number;
}

const EMPTY_PROFILE: UserProfile = {
  id: '',
  name: 'Usuario',
  initials: 'U',
  email: '',
  phone: '',
  department: '',
  position: '',
  registrationDate: '',
};

const EMPTY_STATS: UserStatistics = {
  coursesEnrolled: 0,
  coursesCompleted: 0,
  totalTime: '0h',
};

export default function PerfilPage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [statistics, setStatistics] = useState<UserStatistics>(EMPTY_STATS);
  const [coursesInProgress, setCoursesInProgress] = useState<CourseInProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRaw, inscResp] = await Promise.all([
          authApi.me() as Promise<ApiUser>,
          inscripcionesApi.mis().catch(() => ({ data: [], count: 0 })) as Promise<ApiInscripcionesResp>,
        ]);

        const nombre = userRaw.full_name || userRaw.email.split('@')[0];
        const initials = nombre
          .split(' ')
          .slice(0, 2)
          .map((w: string) => w[0]?.toUpperCase() ?? '')
          .join('');

        setProfile({
          id: userRaw.id,
          name: nombre,
          initials: initials || 'U',
          email: userRaw.email,
          phone: userRaw.telefono || '',
          department: '',
          position: '',
          registrationDate: '',
        });

        const inscripciones = inscResp.data;
        const completed = inscripciones.filter((i) => i.estado === 'finalizada').length;

        // Obtener cursos activos para la lista "en progreso"
        const activasRaw = inscripciones.filter((i) => i.estado === 'activa').slice(0, 5);
        const cursoDetails = await Promise.allSettled(
          activasRaw.map((i) => cursosApi.get(i.curso_id) as Promise<ApiCurso>)
        );

        const inProgress: CourseInProgress[] = activasRaw.map((insc, idx) => {
          const res = cursoDetails[idx];
          const titulo = res.status === 'fulfilled' ? res.value.titulo : 'Curso';
          return { id: insc.curso_id, title: titulo, progress: 0, order: idx + 1 };
        });

        const totalSeg = cursoDetails.reduce((acc, res) => {
          return acc + (res.status === 'fulfilled' ? (res.value.duracion_seg ?? 0) : 0);
        }, 0);

        setCoursesInProgress(inProgress);
        setStatistics({
          coursesEnrolled: inscripciones.length,
          coursesCompleted: completed,
          totalTime: `${Math.round(totalSeg / 3600)}h`,
        });
      } catch {
        // Fallo silencioso — mostrar vacío
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando perfil...</span>
      </div>
    );
  }

  return (
    <ProfileContent
      profile={profile}
      statistics={statistics}
      coursesInProgress={coursesInProgress}
    />
  );
}
