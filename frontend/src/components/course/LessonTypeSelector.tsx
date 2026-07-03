'use client';

import React, { useEffect } from 'react';
import styles from './LessonTypeSelector.module.css';

interface Props {
  onSelect: (tipo: 'video' | 'quiz' | 'lectura') => void;
  onCancel: () => void;
  isCreating?: boolean;
}

export default function LessonTypeSelector({ onSelect, onCancel, isCreating = false }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className={styles.selectorRow}>
      <span className={styles.label}>¿Qué tipo de lección?</span>
      <button
        type="button"
        className={`${styles.typeButton} ${styles.video}`}
        onClick={() => onSelect('video')}
        disabled={isCreating}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Video
      </button>
      <button
        type="button"
        className={`${styles.typeButton} ${styles.quiz}`}
        onClick={() => onSelect('quiz')}
        disabled={isCreating}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        Quiz
      </button>
      <button
        type="button"
        className={`${styles.typeButton} ${styles.lectura}`}
        onClick={() => onSelect('lectura')}
        disabled={isCreating}
        title="Lección práctica: solo material/recursos, sin video ni calificación"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        Práctica
      </button>
      <span className={styles.cancelHint}>Esc para cancelar</span>
    </div>
  );
}
