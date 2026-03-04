'use client';

import { useState } from 'react';
import type { Resource } from '@/types/course';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  progress: number;
  onMarkComplete: () => void;
  resources?: Resource[];
}

export default function VideoControls({
  progress,
  onMarkComplete,
  resources,
}: VideoControlsProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'recursos' | 'notas' | 'comentarios'>('resumen');
  const [isCompleted, setIsCompleted] = useState(false);

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
                  <a
                    href={resource.url}
                    download
                    className={styles.downloadButton}
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyMessage}>No hay recursos disponibles para este módulo.</p>
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
