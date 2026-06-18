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
  total_resenas: number;
  modulos: ApiModulo[];
  portada_url: string | null;
  estado: string;
  nivel: string | null;
  instructor_nombre: string | null;
  lo_que_aprenderas?: string[];
  requisitos?: string | null;
}

const nivelLabel: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

const API_URL = '';

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
  const [nota, setNota] = useState('');
  const [notaError, setNotaError] = useState('');

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
          instructor: cursoRaw.instructor_nombre || '',
          rating: cursoRaw.calificacion_prom ?? 0,
          reviewsCount: cursoRaw.total_resenas ?? 0,
          level: (cursoRaw.nivel && nivelLabel[cursoRaw.nivel]) || 'No especificado',
          duration: `${duracionHoras}h`,
          lessonsCount: totalLecciones,
          description: cursoRaw.descripcion || '',
          learningOutcomes: cursoRaw.lo_que_aprenderas ?? [],
          requirements: cursoRaw.requisitos || '',
          syllabus: cursoRaw.modulos?.map((m: ApiModulo) => m.titulo || '') ?? [],
          image: cursoRaw.portada_url ? `${API_URL}${cursoRaw.portada_url}` : '/placeholder-course.jpg',
        });
      })
      .catch(() => setHasError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: ActionType) => {
    if (action === 'solicitar_cambios' && !nota.trim()) {
      setNotaError('Describe los cambios solicitados.');
      return;
    }
    setActionLoading(action);
    try {
      if (action === 'publicar') {
        await cursosApi.update(id, { estado: 'publicado' });
      } else if (action === 'solicitar_cambios') {
        await cursosApi.update(id, { estado: 'borrador', notas_revision: nota.trim() });
      } else if (action === 'rechazar') {
        // No se elimina: el curso se conserva en estado 'rechazado' con el motivo.
        await cursosApi.update(id, { estado: 'rechazado', notas_revision: nota.trim() || undefined });
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
    solicitar_cambios: 'El curso regresará al instructor como borrador con tus notas.',
    rechazar: 'El curso se marcará como rechazado (no se elimina) y volverá al instructor con el motivo.',
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
      {/* Barra admin — no sticky: al hacer scroll no debe superponerse al contenido. */}
      <div style={{
        position: 'relative',
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Volver a solicitudes
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
          onClick={() => { setConfirmAction(null); setNota(''); setNotaError(''); }}
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
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
              {actionMsg[confirmAction]}
            </p>
            {(confirmAction === 'solicitar_cambios' || confirmAction === 'rechazar') && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  {confirmAction === 'solicitar_cambios' ? 'Cambios solicitados *' : 'Motivo del rechazo (opcional)'}
                </label>
                <textarea
                  value={nota}
                  onChange={(e) => { setNota(e.target.value); setNotaError(''); }}
                  rows={3}
                  placeholder={confirmAction === 'solicitar_cambios' ? 'Ej: Faltan subtítulos en el módulo 2 y la descripción es muy corta.' : 'Ej: El contenido no cumple los lineamientos.'}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
                {notaError && <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#dc2626' }}>{notaError}</p>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmAction(null); setNota(''); setNotaError(''); }}
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
