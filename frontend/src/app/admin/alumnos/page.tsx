'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usersApi, cursosApi, inscripcionesApi, quizApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ApiAlumno {
  id: string;
  full_name: string | null;
  email: string;
  estado: 'activo' | 'suspendido';
}

interface ApiCurso {
  id: string;
  titulo: string;
}

interface ApiInscripcion {
  id: string;
  usuario_id: string;
  curso_id: string;
  estado: 'activa' | 'finalizada' | 'cancelado';
  inscrito_en: string;
  usuario_nombre?: string | null;
  usuario_email?: string | null;
  usuario_rol?: string | null;
}

interface ApiUsersResp { data: ApiAlumno[]; count: number }
interface ApiCursosResp { data: ApiCurso[]; count: number }
interface ApiInscripcionesResp { data: ApiInscripcion[]; count: number }

interface CursoConConteo extends ApiCurso { total: number }

interface QuizResultadoAlumno {
  intento_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  leccion_id: string;
  leccion_titulo: string;
  aprobado: boolean;
  total_preguntas: number;
  correctas: number;
  creado_en: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

function getInitials(alumno: ApiAlumno) {
  const name = alumno.full_name || alumno.email;
  return name.slice(0, 2).toUpperCase();
}

function getNombre(alumno: ApiAlumno) {
  return alumno.full_name || alumno.email;
}

// Resuelve la identidad del inscrito. Prioriza el nombre/email que ya entrega la
// API por inscripción (sirve para cualquier usuario, no solo los de rol estudiante);
// si no está en la lista local, lo reconstruye. Devuelve null solo si la cuenta fue
// eliminada (la API no trae nombre ni email → inscripción huérfana).
function resolveAlumno(
  insc: ApiInscripcion,
  alumnosMap: Record<string, ApiAlumno>
): ApiAlumno | null {
  const local = alumnosMap[insc.usuario_id];
  if (local) return local;
  if (insc.usuario_nombre || insc.usuario_email) {
    return {
      id: insc.usuario_id,
      full_name: insc.usuario_nombre ?? null,
      email: insc.usuario_email ?? '',
      estado: 'activo',
    };
  }
  return null;
}

// ── Componente ─────────────────────────────────────────────────────────────────

const QUIZ_ITEMS_PER_PAGE = 10;

export default function AlumnosAdminPage() {
  const [activeTab, setActiveTab] = useState<'lista' | 'estadisticas' | 'quiz'>('lista');

  // Datos base (cargados al montar)
  const [alumnos, setAlumnos] = useState<ApiAlumno[]>([]);
  const [alumnosMap, setAlumnosMap] = useState<Record<string, ApiAlumno>>({});
  const [cursosMap, setCursosMap] = useState<Record<string, string>>({});
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);

  // Tab Lista
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Panel derecho (compartido)
  type PanelMode =
    | { type: 'alumno-cursos'; alumno: ApiAlumno; inscripciones: ApiInscripcion[] }
    | { type: 'curso-alumnos'; curso: CursoConConteo; inscripciones: ApiInscripcion[] }
    | { type: 'alumno-en-stats'; alumno: ApiAlumno; inscripciones: ApiInscripcion[]; desde: CursoConConteo }
    | null;

  const [panel, setPanel] = useState<PanelMode>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // Modal dar de baja
  const [bajaModal, setBajaModal] = useState<{ insc: ApiInscripcion; cursoNombre: string } | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [bajaError, setBajaError] = useState<string | null>(null);

