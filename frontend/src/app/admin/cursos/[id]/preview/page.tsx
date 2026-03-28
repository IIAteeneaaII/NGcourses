'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import CourseInfoContent from '@/components/course/CourseInfoContent';
import { cursosApi } from '@/lib/api/client';
import type { CourseInfo } from '@/types/course';

interface ApiModulo {
  titulo?: string;
  lecciones: unknown[];
}

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  duracion_seg: number;
  calificacion_prom: number;
  modulos: ApiModulo[];
  portada_url: string | null;
  estado: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type ActionType = 'publicar' | 'solicitar_cambios' | 'rechazar';

export default function AdminCursoPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
  const [confirmAction, setConfirmAction] = useState<ActionType | null>(null);

  useEffect(() => {
    cursosApi.get(id)
      .then((raw) => {
        const cursoRaw = raw as ApiCurso;
        const totalLecciones = cursoRaw.modulos?.reduce(
          (acc: number, m: ApiModulo) => acc + m.lecciones.length,
          0
        ) ?? 0;
        const duracionHoras = Math.round((cursoRaw.duracion_seg ?? 0) / 3600);

        setCourse({
          id: cursoRaw.id,
          title: cursoRaw.titulo,
          instructor: '',
          rating: cursoRaw.calificacion_prom ?? 0,
          level: 'Todos los niveles',
          duration: `${duracionHoras}h`,
          lessonsCount: totalLecciones,
          description: cursoRaw.descripcion || '',
          learningOutcomes: [],
          requirements: '',
          syllabus: cursoRaw.modulos?.map((m: ApiModulo) => m.titulo || '') ?? [],
          image: cursoRaw.portada_url ? `${API_URL}${cursoRaw.portada_url}` : '/placeholder-course.jpg',
        });
      })
      .catch(() => setHasError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: ActionType) => {
    setActionLoading(action);
    try {
      if (action === 'publicar') {
        await cursosApi.update(id, { estado: 'publicado' });
      } else if (action === 'solicitar_cambios') {
        await cursosApi.update(id, { estado: 'borrador' });
      } else if (action === 'rechazar') {
        await cursosApi.delete(id);
      }
      router.push('/admin/solicitudes');
    } catch {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const actionLabel: Record<ActionType, string> = {
    publicar: 'Publicar',
    solicitar_cambios: 'Solicitar cambios',
    rechazar: 'Rechazar',
  };

  const actionMsg: Record<ActionType, string> = {
    publicar: 'El curso quedará visible para los estudiantes inmediatamente.',
    solicitar_cambios: 'El curso regresará al instructor como borrador.',
    rechazar: 'El curso y todo su contenido serán eliminados permanentemente.',
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
    <>
      {/* Barra admin */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--color-secondary-30)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.push('/admin/solicitudes')}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              borderRadius: '0.4rem',
              padding: '0.4rem 0.9rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            ← Volver a solicitudes
          </button>
          <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>
            Vista previa del curso &mdash; tal como lo ve el alumno
          </span>
          <button
            onClick={() => router.push(`/curso/${id}/videos?from=admin`)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff',
              borderRadius: '0.4rem',
              padding: '0.4rem 0.9rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ▶ Ver videos y recursos
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            disabled={!!actionLoading}
            onClick={() => setConfirmAction('publicar')}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: '#d1fae5',
              color: '#065f46',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Publicar
          </button>
          <button
            disabled={!!actionLoading}
            onClick={() => setConfirmAction('solicitar_cambios')}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: '#dbeafe',
              color: '#1e40af',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Solicitar cambios
          </button>
          <button
            disabled={!!actionLoading}
            onClick={() => setConfirmAction('rechazar')}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: '#fee2e2',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Rechazar
          </button>
        </div>
      </div>

      {/* Vista del curso (igual que alumno) */}
      <CourseInfoContent course={course} backHref="/admin/solicitudes" />

      {/* Modal de confirmación */}
      {confirmAction && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '0.9375rem', padding: '2rem',
              maxWidth: '440px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 700 }}>
              {actionLabel[confirmAction]}: &ldquo;{course.title}&rdquo;
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
              {actionMsg[confirmAction]}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: '0.5rem 1.25rem', border: '1.5px solid #e2e8f0',
                  borderRadius: '0.5rem', background: '#fff', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Cancelar
              </button>
              <button
                disabled={!!actionLoading}
                onClick={() => handleAction(confirmAction)}
                style={{
                  padding: '0.5rem 1.25rem', border: 'none', borderRadius: '0.5rem',
                  background: confirmAction === 'rechazar' ? '#fee2e2' : confirmAction === 'publicar' ? '#d1fae5' : '#dbeafe',
                  color: confirmAction === 'rechazar' ? '#991b1b' : confirmAction === 'publicar' ? '#065f46' : '#1e40af',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
                  opacity: actionLoading ? 0.5 : 1,
                }}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
