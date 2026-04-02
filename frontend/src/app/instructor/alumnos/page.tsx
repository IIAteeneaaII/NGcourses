'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cursosApi, inscripcionesApi, quizApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

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

interface ApiCurso {
  id: string;
  titulo: string;
}

interface ApiInscripcion {
  id: string;
  usuario_id: string;
  curso_id: string;
  estado: string;
  inscrito_en: string;
  ultimo_acceso_en: string | null;
}

interface ApiInscripcionesResp {
  data: ApiInscripcion[];
  count: number;
}

interface AlumnoRow {
  id: string;
  curso_id: string;
  curso_titulo: string;
  estado: string;
  inscrito_en: string;
  ultimo_acceso: string | null;
}

const ITEMS_PER_PAGE = 10;

type ActiveTab = 'inscripciones' | 'quiz';

export default function AlumnosInstructorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('inscripciones');

  // Inscripciones state
  const [alumnos, setAlumnos] = useState<AlumnoRow[]>([]);
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);

  // Quiz results state
  const [quizResults, setQuizResults] = useState<QuizResultadoAlumno[]>([]);
  const [quizCursoId, setQuizCursoId] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizPage, setQuizPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      try {
        const cursosResp = await cursosApi.list({ limit: 200 }) as { data: ApiCurso[]; count: number };
        const misCursos = cursosResp.data;
        setCursos(misCursos);

        const inscResults = await Promise.allSettled(
          misCursos.map((c) => inscripcionesApi.porCurso(c.id) as Promise<ApiInscripcionesResp>)
        );

        const rows: AlumnoRow[] = [];
        inscResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            result.value.data.forEach((insc) => {
              rows.push({
                id: insc.id,
                curso_id: insc.curso_id,
                curso_titulo: misCursos[idx].titulo,
                estado: insc.estado,
                inscrito_en: insc.inscrito_en,
                ultimo_acceso: insc.ultimo_acceso_en,
              });
            });
          }
        });
        setAlumnos(rows);
      } catch (e) {
        logError('instructor/alumnos/fetchData', e);
        setAlumnos([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Fetch quiz results when curso changes
  useEffect(() => {
    if (activeTab !== 'quiz' || !quizCursoId) {
      setQuizResults([]);
      return;
    }
    setQuizLoading(true);
    quizApi.resultadosCurso(quizCursoId)
      .then((res) => setQuizResults(res as QuizResultadoAlumno[]))
      .catch((e) => { logError('instructor/alumnos/quizResultados', e); setQuizResults([]); })
      .finally(() => setQuizLoading(false));
    setQuizPage(1);
  }, [activeTab, quizCursoId]);

  const filtered = useMemo(() =>
    alumnos.filter((a) => {
      const matchCourse = courseFilter === 'todos' || a.curso_id === courseFilter;
      const matchSearch = a.curso_titulo.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCourse && matchSearch;
    }), [alumnos, searchTerm, courseFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const quizTotalPages = Math.max(1, Math.ceil(quizResults.length / ITEMS_PER_PAGE));
  const quizPaginated = quizResults.slice((quizPage - 1) * ITEMS_PER_PAGE, quizPage * ITEMS_PER_PAGE);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return d.slice(0, 10);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al dashboard
        </button>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <div>
            <h1 className={styles.pageTitle}>Alumnos</h1>
            <p className={styles.pageSubtitle}>Inscripciones y resultados de tus cursos</p>
          </div>
        </div>

        <div className={styles.tabsRow}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'inscripciones' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('inscripciones')}
          >
            Inscripciones
            <span className={styles.tabCount}>{filtered.length}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'quiz' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            Resultados Quiz
          </button>
        </div>

        {activeTab === 'inscripciones' && (
          <>
            <div className={styles.filtersRow}>
              <input
                type="text"
                placeholder="Buscar por nombre de curso..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className={styles.searchInput}
              />
              <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setCurrentPage(1); }} className={styles.filterSelect}>
                <option value="todos">Todos los cursos</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Estado</th>
                    <th>Inscrito el</th>
                    <th>Ultimo acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className={styles.emptyRow}>Cargando...</td></tr>
                  ) : paginated.length > 0 ? (
                    paginated.map((a) => (
                      <tr key={a.id}>
                        <td>{a.curso_titulo}</td>
                        <td>{a.estado}</td>
                        <td className={styles.dateCell}>{formatDate(a.inscrito_en)}</td>
                        <td className={styles.dateCell}>{formatDate(a.ultimo_acceso)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className={styles.emptyRow}>No se encontraron inscripciones.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationButton} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
                <span className={styles.paginationInfo}>Pagina {currentPage} de {totalPages}</span>
                <button className={styles.paginationButton} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
              </div>
            )}
          </>
        )}

        {activeTab === 'quiz' && (
          <>
            <div className={styles.filtersRow}>
              <select
                value={quizCursoId}
                onChange={(e) => setQuizCursoId(e.target.value)}
                className={styles.filterSelect}
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
                    <tr><td colSpan={6} className={styles.emptyRow}>Selecciona un curso para ver resultados.</td></tr>
                  ) : quizLoading ? (
                    <tr><td colSpan={6} className={styles.emptyRow}>Cargando...</td></tr>
                  ) : quizPaginated.length > 0 ? (
                    quizPaginated.map((r) => (
                      <tr key={r.intento_id}>
                        <td>{r.usuario_nombre}</td>
                        <td>{r.usuario_email}</td>
                        <td>{r.leccion_titulo}</td>
                        <td>
                          <span className={r.aprobado ? styles.badgeAprobado : styles.badgeReprobado}>
                            {r.aprobado ? '✓ Aprobado' : '✗ Reprobado'}
                          </span>
                        </td>
                        <td className={styles.dateCell}>{r.correctas}/{r.total_preguntas}</td>
                        <td className={styles.dateCell}>{formatDate(r.creado_en)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className={styles.emptyRow}>No hay intentos de quiz en este curso.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {quizTotalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationButton} onClick={() => setQuizPage((p) => Math.max(1, p - 1))} disabled={quizPage === 1}>Anterior</button>
                <span className={styles.paginationInfo}>Pagina {quizPage} de {quizTotalPages}</span>
                <button className={styles.paginationButton} onClick={() => setQuizPage((p) => Math.min(quizTotalPages, p + 1))} disabled={quizPage >= quizTotalPages}>Siguiente</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
