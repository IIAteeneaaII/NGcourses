'use client';

import React from 'react';

/**
 * Botones ↑/↓ para reordenar una lección dentro de su módulo en el editor de curso.
 * El orden se persiste vía PATCH del campo `orden` (ver handler moveLesson en cada
 * página de editor). Estilos inline para no depender del CSS module de cada página.
 */
export default function LessonMoveButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const base: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    lineHeight: 0,
    display: 'inline-flex',
    color: '#64748b',
  };
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginRight: 4 }}>
      <button
        type="button"
        title="Mover arriba"
        aria-label="Mover lección arriba"
        onClick={onUp}
        disabled={disableUp}
        style={{ ...base, opacity: disableUp ? 0.25 : 1, cursor: disableUp ? 'default' : 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <button
        type="button"
        title="Mover abajo"
        aria-label="Mover lección abajo"
        onClick={onDown}
        disabled={disableDown}
        style={{ ...base, opacity: disableDown ? 0.25 : 1, cursor: disableDown ? 'default' : 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
