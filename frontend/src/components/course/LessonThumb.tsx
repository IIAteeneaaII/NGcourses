'use client';

import { useState, type ReactNode } from 'react';
import styles from './LessonThumb.module.css';

interface LessonThumbProps {
  /** Miniatura generada por Bunny. */
  src?: string;
  /** Icono de la lección (video, lectura, quiz). */
  icon: ReactNode;
  /**
   * true cuando la lista tiene miniaturas: las lecciones sin imagen muestran su
   * icono en un recuadro del mismo tamaño para que los títulos queden alineados.
   * false deja el icono suelto, como antes.
   */
  framed: boolean;
  done?: boolean;
  active?: boolean;
  /** Duración en segundos; se muestra sobre la imagen. */
  durationSec?: number;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Miniatura 16:9 del video de una lección (cuadro generado por Bunny). Si la
 * lección no tiene video o la imagen falla, vuelve al icono.
 */
export default function LessonThumb({ src, icon, framed, done, active, durationSec }: LessonThumbProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = !!src && !failed;

  if (!hasImage && !framed) return <>{icon}</>;

  return (
    <span
      className={`${styles.thumb} ${hasImage ? '' : styles.tile} ${active ? styles.active : ''}`}
      aria-hidden="true"
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.img}
          onError={() => setFailed(true)}
        />
      ) : (
        icon
      )}
      {hasImage && !done && durationSec ? (
        <span className={styles.duration}>{formatDuration(durationSec)}</span>
      ) : null}
      {done && (
        <span className={styles.done}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
      )}
    </span>
  );
}
