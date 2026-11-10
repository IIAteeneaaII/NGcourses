'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cursosApi, type ApiError } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import list from '../../page.module.css';
import styles from './page.module.css';

/**
 * Alta y edición de un curso global: un curso sin módulos que agrupa cursos
 * existentes en un orden. /admin/cursos/global/nuevo crea uno nuevo.
 * Los cursos que se agregan no cambian: conservan sus módulos, alumnos y avance.
 */

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  marca?: 'ram' | 'nextgen';
  nivel?: string | null;
  portada_url?: string | null;
  tipo?: 'individual' | 'global';
  curso_padre_id?: string | null;
  orden_en_padre?: number;
}

interface ApiSubcurso {
  id: string;
  titulo: string;
  estado: string;
}

const STATUS_LABEL: Record<string, string> = {
  publicado: 'Publicado',
  revision: 'En revisión',
  borrador: 'Borrador',
  rechazado: 'Rechazado',
  archivado: 'Archivado',
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') +
    '-' +
    Date.now()
  );
}

const ArrowUp = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" /></svg>
);
const ArrowDown = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
);
const Cross = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
);

export default function CursoGlobalPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;
  const esNuevo = routeId === 'nuevo';

  const [cursoId, setCursoId] = useState<string | null>(esNuevo ? null : routeId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState<'ram' | 'nextgen'>('ram');
  const [nivel, setNivel] = useState('principiante');
  const [estado, setEstado] = useState('borrador');
  const [portada, setPortada] = useState<string | null>(null);

  const [todos, setTodos] = useState<ApiCurso[]>([]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const lista = await cursosApi.list({ limit: 500 }) as { data: ApiCurso[] };
        if (!active) return;
        setTodos(lista.data ?? []);
        if (!esNuevo) {
          const c = await cursosApi.get(routeId) as ApiCurso & { subcursos?: ApiSubcurso[] };
          if (!active) return;
          if (c.tipo !== 'global') {
            router.replace(`/admin/cursos/${routeId}/editar`);
            return;
          }
          setTitulo(c.titulo);
          setDescripcion(c.descripcion ?? '');
          setMarca(c.marca ?? 'ram');
          setNivel(c.nivel ?? 'principiante');
          setEstado(c.estado);
          setPortada(c.portada_url ?? null);
          setSeleccion((c.subcursos ?? []).map((s) => s.id));
        }
      } catch (e) {
        logError('admin/cursos/global/load', e);
        if (active) setError('No se pudo cargar el curso.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [esNuevo, routeId, router]);

  const porId = useMemo(() => Object.fromEntries(todos.map((c) => [c.id, c])), [todos]);
  const globales = useMemo(() => Object.fromEntries(
    todos.filter((c) => c.tipo === 'global').map((c) => [c.id, c.titulo]),
  ), [todos]);

  // Cursos que se pueden agregar: los normales que no están en otro global.
  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return todos
      .filter((c) => c.tipo !== 'global' && c.id !== cursoId)
      .filter((c) => !q || c.titulo.toLowerCase().includes(q))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [todos, busqueda, cursoId]);

  const enOtroGlobal = (c: ApiCurso) =>
    !!c.curso_padre_id && c.curso_padre_id !== cursoId && !!globales[c.curso_padre_id];

  const toggleCurso = (id: string) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const mover = (i: number, d: -1 | 1) =>
    setSeleccion((prev) => {
      const n = [...prev];
      const j = i + d;
      if (j < 0 || j >= n.length) return prev;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const publicadosIncluidos = seleccion.filter((id) => porId[id]?.estado === 'publicado').length;

  async function guardar(nuevoEstado: string) {
    setError('');
    setAviso('');
    if (!titulo.trim()) {
      setError('Escribe el título del curso global.');
      return;
    }
    if (nuevoEstado === 'publicado' && publicadosIncluidos === 0) {
      setError('Para publicar, incluye al menos un curso publicado.');
      return;
    }
    setSaving(true);
    try {
      let id = cursoId;
      const datos = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        marca,
        nivel,
      };
      if (!id) {
        const creado = await cursosApi.create({
          ...datos,
          slug: slugify(titulo),
          tipo: 'global',
          estado: 'borrador',
          es_gratis: true,
        }) as { id: string };
        id = creado.id;
        setCursoId(id);
      } else {
        await cursosApi.update(id, datos);
      }
      await cursosApi.setSubcursos(id, seleccion);
      if (nuevoEstado !== estado) {
        await cursosApi.update(id, { estado: nuevoEstado });
        setEstado(nuevoEstado);
      }
      setAviso(nuevoEstado === 'publicado' ? 'Curso global publicado.' : 'Cambios guardados.');
      if (esNuevo) router.replace(`/admin/cursos/global/${id}`);
    } catch (e) {
      logError('admin/cursos/global/save', e);
      setError((e as ApiError)?.detail || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  async function subirPortada(file: File) {
    if (!cursoId) return;
    try {
      const r = await cursosApi.uploadCover(cursoId, file) as { portada_url?: string };
      setPortada(r.portada_url ?? null);
    } catch (e) {
      logError('admin/cursos/global/cover', e);
      setError((e as ApiError)?.detail || 'No se pudo subir la portada.');
    }
  }

  if (loading) return <div className={list.page}><p className={list.subtitle}>Cargando…</p></div>;

  return (
    <div className={list.page}>
      <header className={list.header}>
        <div>
          <Link href="/admin/cursos" className={styles.back}>Cursos</Link>
          <h1 className={list.title}>{esNuevo && !cursoId ? 'Nuevo curso global' : titulo || 'Curso global'}</h1>
          <p className={list.subtitle}>
            Curso global · {STATUS_LABEL[estado] ?? estado} · {seleccion.length} {seleccion.length === 1 ? 'curso' : 'cursos'}
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="info-title">
            <h2 id="info-title" className={styles.cardTitle}>Información básica</h2>
            <label className={styles.field}>
              <span>Título</span>
              <input className={styles.input} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Por ejemplo: Testeo" />
            </label>
            <label className={styles.field}>
              <span>Descripción</span>
              <textarea className={`${styles.input} ${styles.textarea}`} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Marca</span>
                <select className={styles.input} value={marca} onChange={(e) => setMarca(e.target.value as 'ram' | 'nextgen')}>
                  <option value="ram">RAM</option>
                  <option value="nextgen">NextGen</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Nivel</span>
                <select className={styles.input} value={nivel} onChange={(e) => setNivel(e.target.value)}>
                  <option value="principiante">Principiante</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="incluidos-title">
            <div className={styles.cardHead}>
              <h2 id="incluidos-title" className={styles.cardTitle}>Cursos incluidos</h2>
              <span className={styles.hint}>El alumno los ve en este orden</span>
            </div>
            {seleccion.length === 0 ? (
              <p className={styles.empty}>Todavía no hay cursos. Márcalos en la lista de la derecha.</p>
            ) : (
              <ol className={styles.included}>
                {seleccion.map((id, i) => {
                  const c = porId[id];
                  const t = c?.titulo ?? 'Curso';
                  return (
                    <li key={id}>
                      <span className={styles.num}>{i + 1}</span>
                      <div className={styles.incText}>
                        <span className={styles.incTitle}>{t}</span>
                        <span className={styles.incMeta}>{c ? STATUS_LABEL[c.estado] ?? c.estado : ''}</span>
                      </div>
                      <div className={styles.order}>
                        <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${t}`}>{ArrowUp}</button>
                        <button type="button" onClick={() => mover(i, 1)} disabled={i === seleccion.length - 1} aria-label={`Bajar ${t}`}>{ArrowDown}</button>
                        <button type="button" onClick={() => toggleCurso(id)} aria-label={`Quitar ${t} del curso global`}>{Cross}</button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className={styles.hint}>
              Quitar un curso no lo borra: vuelve a aparecer suelto y sus alumnos conservan su avance.
              Los alumnos que ya están en un curso no se inscriben solos en los demás.
            </p>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="agregar-title">
            <h2 id="agregar-title" className={styles.cardTitle}>Agregar cursos</h2>
            <input
              type="search"
              className={styles.input}
              placeholder="Buscar curso"
              aria-label="Buscar curso para agregar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className={styles.picker}>
              {candidatos.length === 0 && <p className={styles.empty}>No hay cursos que coincidan.</p>}
              {candidatos.map((c) => {
                const ocupado = enOtroGlobal(c);
                return (
                  <label key={c.id} className={`${styles.pick} ${ocupado ? styles.pickTaken : ''}`}>
                    <input
                      type="checkbox"
                      checked={seleccion.includes(c.id)}
                      disabled={ocupado}
                      onChange={() => toggleCurso(c.id)}
                    />
                    <span>{c.titulo}</span>
                    <small>{ocupado ? `Ya está en ${globales[c.curso_padre_id as string]}` : STATUS_LABEL[c.estado] ?? c.estado}</small>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="portada-title">
            <h2 id="portada-title" className={styles.cardTitle}>Portada</h2>
            {portada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portada} alt="Portada actual" className={styles.cover} />
            )}
            {cursoId ? (
              <label className={list.secondaryButton}>
                {portada ? 'Cambiar imagen' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={styles.fileInput}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPortada(f); }}
                />
              </label>
            ) : (
              <p className={styles.hint}>Guarda el curso primero para subir su portada.</p>
            )}
          </section>
        </div>
      </div>

      <footer className={styles.footer}>
        <div role="status" aria-live="polite" className={error ? styles.error : styles.ok}>{error || aviso}</div>
        <div className={styles.footerActions}>
          {estado === 'publicado' ? (
            <>
              <button type="button" className={list.secondaryButton} onClick={() => guardar('borrador')} disabled={saving}>
                Pasar a borrador
              </button>
              <button type="button" className={list.primaryButton} onClick={() => guardar('publicado')} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={list.secondaryButton} onClick={() => guardar(estado)} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button type="button" className={list.primaryButton} onClick={() => guardar('publicado')} disabled={saving}>
                Publicar
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
