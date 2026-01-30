'use client';

import { useState } from 'react';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  progress: number;
  onMarkComplete: () => void;
}

export default function VideoControls({
  progress,
  onMarkComplete,
}: VideoControlsProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'recursos' | 'notas' | 'comentarios'>('resumen');
  const [isCompleted, setIsCompleted] = useState(false);

  const handleMarkComplete = () => {
    setIsCompleted(true);
    onMarkComplete();
    setTimeout(() => setIsCompleted(false), 2000);
  };

  const tabs = ['resumen', 'recursos', 'notas', 'comentarios'] as const;

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
