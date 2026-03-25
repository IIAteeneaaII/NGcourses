'use client';

import { useState, useEffect } from 'react';
import type { Resource } from '@/types/course';
import { calificacionesApi } from '@/lib/api/client';
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
}

export default function VideoControls({
  progress,
  onMarkComplete,
  resources,
  courseId,
  lessonId,
}: VideoControlsProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'recursos' | 'notas' | 'comentarios'>('resumen');
  const [isCompleted, setIsCompleted] = useState(false);

  // Notas (localStorage por lección)
  const notasKey = `notas_${courseId}_${lessonId}`;
  const [nota, setNota] = useState('');
  useEffect(() => {
    if (lessonId) {
      setNota(localStorage.getItem(notasKey) || '');
    }
  }, [lessonId, notasKey]);
  const handleSaveNota = () => {
    localStorage.setItem(notasKey, nota);
  };

  // Comentarios (calificaciones de curso)
  const [comentarios, setComentarios] = useState<CalificacionPublic[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [postingComentario, setPostingComentario] = useState(false);

  useEffect(() => {
    if (activeTab === 'comentarios' && courseId) {
      setLoadingComentarios(true);
      (calificacionesApi.list(courseId) as Promise<CalificacionesResp>)
        .then((resp) => setComentarios(resp.data ?? []))
        .catch(() => {})
        .finally(() => setLoadingComentarios(false));
    }
  }, [activeTab, courseId]);

  const handlePostComentario = async () => {
    if (!nuevoComentario.trim() || !courseId) return;
    setPostingComentario(true);
    try {
      await calificacionesApi.create(courseId, { estrellas: 5, comentario: nuevoComentario });
      const resp = await calificacionesApi.list(courseId) as CalificacionesResp;
      setComentarios(resp.data ?? []);
      setNuevoComentario('');
    } catch {
      // Fallo silencioso
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
        <button className={styles.menuButton}>⋮</button>
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
                  <a href={resource.url} download className={styles.downloadButton}>
                    Descargar
                  </a>
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
          <button className={styles.saveNotaBtn} onClick={handleSaveNota}>
            Guardar nota
          </button>
        </div>
      )}

      {activeTab === 'comentarios' && (
        <div className={styles.tabContent}>
          <div className={styles.comentarioForm}>
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
          {isCompleted ? '✓ Lección completada!' : 'Marcar lección como completada'}
        </button>
      </div>
    </div>
  );
}
