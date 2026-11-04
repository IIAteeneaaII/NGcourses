import type { SyllabusModule } from '@/types/course';

interface ApiLeccionLike {
  id?: string;
  titulo?: string;
  tipo?: string;
  orden?: number;
  duracion_seg?: number;
}

interface ApiModuloLike {
  titulo?: string;
  orden?: number;
  lecciones?: ApiLeccionLike[];
}

const byOrden = (a: { orden?: number }, b: { orden?: number }) => (a.orden ?? 0) - (b.orden ?? 0);

/** Convierte los módulos del API en el temario (módulos + lecciones) ordenado. */
export function toSyllabus(modulos: ApiModuloLike[] | undefined | null): SyllabusModule[] {
  return [...(modulos ?? [])].sort(byOrden).map((m) => ({
    title: m.titulo || '',
    lessons: [...(m.lecciones ?? [])].sort(byOrden).map((l) => ({
      id: l.id,
      title: l.titulo || '',
      tipo: l.tipo,
      durationSec: l.duracion_seg,
    })),
  }));
}
