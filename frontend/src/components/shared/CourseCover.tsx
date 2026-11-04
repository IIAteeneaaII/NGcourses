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

/**
 * Separa "Familia: Nombre" → { family: 'Familia', name: 'Nombre' }. Los cursos
 * RAM se nombran así ("Testeo: Test Funcional."); el resto no tiene familia.
 */
export function splitCourseTitle(titulo: string): { family: string | null; name: string } {
  const clean = titulo.trim().replace(/\.$/, '');
  const idx = clean.indexOf(':');
  if (idx <= 0) return { family: null, name: clean };
  return { family: clean.slice(0, idx).trim(), name: clean.slice(idx + 1).trim() };
}

/** Dos letras siempre: iniciales de dos palabras, o las dos primeras de una sola ("Escaneo" → "ES"). */
function monogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2)).toUpperCase();
}

interface CourseCoverProps {
  src?: string | null;
  title: string;
  /** Texto pequeño bajo las iniciales (categoría, nivel…). */
  caption?: string | null;
  className?: string;
  /** Tamaño de las iniciales: grande para tarjetas, pequeño para miniaturas. */
  size?: 'lg' | 'sm';
  /**
   * `gradient` (por defecto): degradado de la marca con iniciales centradas.
   * `grid`: retícula técnica clara con monograma abajo y familia arriba; la usan
   * las vistas del alumno (Dashboard, Mi progreso, Certificados).
   */
  variant?: 'gradient' | 'grid';
  /** Solo en `grid`: turquesa para NextGen, verde para cursos RAM. */
  tone?: 'nextgen' | 'ram';
}

/**
 * Portada de curso. Si no hay imagen (o falla al cargar) dibuja una portada
 * generada en lugar del rectángulo negro del placeholder.
 */
export default function CourseCover({
  src,
  title,
  caption,
  className,
  size = 'lg',
  variant = 'gradient',
  tone = 'nextgen',
}: CourseCoverProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = !!src && src !== PLACEHOLDER && !src.endsWith(PLACEHOLDER) && !failed;

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src!} alt="" className={`${styles.image} ${className ?? ''}`} onError={() => setFailed(true)} />
    );
  }

  if (variant === 'grid') {
    const { family, name } = splitCourseTitle(title);
    const eyebrow = family ?? caption;
    return (
      <div
        className={`${styles.grid} ${tone === 'ram' ? styles.gridRam : ''} ${size === 'sm' ? styles.gridSmall : ''} ${className ?? ''}`}
        aria-hidden="true"
      >
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <span className={styles.monogram}>{monogram(name)}</span>
      </div>
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
