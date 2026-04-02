'use client';

import React from 'react';
import type { QuizQuestion } from '@/types/course';
import styles from './QuizResult.module.css';

interface RespuestaResult {
  pregunta_id: string;
  opcion_id_seleccionada: string;
  es_correcta: boolean;
}

interface QuizIntentoPublic {
  id: string;
  aprobado: boolean;
  total_preguntas: number;
  correctas: number;
}

interface Props {
  resultado: QuizIntentoPublic;
  preguntas: QuizQuestion[];
  /** Mapa preguntaId → opcionId elegida por el alumno */
  seleccionesOriginales: Record<string, string>;
  /** Si undefined (ya aprobó), no se muestra el botón de reintentar */
  onReintentar?: () => void;
}

export default function QuizResult({ resultado, preguntas, seleccionesOriginales, onReintentar }: Props) {
  const { aprobado, total_preguntas, correctas } = resultado;
  const porcentaje = total_preguntas > 0 ? Math.round((correctas / total_preguntas) * 100) : 0;

  return (
    <div className={styles.container}>
      {/* Banner de resultado */}
      <div className={`${styles.banner} ${aprobado ? styles.bannerAprobado : styles.bannerReprobado}`}>
        <div className={styles.bannerIcon}>
          {aprobado ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          )}
        </div>
        <div className={styles.bannerText}>
          <h2 className={styles.bannerTitle}>
            {aprobado ? '¡Aprobado!' : 'No aprobado'}
          </h2>
          <p className={styles.bannerSubtitle}>
            {aprobado
              ? 'Excelente, respondiste todas las preguntas correctamente.'
              : 'Debes responder todas correctamente. Revisa tus respuestas y vuelve a intentarlo desde el inicio.'}
          </p>
        </div>
        <div className={styles.score}>
          <span className={styles.scoreNum}>{correctas}/{total_preguntas}</span>
          <span className={styles.scorePct}>{porcentaje}%</span>
        </div>
      </div>

      {/* Desglose por pregunta */}
      <div className={styles.reviewList}>
        <h3 className={styles.reviewTitle}>Revisión de respuestas</h3>
        <p className={styles.reviewNote}>
          Se muestra tu respuesta. Las respuestas correctas no se revelan.
        </p>

        {preguntas.map((pregunta, idx) => {
          const opcionElegidaId = seleccionesOriginales[pregunta.id];
          const opcionElegida = pregunta.opciones.find((o) => o.id === opcionElegidaId);
          const esCorrecta = !!opcionElegida?.esCorrecta;

          return (
            <div
              key={pregunta.id}
              className={`${styles.reviewCard} ${esCorrecta ? styles.correct : styles.incorrect}`}
            >
              <div className={styles.reviewHeader}>
                <span className={styles.reviewNum}>{idx + 1}</span>
                <p className={styles.reviewEnunciado}>{pregunta.enunciado || 'Sin enunciado'}</p>
                <span className={`${styles.badge} ${esCorrecta ? styles.badgeOk : styles.badgeFail}`}>
                  {esCorrecta ? '✓ Correcta' : '✗ Incorrecta'}
                </span>
              </div>
              <div className={styles.reviewAnswer}>
                <span className={styles.reviewAnswerLabel}>Tu respuesta:</span>
                <span className={styles.reviewAnswerText}>
                  {opcionElegida ? opcionElegida.texto : <em>Sin respuesta</em>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones */}
      <div className={styles.actions}>
        {!aprobado && onReintentar && (
          <button className={styles.retryBtn} onClick={onReintentar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Intentar de nuevo (desde cero)
          </button>
        )}
        {aprobado && (
          <div className={styles.approvedMsg}>
            Lección completada — continúa con la siguiente lección en el panel lateral.
          </div>
        )}
      </div>
    </div>
  );
}