  // Tab Estadísticas
  const [cursosConConteo, setCursosConConteo] = useState<CursoConConteo[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Tab Quiz
  const [quizResults, setQuizResults] = useState<QuizResultadoAlumno[]>([]);
  const [quizCursoId, setQuizCursoId] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizPage, setQuizPage] = useState(1);

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchBase() {
      try {
        const [usersResp, cursosResp] = await Promise.all([
          usersApi.list({ rol: 'estudiante', limit: 500 }) as Promise<ApiUsersResp>,
          cursosApi.list({ limit: 200 }) as Promise<ApiCursosResp>,
        ]);
        const listaAlumnos = usersResp.data ?? [];
        const listaCursos = cursosResp.data ?? [];

        setAlumnos(listaAlumnos);
        setAlumnosMap(Object.fromEntries(listaAlumnos.map((a) => [a.id, a])));
        setCursos(listaCursos);
        setCursosMap(Object.fromEntries(listaCursos.map((c) => [c.id, c.titulo])));
      } catch (e) {
        logError('admin/alumnos/fetchBase', e);
      } finally {
        setLoadingBase(false);
      }
    }
    fetchBase();
  }, []);

  // ── Carga lazy de estadísticas ───────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (statsLoaded || cursos.length === 0) return;
    setLoadingStats(true);
    try {
      const results = await Promise.allSettled(
        cursos.map(async (c) => {
          const resp = await inscripcionesApi.porCurso(c.id) as ApiInscripcionesResp;
          // Solo alumnos: las estadísticas excluyen inscripciones de no-alumnos
          // (instructor/supervisor/admin) o de cuentas eliminadas (rol nulo).
          const total = (resp.data ?? []).filter((i) => i.usuario_rol === 'estudiante').length;
          return { ...c, total };
        })
      );
      const conteos: CursoConConteo[] = results
        .filter((r): r is PromiseFulfilledResult<CursoConConteo> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total);
      setCursosConConteo(conteos);
      setStatsLoaded(true);
    } catch (e) {
      logError('admin/alumnos/fetchStats', e);
    } finally {
      setLoadingStats(false);
    }
  }, [cursos, statsLoaded]);

  useEffect(() => {
    if (activeTab === 'estadisticas') fetchStats();
  }, [activeTab, fetchStats]);

  // Fetch quiz results when curso changes
  const loadQuizResults = useCallback((cursoId: string, resetPage = false) => {
    setQuizLoading(true);
    quizApi.resultadosCurso(cursoId)
      .then((res) => setQuizResults(res as QuizResultadoAlumno[]))
      .catch((e) => { logError('admin/alumnos/quizResultados', e); setQuizResults([]); })
      .finally(() => setQuizLoading(false));
    if (resetPage) setQuizPage(1);
  }, []);

  useEffect(() => {
    if (activeTab !== 'quiz' || !quizCursoId) {
      setQuizResults([]);
      return;
    }
    loadQuizResults(quizCursoId, true);
  }, [activeTab, quizCursoId, loadQuizResults]);

  const handleReiniciarIntentos = async (r: QuizResultadoAlumno) => {
    if (!window.confirm(`¿Reiniciar los intentos de ${r.usuario_nombre} en "${r.leccion_titulo}"? Podrá volver a intentar el quiz desde cero.`)) return;
    try {
      await quizApi.reiniciarIntentos(r.leccion_id, r.usuario_id);
      loadQuizResults(quizCursoId);
    } catch (e) {
      logError('admin/alumnos/reiniciarIntentos', e);
      const detail = (e as { detail?: string })?.detail || 'No se pudieron reiniciar los intentos.';
      window.alert(detail);
    }
  };

  // ── Handlers panel ───────────────────────────────────────────────────────────

  const handleVerCursosAlumno = async (alumno: ApiAlumno) => {
    setPanelLoading(true);
    setPanel(null);
    try {
      const resp = await inscripcionesApi.porUsuario(alumno.id) as ApiInscripcionesResp;
      setPanel({ type: 'alumno-cursos', alumno, inscripciones: resp.data ?? [] });
    } catch {
      setPanel({ type: 'alumno-cursos', alumno, inscripciones: [] });
    } finally {
      setPanelLoading(false);
    }
  };

  const handleVerAlumnosDeCurso = async (curso: CursoConConteo) => {
    setPanelLoading(true);
    setPanel(null);
    try {
      const resp = await inscripcionesApi.porCurso(curso.id) as ApiInscripcionesResp;
      setPanel({ type: 'curso-alumnos', curso, inscripciones: resp.data ?? [] });
    } catch {
      setPanel({ type: 'curso-alumnos', curso, inscripciones: [] });
    } finally {
      setPanelLoading(false);
    }
  };

  const handleVerCursosEnStats = async (alumno: ApiAlumno, desde: CursoConConteo) => {
    setPanelLoading(true);
    try {
      const resp = await inscripcionesApi.porUsuario(alumno.id) as ApiInscripcionesResp;
      setPanel({ type: 'alumno-en-stats', alumno, inscripciones: resp.data ?? [], desde });
    } catch {
      setPanel({ type: 'alumno-en-stats', alumno, inscripciones: [], desde });
    } finally {
      setPanelLoading(false);
    }
  };

  // ── Dar de baja ──────────────────────────────────────────────────────────────

  const handleConfirmarBaja = async () => {
    if (!bajaModal) return;
    setBajaLoading(true);
    setBajaError(null);
    try {
      await inscripcionesApi.cancelar(bajaModal.insc.id);
      // Actualizar estado local en el panel
      setPanel((prev) => {
        if (!prev) return prev;
        if (prev.type === 'alumno-cursos' || prev.type === 'alumno-en-stats') {
          return {
            ...prev,
            inscripciones: prev.inscripciones.map((i) =>
              i.id === bajaModal.insc.id ? { ...i, estado: 'cancelado' as const } : i
            ),
          };
        }
        return prev;
      });
      setBajaModal(null);
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al dar de baja';
      setBajaError(msg);
      logError('admin/alumnos/darDeBaja', e);
    } finally {
      setBajaLoading(false);
    }
  };

  // ── Tab Lista: filtrado y paginación ─────────────────────────────────────────
  // ISO 25010 §6.1 Eficiencia de rendimiento: useMemo evita recalcular en cada render

  const filtrados = useMemo(() => alumnos.filter((a) => {
    const q = search.toLowerCase();
    return !q || (a.full_name ?? '').toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  }), [alumnos, search]);

  const totalPages = useMemo(() => Math.ceil(filtrados.length / ITEMS_PER_PAGE), [filtrados]);
  const paginated = useMemo(
    () => filtrados.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtrados, currentPage]
  );

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setCurrentPage(1);
  }, []);

  // ── Render panel derecho ─────────────────────────────────────────────────────

  const badgeClass = (estado: string) => {
    if (estado === 'activa') return styles.badgeActiva;
    if (estado === 'finalizada') return styles.badgeFinalizada;
    return styles.badgeCancelado;
  };

  const renderPanel = () => {
    if (panelLoading) return <p className={styles.panelLoading}>Cargando...</p>;
    if (!panel) return null;

    if (panel.type === 'alumno-cursos' || panel.type === 'alumno-en-stats') {
      const { alumno, inscripciones } = panel;
      return (
        <>
          {panel.type === 'alumno-en-stats' && (
            <button
              className={styles.panelBackBtn}
              onClick={() => setPanel({ type: 'curso-alumnos', curso: panel.desde, inscripciones: [] })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Volver a alumnos de &ldquo;{panel.desde.titulo}&rdquo;
            </button>
          )}
          <ul className={styles.panelList}>
            {inscripciones.length === 0 && (
              <li className={styles.panelLoading}>Sin inscripciones</li>
            )}
            {inscripciones.map((insc) => {
              const cursoNombre = cursosMap[insc.curso_id] ?? 'Curso desconocido';
              return (
                <li key={insc.id} className={styles.panelItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.panelItemName}>{cursoNombre}</div>
                    <div className={styles.panelItemSub}>
                      {new Date(insc.inscrito_en).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div className={styles.panelItemActions}>
                    <span className={`${styles.badge} ${badgeClass(insc.estado)}`}>
                      {insc.estado}
                    </span>
                    {insc.estado === 'activa' && (
                      <button
                        className={styles.bajaBtn}
                        title="Dar de baja"
                        onClick={() => { setBajaError(null); setBajaModal({ insc, cursoNombre }); }}
                      >
                        Dar de baja
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {alumno && <p className={styles.panelItemSub} style={{ marginTop: '1rem', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{alumno.email}</p>}
        </>
      );
    }

    if (panel.type === 'curso-alumnos') {
      // Solo alumnos: se excluyen inscripciones de no-alumnos o cuentas eliminadas.
      const inscripciones = panel.inscripciones.filter((i) => i.usuario_rol === 'estudiante');
      return (
        <ul className={styles.panelList}>
          {inscripciones.length === 0 && (
            <li className={styles.panelLoading}>Sin alumnos inscritos</li>
          )}
          {inscripciones.map((insc) => {
            const alumno = resolveAlumno(insc, alumnosMap);
            return (
              <li
                key={insc.id}
                className={`${styles.panelItem} ${alumno ? styles.clickable : ''}`}
                onClick={() => alumno && handleVerCursosEnStats(alumno, panel.curso)}
              >
                <div className={styles.alumnoCell} style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.avatar} style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' }}>
                    {alumno ? getInitials(alumno) : '—'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.panelItemName}>
                      {alumno ? getNombre(alumno) : 'Cuenta eliminada'}
                    </div>
                    {alumno?.email && <div className={styles.panelItemSub}>{alumno.email}</div>}
                  </div>
                </div>
                <span className={`${styles.badge} ${badgeClass(insc.estado)}`}>
                  {insc.estado}
                </span>
              </li>
            );
          })}
        </ul>
      );
    }

    return null;
  };

  const panelTitle = () => {
    if (!panel) return '';
    if (panel.type === 'alumno-cursos') return `Cursos de ${getNombre(panel.alumno)}`;
    if (panel.type === 'curso-alumnos') return `Alumnos en "${panel.curso.titulo}"`;
    if (panel.type === 'alumno-en-stats') return `Cursos de ${getNombre(panel.alumno)}`;
    return '';
  };

  // ── Gráfica de barras ────────────────────────────────────────────────────────

  const maxConteo = Math.max(...cursosConConteo.map((c) => c.total), 1);

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Alumnos</h1>
        <Link href="/admin" className={styles.backButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </svg>
          Inicio
        </Link>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'lista' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('lista'); setPanel(null); }}
        >
          Lista de Alumnos
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'estadisticas' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('estadisticas'); setPanel(null); }}
        >
          Estadísticas
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'quiz' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('quiz'); setPanel(null); }}
        >
          Resultados Quiz
        </button>
      </div>

      {/* Layout principal */}
      <div className={styles.pageLayout}>
        {/* Panel izquierdo (principal) */}
        <div className={styles.mainPanel}>

          {/* ── TAB LISTA ── */}
          {activeTab === 'lista' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Todos los alumnos</h2>
                <span className={styles.countBadge}>{filtrados.length} alumnos</span>
              </div>

              {/* Búsqueda */}
              <div className={styles.searchBar}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className={styles.searchInput}
                />
                {search && (
                  <button className={styles.clearSearch} onClick={() => handleSearch('')}>✕</button>
                )}
              </div>

              {/* Tabla */}
              {loadingBase ? (
                <p className={styles.emptyMsg}>Cargando alumnos...</p>
              ) : paginated.length === 0 ? (
                <p className={styles.emptyMsg}>No se encontraron alumnos.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((alumno) => {
                        const isSelected = panel?.type === 'alumno-cursos' && panel.alumno.id === alumno.id;
                        return (
                          <tr key={alumno.id}>
                            <td>
                              <div className={styles.alumnoCell}>
                                <div className={styles.avatar}>{getInitials(alumno)}</div>
                                <span className={styles.alumnoName}>{getNombre(alumno)}</span>
                              </div>
                            </td>
                            <td className={styles.alumnoEmail}>{alumno.email}</td>
                            <td>
                              <span className={`${styles.badge} ${alumno.estado === 'activo' ? styles.badgeActiva : styles.badgeCancelado}`}>
                                {alumno.estado}
                              </span>
                            </td>
                            <td>
                              <button
                                className={`${styles.verCursosBtn} ${isSelected ? styles.active : ''}`}
                                onClick={() => handleVerCursosAlumno(alumno)}
                              >
                                Ver cursos
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                    Anterior
                  </button>
                  <span className={styles.pageInfo}>{currentPage} / {totalPages}</span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    Siguiente
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB ESTADÍSTICAS ── */}
          {activeTab === 'estadisticas' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Alumnos inscritos por curso</h2>
                {!loadingStats && (
                  <span className={styles.countBadge}>{cursosConConteo.length} cursos con alumnos</span>
                )}
              </div>

              {loadingStats ? (
                <p className={styles.emptyMsg}>Cargando estadísticas...</p>
              ) : cursosConConteo.length === 0 ? (
                <p className={styles.emptyMsg}>No hay inscripciones registradas.</p>
              ) : (
                <>
                  <p className={styles.statsHeader}>
                    Haz clic en una barra para ver los alumnos de ese curso.
                  </p>
                  <div className={styles.barList}>
                    {cursosConConteo.map((curso) => {
                      const isActive = panel?.type === 'curso-alumnos' && panel.curso.id === curso.id;
                      return (
                        <div
                          key={curso.id}
                          className={`${styles.barRow} ${isActive ? styles.barRowActive : ''}`}
                          onClick={() => handleVerAlumnosDeCurso(curso)}
                          title={`${curso.titulo} — ${curso.total} alumno(s)`}
                        >
                          <span className={styles.barLabel}>{curso.titulo}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${(curso.total / maxConteo) * 100}%` }}
                            />
                          </div>
                          <span className={styles.barCount}>{curso.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {/* ── TAB QUIZ ── */}
          {activeTab === 'quiz' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Resultados de Quiz por Curso</h2>
              </div>

              <div className={styles.quizFilterRow}>
                <select
                  value={quizCursoId}
                  onChange={(e) => setQuizCursoId(e.target.value)}
                  className={styles.quizSelect}
                >
                  <option value="">Selecciona un curso</option>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                </select>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Email</th>
                      <th>Lección</th>
                      <th>Resultado</th>
                      <th>Correctas</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!quizCursoId ? (
                      <tr><td colSpan={7} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>Selecciona un curso para ver resultados.</td></tr>
                    ) : quizLoading ? (
                      <tr><td colSpan={7} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td></tr>
                    ) : quizResults.length === 0 ? (
                      <tr><td colSpan={7} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>No hay intentos de quiz en este curso.</td></tr>
                    ) : (
                      quizResults
                        .slice((quizPage - 1) * QUIZ_ITEMS_PER_PAGE, quizPage * QUIZ_ITEMS_PER_PAGE)
                        .map((r) => (
                          <tr key={r.intento_id}>
                            <td>{r.usuario_nombre}</td>
                            <td className={styles.alumnoEmail}>{r.usuario_email}</td>
                            <td>{r.leccion_titulo}</td>
                            <td>
                              <span className={`${styles.badge} ${r.aprobado ? styles.badgeActiva : styles.badgeCancelado}`}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {r.aprobado ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                  )}
                                  {r.aprobado ? 'Aprobado' : 'Reprobado'}
                                </span>
                              </span>
                            </td>
                            <td>{r.correctas}/{r.total_preguntas}</td>
                            <td>{r.creado_en ? r.creado_en.slice(0, 10) : '—'}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.quizResetBtn}
                                onClick={() => handleReiniciarIntentos(r)}
                                title="Reiniciar los intentos del alumno en este quiz"
                              >
                                Reiniciar intentos
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE) > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setQuizPage((p) => Math.max(1, p - 1))}
                    disabled={quizPage === 1}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                    Anterior
                  </button>
                  <span className={styles.pageInfo}>{quizPage} / {Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE)}</span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setQuizPage((p) => Math.min(Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE), p + 1))}
                    disabled={quizPage >= Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    Siguiente
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel derecho */}
        {(panel || panelLoading) && (
          <aside className={styles.detailPanel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{panelTitle()}</h3>
              <button className={styles.panelCloseBtn} onClick={() => setPanel(null)}>✕</button>
            </div>
            {renderPanel()}
          </aside>
        )}
      </div>

      {/* Modal: confirmar dar de baja */}
      {bajaModal && (
        <div className={styles.modalOverlay} onClick={() => !bajaLoading && setBajaModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Dar de baja</h3>
            <p className={styles.modalBody}>
              ¿Confirmas dar de baja al alumno del curso <strong>&ldquo;{bajaModal.cursoNombre}&rdquo;</strong>?
              Esta acción cambiará su inscripción a <em>cancelado</em>.
            </p>
            {bajaError && <p className={styles.modalError}>{bajaError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setBajaModal(null)}
                disabled={bajaLoading}
              >
                Cancelar
              </button>
              <button
                className={styles.modalConfirmBtn}
                onClick={handleConfirmarBaja}
                disabled={bajaLoading}
              >
                {bajaLoading ? 'Procesando...' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
