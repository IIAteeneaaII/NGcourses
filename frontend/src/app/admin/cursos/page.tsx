'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cursosApi, categoriasApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

const API_URL = '';

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
  creado_en: string;
  portada_url: string | null;
  categoria_id?: string | null;
  nivel?: string | null;
  marca?: 'ram' | 'nextgen';
  tipo?: 'individual' | 'global';
  curso_padre_id?: string | null;
  orden_en_padre?: number;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

interface ApiCategoria {
  id: string;
  nombre: string;
}

const STATUS_LABEL: Record<string, string> = {
  publicado: 'Publicado',
  revision: 'En revisión',
  borrador: 'Borrador',
  rechazado: 'Rechazado',
  archivado: 'Archivado',
};

// Orden de las pestañas de filtro; solo se muestran las que tienen cursos.
const STATUS_ORDER = ['publicado', 'revision', 'borrador', 'rechazado', 'archivado'];

const NIVEL_LABEL: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

const MARCA_LABEL: Record<string, string> = {
  ram: 'RAM',
  nextgen: 'NextGen',
};

const dateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d);
}

function initials(titulo: string): string {
  return titulo
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || titulo.slice(0, 2).toUpperCase();
}

export default function CursosListPage() {
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [categorias, setCategorias] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiCurso | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  // Cursos globales abiertos en la tabla (muestran sus cursos debajo).
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.allSettled([
      cursosApi.list({ limit: 200 }) as Promise<ApiCursosResp>,
      categoriasApi.list() as Promise<ApiCategoria[]>,
    ]).then(([resp, cats]) => {
      if (resp.status === 'fulfilled') {
        // Más reciente primero
        const sorted = [...resp.value.data].sort((a, b) =>
          new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
        );
        setCursos(sorted);
      } else {
        logError('admin/cursos/page/load', resp.reason);
      }
      if (cats.status === 'fulfilled' && Array.isArray(cats.value)) {
        setCategorias(Object.fromEntries(cats.value.map((c) => [c.id, c.nombre])));
      }
    }).finally(() => setLoading(false));
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cursos) counts[c.estado] = (counts[c.estado] ?? 0) + 1;
    return counts;
  }, [cursos]);

  // Cursos de cada curso global, en su orden.
  const hijosDe = useMemo(() => {
    const ids = new Set(cursos.filter((c) => c.tipo === 'global').map((c) => c.id));
    const map: Record<string, ApiCurso[]> = {};
    for (const c of cursos) {
      if (c.curso_padre_id && ids.has(c.curso_padre_id)) (map[c.curso_padre_id] ??= []).push(c);
    }
    Object.values(map).forEach((l) => l.sort((a, b) => (a.orden_en_padre ?? 0) - (b.orden_en_padre ?? 0)));
    return map;
  }, [cursos]);

  // Filas de primer nivel: cursos sueltos y cursos globales. Un curso que está
  // dentro de un global se muestra debajo de él. Un global aparece si él o
  // alguno de sus cursos coincide con la búsqueda y el filtro.
  const { visibles, hijosVisibles } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const coincide = (c: ApiCurso) =>
      (statusFilter === 'todos' || c.estado === statusFilter) &&
      (!q || c.titulo.toLowerCase().includes(q));
    const dentro = new Set(Object.values(hijosDe).flat().map((c) => c.id));
    const hv: Record<string, ApiCurso[]> = {};
    const top = cursos.filter((c) => {
      if (dentro.has(c.id)) return false;
      if (c.tipo !== 'global') return coincide(c);
      const hijos = hijosDe[c.id] ?? [];
      hv[c.id] = coincide(c) ? hijos : hijos.filter(coincide);
      return coincide(c) || hv[c.id].length > 0;
    });
    return { visibles: top, hijosVisibles: hv };
  }, [cursos, hijosDe, search, statusFilter]);

  const toggleAbierto = (id: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await cursosApi.delete(id);
      // Si era un curso global, sus cursos quedan sueltos (no se borran).
      setCursos((prev) => prev
        .filter((c) => c.id !== id)
        .map((c) => (c.curso_padre_id === id ? { ...c, curso_padre_id: null } : c)));
      setDeleteConfirm(null);
    } catch (err: unknown) {
      logError('admin/cursos/page/delete', err);
      const apiErr = err as { detail?: string };
      setDeleteError(apiErr?.detail || 'Error al eliminar el curso.');
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    setDeleteConfirm(null);
    setDeleteError('');
  };

  const publicados = statusCounts.publicado ?? 0;
  const tabs = ['todos', ...STATUS_ORDER.filter((s) => statusCounts[s])];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cursos</h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Cargando…'
              : `${cursos.length} ${cursos.length === 1 ? 'curso' : 'cursos'} · ${publicados} ${publicados === 1 ? 'publicado' : 'publicados'}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/cursos/global/nuevo" className={styles.secondaryButton}>
            Nuevo curso global
          </Link>
          <Link href="/admin/cursos/crear" className={styles.primaryButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo curso
          </Link>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Filtrar por estado">
          {tabs.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              className={`${styles.tab} ${statusFilter === s ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABEL[s] ?? s}
              <span className={styles.tabCount}>{s === 'todos' ? cursos.length : statusCounts[s]}</span>
            </button>
          ))}
        </div>

        <label className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Buscar curso"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Buscar curso por nombre"
          />
        </label>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.emptyState}>Cargando cursos…</div>
        ) : visibles.length === 0 ? (
          <div className={styles.emptyState}>
            {cursos.length === 0 ? (
              <>
                <p className={styles.emptyTitle}>Todavía no hay cursos</p>
                <p className={styles.emptyText}>Crea el primero y aparecerá aquí.</p>
                <Link href="/admin/cursos/crear" className={styles.primaryButton}>Nuevo curso</Link>
              </>
            ) : (
              <>
                <p className={styles.emptyTitle}>Sin resultados</p>
                <p className={styles.emptyText}>Ningún curso coincide con la búsqueda o el filtro.</p>
              </>
            )}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Curso</th>
                <th scope="col">Estado</th>
                <th scope="col">Creado</th>
                <th scope="col"><span className={styles.srOnly}>Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.flatMap((top) => {
                const esGlobal = top.tipo === 'global';
                const hijos = esGlobal ? hijosVisibles[top.id] ?? [] : [];
                const abierto = esGlobal && (abiertos.has(top.id) || (search.trim() !== '' && hijos.length > 0));
                const filas = [{ course: top, hijo: false, pos: 0 }];
                if (abierto) hijos.forEach((h, i) => filas.push({ course: h, hijo: true, pos: i + 1 }));
                const total = (hijosDe[top.id] ?? []).length;
                return filas.map(({ course, hijo, pos }) => {
                const meta = hijo
                  ? [`Curso ${pos} de ${total}`, course.nivel ? NIVEL_LABEL[course.nivel] ?? course.nivel : null].filter(Boolean).join(' · ')
                  : course.tipo === 'global'
                    ? [`Curso global · ${total} ${total === 1 ? 'curso' : 'cursos'}`, course.nivel ? NIVEL_LABEL[course.nivel] ?? course.nivel : null, course.marca ? MARCA_LABEL[course.marca] : null].filter(Boolean).join(' · ')
                    : null;
                const metaNormal = [
                  course.categoria_id ? categorias[course.categoria_id] : null,
                  course.nivel ? NIVEL_LABEL[course.nivel] ?? course.nivel : null,
                  course.marca ? MARCA_LABEL[course.marca] : null,
                ].filter(Boolean).join(' · ');
                const metaFila = meta ?? metaNormal;
                const publicado = course.estado === 'publicado';
                const editarHref = course.tipo === 'global'
                  ? `/admin/cursos/global/${course.id}`
                  : `/admin/cursos/${course.id}/editar`;
                return (
                  <tr key={course.id} className={hijo ? styles.childRow : undefined}>
                    <td>
                      <div className={`${styles.courseCell} ${hijo ? styles.childCell : ''}`}>
                        {!hijo && (course.tipo === 'global' ? (
                          <button
                            type="button"
                            className={styles.disclosure}
                            aria-expanded={abierto}
                            aria-label={`${abierto ? 'Ocultar' : 'Mostrar'} los cursos de ${course.titulo}`}
                            onClick={() => toggleAbierto(course.id)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 6l7 6-7 6z" /></svg>
                          </button>
                        ) : (Object.keys(hijosDe).length > 0 && <span className={styles.disclosureSpace} aria-hidden="true" />))}
                        {course.portada_url ? (
                          <img src={`${API_URL}${course.portada_url}`} alt="" className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbFallback} aria-hidden="true">{initials(course.titulo)}</span>
                        )}
                        <div className={styles.courseText}>
                          <Link href={editarHref} className={styles.courseTitle}>
                            {course.titulo}
                          </Link>
                          {metaFila && <span className={styles.courseMeta}>{metaFila}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles[`status_${course.estado}`] ?? ''}`}>
                        {STATUS_LABEL[course.estado] ?? course.estado}
                      </span>
                    </td>
                    <td className={styles.dateCell}>{formatDate(course.creado_en)}</td>
                    <td>
                      <div className={styles.actions}>
                        {publicado ? (
                          <Link href={`/admin/cursos/${course.id}/invitaciones`} className={styles.ghostButton}>
                            Invitaciones
                          </Link>
                        ) : (
                          <span
                            className={`${styles.ghostButton} ${styles.disabled}`}
                            aria-disabled="true"
                            title="Publica el curso para poder invitar"
                          >
                            Invitaciones
                          </span>
                        )}
                        <Link href={editarHref} className={styles.secondaryButton}>
                          Editar
                        </Link>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => { setDeleteError(''); setDeleteConfirm(course); }}
                          aria-label={`Eliminar ${course.titulo}`}
                          title="Eliminar curso"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                });
              })}
            </tbody>
          </table>
        )}
      </div>

      {deleteConfirm && (
        <div className={styles.backdrop} onClick={closeDelete}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-title" className={styles.dialogTitle}>Eliminar curso</h2>
            <p className={styles.dialogText}>
              Se eliminará <strong>{deleteConfirm.titulo}</strong>. Esta acción no se puede deshacer.
              {deleteConfirm.tipo === 'global' && ' Los cursos que tiene dentro no se borran: quedan sueltos.'}
            </p>
            {deleteError && <p className={styles.dialogError}>{deleteError}</p>}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeDelete}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
