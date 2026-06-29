'use client';

import { useState, useEffect } from 'react';
import type { Resource } from '@/types/course';
import { calificacionesApi, cursosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './VideoControls.module.css';

interface CalificacionPublic {
  id: string;
  comentario: string | null;
  titulo: string | null;
  estrellas: number;
  creado_en: string;
}

interface CalificacionesResp {
  data: CalificacionPublic[];
  count: number;
}

interface VideoControlsProps {
  progress: number;
  onMarkComplete: () => void;
  resources?: Resource[];
  courseId?: string;
  lessonId?: string;
  certFolio?: string | null;
  onDownloadCert?: (folio: string) => void;
  downloading?: boolean;
  readOnlyMode?: boolean;
}

export default function VideoControls({
  progress,
  onMarkComplete,
  resources,
  courseId,
  lessonId,
  certFolio,
  onDownloadCert,
  downloading,
  readOnlyMode = false,
}: VideoControlsProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'recursos' | 'notas' | 'comentarios'>('resumen');
  const [isCompleted, setIsCompleted] = useState(false);
  const [descargandoRecurso, setDescargandoRecurso] = useState<string | null>(null);

  const handleDescargarRecurso = async (recursoId: string) => {
    setDescargandoRecurso(recursoId);
    try {
      await cursosApi.descargarRecurso(recursoId);
    } catch (e) {
      logError('VideoControls/descargarRecurso', e);
    } finally {
      setDescargandoRecurso(null);
    }
  };

  // Notas (localStorage por lección)
  const notasKey = `notas_${courseId}_${lessonId}`;
  const [nota, setNota] = useState('');
  const [notaMsg, setNotaMsg] = useState('');
  useEffect(() => {
    if (lessonId) {
      setNota(localStorage.getItem(notasKey) || '');
    }
  }, [lessonId, notasKey]);
  const handleSaveNota = () => {
    localStorage.setItem(notasKey, nota);
    setNotaMsg('✓ Nota guardada en este dispositivo');
    setTimeout(() => setNotaMsg(''), 2500);
  };
  const handleDescargarNota = () => {
    const blob = new Blob([nota], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-${lessonId ?? 'leccion'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Comentarios (calificaciones de curso)
  const [comentarios, setComentarios] = useState<CalificacionPublic[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [estrellas, setEstrellas] = useState(5);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [postingComentario, setPostingComentario] = useState(false);
  const [comentarioMsg, setComentarioMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'comentarios' && courseId) {
      setLoadingComentarios(true);
      (calificacionesApi.list(courseId) as Promise<CalificacionesResp>)
        .then((resp) => setComentarios(resp.data ?? []))
        .catch((e) => logError('VideoControls/calificaciones', e))
        .finally(() => setLoadingComentarios(false));
    }
  }, [activeTab, courseId]);

  const handlePostComentario = async () => {
    if (!nuevoComentario.trim() || !courseId) return;
    setPostingComentario(true);
    setComentarioMsg(null);
    try {
      await calificacionesApi.create(courseId, { estrellas, comentario: nuevoComentario });
      const resp = await calificacionesApi.list(courseId) as CalificacionesResp;
      setComentarios(resp.data ?? []);
      setNuevoComentario('');
      setComentarioMsg({ tipo: 'ok', texto: '¡Publicado! Aparece abajo y suma a la reseña del curso.' });
    } catch (e) {
      // El backend devuelve 409 si ya reseñaste, 403 si no estás inscrito.
      const detail = (e as { detail?: string })?.detail || 'No se pudo publicar el comentario.';
      setComentarioMsg({ tipo: 'error', texto: detail });
    } finally {
      setPostingComentario(false);
    }
  };

  const handleMarkComplete = () => {
    setIsCompleted(true);
    onMarkComplete();
    setTimeout(() => setIsCompleted(false), 2000);
  };

  const tabs = ['resumen', 'recursos', 'notas', 'comentarios'] as const;

  const getFileIcon = (type: Resource['type']) => {
    switch (type) {
      case 'docx': return 'W';
      case 'xlsx': return 'X';
      case 'pdf': return 'P';
      default: return 'F';
    }
  };

  const getFileColor = (type: Resource['type']) => {
    switch (type) {
      case 'docx': return styles.iconWord;
      case 'xlsx': return styles.iconExcel;
      case 'pdf': return styles.iconPdf;
      default: return styles.iconOther;
    }
  };

  if (readOnlyMode) {
    return (
      <div className={styles.readOnlyPanel}>
        <h3 className={styles.readOnlyTitle}>Vista de solo lectura</h3>
        <p className={styles.readOnlyText}>
          Puedes revisar esta lección sin marcar avance, publicar comentarios ni generar certificado.
        </p>
        <div className={styles.readOnlyResources}>
          <h4 className={styles.readOnlySubtitle}>Recursos de la lección</h4>
          {resources && resources.length > 0 ? (
            <ul className={styles.resourcesList}>
              {resources.map((resource) => (
                <li key={resource.id} className={styles.resourceItem}>
                  <span className={`${styles.resourceIcon} ${getFileColor(resource.type)}`}>
                    {getFileIcon(resource.type)}
                  </span>
                  <span className={styles.resourceName}>{resource.name}</span>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    disabled={descargandoRecurso === resource.id}
                    onClick={() => handleDescargarRecurso(resource.id)}
                  >
                    {descargandoRecurso === resource.id ? 'Descargando...' : 'Descargar'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyMessage}>No hay recursos disponibles para esta lección.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <button className={styles.menuButton}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
        </button>
      </div>

      {activeTab === 'recursos' && (
        <div className={styles.tabContent}>
          {resources && resources.length > 0 ? (
            <ul className={styles.resourcesList}>
              {resources.map((resource) => (
                <li key={resource.id} className={styles.resourceItem}>
                  <span className={`${styles.resourceIcon} ${getFileColor(resource.type)}`}>
                    {getFileIcon(resource.type)}
                  </span>
                  <span className={styles.resourceName}>{resource.name}</span>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    disabled={descargandoRecurso === resource.id}
                    onClick={() => handleDescargarRecurso(resource.id)}
                  >
                    {descargandoRecurso === resource.id ? 'Descargando...' : 'Descargar'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyMessage}>No hay recursos disponibles para esta lección.</p>
          )}
        </div>
      )}

      {activeTab === 'notas' && (
        <div className={styles.tabContent}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
            Tus notas se guardan localmente en este dispositivo.
          </p>
          <textarea
            className={styles.notasTextarea}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Escribe tus notas para esta lección..."
            rows={6}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={styles.saveNotaBtn} onClick={handleSaveNota}>
              Guardar nota
            </button>
            <button
              className={styles.saveNotaBtn}
              onClick={handleDescargarNota}
              disabled={!nota.trim()}
              style={{ background: 'transparent', color: 'var(--color-secondary-30)', border: '1px solid currentColor' }}
            >
              Descargar (.txt)
            </button>
            {notaMsg && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>{notaMsg}</span>}
          </div>
        </div>
      )}

      {activeTab === 'comentarios' && (
        <div className={styles.tabContent}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
            Tu comentario se publica como <strong>reseña pública del curso</strong>: aparece en la lista de abajo y suma a la calificación del curso. Puedes dejar una reseña por curso.
          </p>
          <div className={styles.comentarioForm}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.4rem' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEstrellas(n)}
                  aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: 0, color: n <= estrellas ? '#f59e0b' : '#cbd5e1' }}
                >
                  ★
                </button>
              ))}
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '0.35rem' }}>{estrellas}/5</span>
            </div>
            <textarea
              className={styles.notasTextarea}
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Escribe un comentario sobre este curso..."
              rows={3}
            />
            <button
              className={styles.saveNotaBtn}
              onClick={handlePostComentario}
              disabled={postingComentario}
            >
              {postingComentario ? 'Publicando...' : 'Publicar comentario'}
            </button>
            {comentarioMsg && (
              <p style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: comentarioMsg.tipo === 'ok' ? '#16a34a' : '#dc2626' }}>
                {comentarioMsg.texto}
              </p>
            )}
          </div>
          {loadingComentarios ? (
            <p className={styles.emptyMessage}>Cargando comentarios...</p>
          ) : comentarios.length === 0 ? (
            <p className={styles.emptyMessage}>No hay comentarios aún. ¡Sé el primero!</p>
          ) : (
            <ul className={styles.comentariosList}>
              {comentarios.map((c) => (
                <li key={c.id} className={styles.comentarioItem}>
                  <div className={styles.comentarioMeta}>
                    <span className={styles.comentarioEstrellas}>{'★'.repeat(c.estrellas)}</span>
                    <span className={styles.comentarioFecha}>
                      {new Date(c.creado_en).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  {c.titulo && <p className={styles.comentarioTitulo}>{c.titulo}</p>}
                  {c.comentario && <p className={styles.comentarioTexto}>{c.comentario}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.progressSection}>
        <p className={styles.progressLabel}>Progreso del Curso</p>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={handleMarkComplete}
          className={`${styles.completeButton} ${isCompleted ? styles.completeButtonSuccess : ''}`}
        >
          {isCompleted && (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          )}
          {isCompleted ? 'Lección completada!' : 'Marcar lección como completada'}
        </button>
        {certFolio && (
          <button
            className={styles.certButton}
            disabled={downloading}
            onClick={() => onDownloadCert?.(certFolio)}
          >
            {!downloading && (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {downloading ? 'Descargando...' : 'Descargar certificado'}
          </button>
        )}
      </div>
    </div>
  );
}
