'use client';

import { useState } from 'react';
import styles from './CourseCover.module.css';

/** Placeholder heredado: se trata como "sin portada". */
const PLACEHOLDER = '/placeholder-course.jpg';

// Paletas de la marca para las portadas generadas (se elige una por curso).
const PALETTES = ['teal', 'ocean', 'forest', 'slate', 'amber'] as const;

function paletteFor(seed: string): (typeof PALETTES)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function courseInitials(titulo: string): string {
  return (
    titulo
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || titulo.slice(0, 2).toUpperCase()
  );
}

interface CourseCoverProps {
  src?: string | null;
  title: string;
  /** Texto pequeño bajo las iniciales (categoría, nivel…). */
  caption?: string | null;
  className?: string;
  /** Tamaño de las iniciales: grande para tarjetas, pequeño para miniaturas. */
  size?: 'lg' | 'sm';
}

/**
 * Portada de curso. Si no hay imagen (o falla al cargar) dibuja una portada
 * con las iniciales del curso sobre un degradado de la marca, en lugar del
 * rectángulo negro del placeholder.
 */
export default function CourseCover({ src, title, caption, className, size = 'lg' }: CourseCoverProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = !!src && src !== PLACEHOLDER && !src.endsWith(PLACEHOLDER) && !failed;

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src!} alt="" className={`${styles.image} ${className ?? ''}`} onError={() => setFailed(true)} />
    );
  }

  return (
    <div
      className={`${styles.fallback} ${styles[paletteFor(title)]} ${size === 'sm' ? styles.small : ''} ${className ?? ''}`}
      aria-hidden="true"
    >
      <span className={styles.initials}>{courseInitials(title)}</span>
      {caption && size === 'lg' && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}
