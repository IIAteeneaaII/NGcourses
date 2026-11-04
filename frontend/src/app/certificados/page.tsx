'use client';

import { useEffect, useState } from 'react';
import CertificatesContent, {
  type StudentCertificate,
  type UpcomingCertificate,
} from '@/components/certificates/CertificatesContent';
import { certificadosApi, cursosApi, inscripcionesApi, progresoApi } from '@/lib/api/client';
import { getCurrentUser } from '@/lib/auth';

interface ApiCertificado {
  curso_id: string;
  folio: string;
  emitido_en: string;
}

interface ApiInscripcion {
  curso_id: string;
  estado: 'activa' | 'finalizada' | 'cancelado';
}

interface ApiCurso {
  id: string;
  titulo: string;
  marca?: 'ram' | 'nextgen';
  portada_url?: string | null;
}

interface ApiProgreso {
  total_lecciones: number;
  lecciones_completadas: number;
  progreso_pct: number;
}

export default function CertificadosPage() {
  const [studentName, setStudentName] = useState('');
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [apiUser, certResp, inscResp] = await Promise.allSettled([
          getCurrentUser(),
          certificadosApi.mis() as Promise<{ data: ApiCertificado[] }>,
          inscripcionesApi.mis() as Promise<{ data: ApiInscripcion[] }>,
        ]);

        if (apiUser.status === 'fulfilled' && apiUser.value) {
          setStudentName(apiUser.value.full_name || apiUser.value.email);
        }

        const certs = certResp.status === 'fulfilled' ? certResp.value?.data ?? [] : [];
        const certCursoIds = new Set(certs.map((c) => c.curso_id));
        const inscripciones = inscResp.status === 'fulfilled' ? inscResp.value?.data ?? [] : [];
        // CP20: si el curso recibió lecciones nuevas, el backend vuelve la inscripción
        // a ACTIVA y la descarga responde 409 hasta completarlas.
        const pendientes = new Set(
          inscripciones.filter((i) => i.estado === 'activa').map((i) => i.curso_id)
        );
        // Próximos certificados: cursos activos que aún no tienen certificado.
        const activos = inscripciones.filter((i) => i.estado === 'activa' && !certCursoIds.has(i.curso_id));

        const cursoIds = Array.from(new Set([...certs.map((c) => c.curso_id), ...activos.map((i) => i.curso_id)]));
        const cursoResults = await Promise.allSettled(
          cursoIds.map((id) => cursosApi.get(id) as Promise<ApiCurso>)
        );
        const cursoById = new Map<string, ApiCurso>();
        cursoResults.forEach((r, idx) => {
          if (r.status === 'fulfilled' && r.value) cursoById.set(cursoIds[idx], r.value);
        });

        setCertificates(
          certs
            .map((c) => {
              const curso = cursoById.get(c.curso_id);
              return {
                folio: c.folio,
                courseId: c.curso_id,
                courseTitle: curso?.titulo ?? 'Curso',
                marca: curso?.marca,
                issuedAt: c.emitido_en,
                pending: pendientes.has(c.curso_id),
              };
            })
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
        );

        const progresos = await Promise.allSettled(
          activos.map((i) => progresoApi.curso(i.curso_id) as Promise<ApiProgreso>)
        );
        setUpcoming(
          activos
            .map((i, idx) => {
              const pr = progresos[idx];
              const p = pr.status === 'fulfilled' && pr.value ? pr.value : null;
              return {
                courseId: i.curso_id,
                courseTitle: cursoById.get(i.curso_id)?.titulo ?? 'Curso',
                progress: Math.round(p?.progreso_pct ?? 0),
                lessonsLeft: p ? Math.max(p.total_lecciones - p.lecciones_completadas, 0) : null,
              };
            })
            // Solo los que ya empezaron; el más cercano a terminar primero.
            .filter((u) => u.progress > 0)
            .sort((a, b) => (a.lessonsLeft ?? Infinity) - (b.lessonsLeft ?? Infinity))
        );
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
        <span>Cargando certificados...</span>
      </div>
    );
  }

  return <CertificatesContent studentName={studentName} certificates={certificates} upcoming={upcoming} />;
}
