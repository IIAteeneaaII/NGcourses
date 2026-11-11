'use client';

import React from 'react';
import type { QuizQuestion } from '@/types/course';
import base from './QuizPlayer.module.css';
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
  respuestas: RespuestaResult[];
}

interface Props {
  resultado: QuizIntentoPublic;
  preguntas: QuizQuestion[];
  /** Mapa preguntaId → opcionId elegida por el alumno */
  seleccionesOriginales: Record<string, string>;
  /** Si undefined (ya aprobó o agotó intentos), no se muestra el botón de reintentar */
  onReintentar?: () => void;
  /** Intentos ya usados y máximo permitido (0 = sin límite, p.ej. vista previa). */
  intentosUsados?: number;
  intentosMax?: number;
}

export default function QuizResult({ resultado, preguntas, seleccionesOriginales, onReintentar, intentosUsados = 0, intentosMax = 0 }: Props) {
  const { aprobado, total_preguntas, correctas } = resultado;
  const porcentaje = total_preguntas > 0 ? Math.round((correctas / total_preguntas) * 100) : 0;
  const conLimite = intentosMax > 0;
  const intentosRestantes = Math.max(0, intentosMax - intentosUsados);
  const sinIntentos = !aprobado && conLimite && intentosRestantes === 0;

  // La corrección es autoritativa del backend (es_correcta por respuesta); el
  // alumno ya no recibe la clave `esCorrecta` en las opciones del quiz.
  const correctaPorPregunta = resultado.respuestas.reduce<Record<string, boolean>>(
    (acc, r) => { acc[r.pregunta_id] = r.es_correcta; return acc; },
    {}
  );

  const mensaje = aprobado
    ? 'Superaste el 60 % requerido. La lección queda marcada como completada.'
    : sinIntentos
    ? `Necesitabas al menos 60 %. Agotaste tus ${intentosMax} intentos; pide a un administrador que los reinicie.`
    : 'Necesitas al menos 60 % de aciertos. Revisa tus respuestas y vuelve a intentarlo desde el inicio.';

  return (
    <section className={base.container} aria-labelledby="quiz-result-title">
      <header className={base.head}>
        <div className={styles.headTop}>
          <span className={base.tag}>Resultado del cuestionario</span>
          <span className={`${styles.status} ${aprobado ? styles.statusOk : styles.statusFail}`}>
            {aprobado ? <CheckIcon /> : <CrossIcon />}
            {aprobado ? 'Aprobado' : 'No aprobado'}
          </span>
        </div>
        <h2 id="quiz-result-title" className={base.title}>
          {aprobado ? '¡Aprobaste el cuestionario!' : 'Aún no alcanzas el puntaje'}
        </h2>
        <p className={styles.message}>{mensaje}</p>

        <div className={styles.scoreRow}>
          <p className={styles.score}>
            <b>{porcentaje} %</b>
            <span>{correctas} de {total_preguntas} correctas</span>
          </p>
          <div className={styles.map} aria-hidden="true">
            {preguntas.map((p) => (
              <i
                key={p.id}
                className={(correctaPorPregunta[p.id] ?? false) ? styles.mapOk : styles.mapFail}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Desglose por pregunta */}
      <div className={styles.review}>
        <div className={styles.reviewHead}>
          <h3 className={styles.reviewTitle}>Revisión de respuestas</h3>
          <p className={styles.reviewNote}>Se muestra tu respuesta. Las respuestas correctas no se revelan.</p>
        </div>

        <ol className={styles.reviewList}>
          {preguntas.map((pregunta, idx) => {
            const opcionElegidaId = seleccionesOriginales[pregunta.id];
            const opcionElegida = pregunta.opciones.find((o) => o.id === opcionElegidaId);
            const esCorrecta = correctaPorPregunta[pregunta.id] ?? false;

            return (
              <li key={pregunta.id} className={styles.reviewItem}>
                <span className={`${styles.mark} ${esCorrecta ? styles.markOk : styles.markFail}`} aria-hidden="true">
                  {esCorrecta ? <CheckIcon /> : <CrossIcon />}
                </span>
                <div className={styles.reviewBody}>
                  <p className={styles.reviewNum}>
                    Pregunta {idx + 1}
                    <span className={esCorrecta ? styles.labelOk : styles.labelFail}>
                      {esCorrecta ? 'Correcta' : 'Incorrecta'}
                    </span>
                  </p>
                  <p className={styles.reviewEnunciado}>{pregunta.enunciado || 'Sin enunciado'}</p>
                  <p className={styles.reviewAnswer}>
                    <span className={styles.reviewAnswerLabel}>Tu respuesta</span>
                    <span className={styles.reviewAnswerText}>
                      {opcionElegida ? opcionElegida.texto : <em>Sin respuesta</em>}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Acciones */}
      <footer className={base.footer}>
        {!aprobado && onReintentar && (
          <div className={base.submitRow}>
            <span className={base.pendingHint}>
              {conLimite
                ? `Te ${intentosRestantes === 1 ? 'queda' : 'quedan'} ${intentosRestantes} intento${intentosRestantes === 1 ? '' : 's'}.`
                : 'El nuevo intento empieza desde cero.'}
            </span>
            <button type="button" className={`ng-btn ng-btn-primary ${base.submitBtn}`} onClick={onReintentar}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Intentar de nuevo
            </button>
          </div>
        )}
        {sinIntentos && (
          <p className={styles.blockedMsg}>
            Agotaste tus {intentosMax} intentos en este cuestionario. Pide a un administrador que los reinicie para continuar.
          </p>
        )}
        {aprobado && (
          <p className={styles.approvedMsg}>
            <CheckIcon />
            Lección completada. Continúa con la siguiente lección en el panel de contenido.
          </p>
        )}
      </footer>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}
