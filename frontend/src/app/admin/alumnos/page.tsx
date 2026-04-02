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
          return { ...c, total: resp.count ?? 0 };
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
  useEffect(() => {
    if (activeTab !== 'quiz' || !quizCursoId) {
      setQuizResults([]);
      return;
    }
    setQuizLoading(true);
    quizApi.resultadosCurso(quizCursoId)
      .then((res) => setQuizResults(res as QuizResultadoAlumno[]))
      .catch((e) => { logError('admin/alumnos/quizResultados', e); setQuizResults([]); })
      .finally(() => setQuizLoading(false));
    setQuizPage(1);
  }, [activeTab, quizCursoId]);

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
            >
              ← Volver a alumnos de &ldquo;{panel.desde.titulo}&rdquo;
            </button>
          )}
          <ul className={styles.panelList}>
            {inscripciones.length === 0 && (
              <li className={styles.panelLoading}>Sin inscripciones</li>
            )}
            {inscripciones.map((insc) => (
              <li key={insc.id} className={styles.panelItem}>
                <div>
                  <div className={styles.panelItemName}>
                    {cursosMap[insc.curso_id] ?? 'Curso desconocido'}
                  </div>
                  <div className={styles.panelItemSub}>
                    {new Date(insc.inscrito_en).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <span className={`${styles.badge} ${badgeClass(insc.estado)}`}>
                  {insc.estado}
                </span>
              </li>
            ))}
          </ul>
          {alumno && <p className={styles.panelItemSub} style={{ marginTop: '1rem' }}>{alumno.email}</p>}
        </>
      );
    }

    if (panel.type === 'curso-alumnos') {
      const { inscripciones } = panel;
      return (
        <ul className={styles.panelList}>
          {inscripciones.length === 0 && (
            <li className={styles.panelLoading}>Sin alumnos inscritos</li>
          )}
          {inscripciones.map((insc) => {
            const alumno = alumnosMap[insc.usuario_id];
            return (
              <li
                key={insc.id}
                className={`${styles.panelItem} ${styles.clickable}`}
                onClick={() => alumno && handleVerCursosEnStats(alumno, panel.curso)}
              >
                <div className={styles.alumnoCell} style={{ flex: 1 }}>
                  <div className={styles.avatar} style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' }}>
                    {alumno ? getInitials(alumno) : '?'}
                  </div>
                  <div>
                    <div className={styles.panelItemName}>
                      {alumno ? getNombre(alumno) : insc.usuario_id.slice(0, 8) + '…'}
                    </div>
                    {alumno && <div className={styles.panelItemSub}>{alumno.email}</div>}
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
            <path d="M19 12H5M12 19l-7-7 7-7" />
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
                  >
                    ← Anterior
                  </button>
                  <span className={styles.pageInfo}>{currentPage} / {totalPages}</span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente →
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
                    </tr>
                  </thead>
                  <tbody>
                    {!quizCursoId ? (
                      <tr><td colSpan={6} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>Selecciona un curso para ver resultados.</td></tr>
                    ) : quizLoading ? (
                      <tr><td colSpan={6} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td></tr>
                    ) : quizResults.length === 0 ? (
                      <tr><td colSpan={6} className={styles.emptyMsg} style={{ textAlign: 'center', padding: '2rem' }}>No hay intentos de quiz en este curso.</td></tr>
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
                                {r.aprobado ? '✓ Aprobado' : '✗ Reprobado'}
                              </span>
                            </td>
                            <td>{r.correctas}/{r.total_preguntas}</td>
                            <td>{r.creado_en ? r.creado_en.slice(0, 10) : '—'}</td>
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
                  >
                    ← Anterior
                  </button>
                  <span className={styles.pageInfo}>{quizPage} / {Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE)}</span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setQuizPage((p) => Math.min(Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE), p + 1))}
                    disabled={quizPage >= Math.ceil(quizResults.length / QUIZ_ITEMS_PER_PAGE)}
                  >
                    Siguiente →
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
    </div>
  );
}
