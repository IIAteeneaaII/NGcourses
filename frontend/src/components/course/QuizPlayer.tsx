'use client';

import React, { useState } from 'react';
import type { QuizData, QuizQuestion } from '@/types/course';
import { quizApi } from '@/lib/api/client';
import QuizResult from './QuizResult';
import styles from './QuizPlayer.module.css';

interface QuizIntentoPublic {
  id: string;
  leccion_id: string;
  aprobado: boolean;
  total_preguntas: number;
  correctas: number;
  creado_en: string;
  respuestas: { pregunta_id: string; opcion_id_seleccionada: string; es_correcta: boolean }[];
}

interface Props {
  leccionId: string;
  inscripcionId: string | null;
  quizData: QuizData;
  /** Resultado previo (si el alumno ya intentó antes) */
  ultimoIntento?: QuizIntentoPublic | null;
  /** Llamado cuando el alumno aprueba para marcar completada la lección en UI */
  onAprobado?: () => void;
}

export default function QuizPlayer({ leccionId, inscripcionId, quizData, ultimoIntento, onAprobado }: Props) {
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<QuizIntentoPublic | null>(ultimoIntento ?? null);

  const preguntas = quizData.preguntas ?? [];

  const handleSeleccion = (preguntaId: string, opcionId: string) => {
    setSelecciones((prev) => ({ ...prev, [preguntaId]: opcionId }));
  };

  const handleEnviar = async () => {
    if (!inscripcionId) {
      setError('Debes estar inscrito para responder el quiz.');
      return;
    }
    const sinResponder = preguntas.filter((p) => !selecciones[p.id]);
    if (sinResponder.length > 0) {
      setError(`Debes responder todas las preguntas (faltan ${sinResponder.length}).`);
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const resp = await quizApi.enviar(leccionId, {
        inscripcion_id: inscripcionId,
        respuestas: preguntas.map((p) => ({
          pregunta_id: p.id,
          opcion_id: selecciones[p.id],
        })),
      }) as QuizIntentoPublic;
      setResultado(resp);
      if (resp.aprobado) onAprobado?.();
    } catch {
      setError('Error al enviar el quiz. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleReintentar = () => {
    setResultado(null);
    setSelecciones({});
    setError('');
  };

  // Mostrar resultado si ya hay uno
  if (resultado) {
    return (
      <QuizResult
        resultado={resultado}
        preguntas={preguntas}
        seleccionesOriginales={
          resultado.respuestas.reduce<Record<string, string>>(
            (acc, r) => { acc[r.pregunta_id] = r.opcion_id_seleccionada; return acc; },
            {}
          )
        }
        onReintentar={resultado.aprobado ? undefined : handleReintentar}
      />
    );
  }

  if (preguntas.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyMsg}>Este quiz aún no tiene preguntas configuradas.</p>
      </div>
    );
  }

  const respondidas = preguntas.filter((p) => selecciones[p.id]).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <div>
          <h2 className={styles.title}>Quiz de evaluación</h2>
          <p className={styles.subtitle}>
            Debes contestar correctamente <strong>todas</strong> las preguntas para aprobar.
          </p>
        </div>
        <div className={styles.counter}>
          {respondidas} / {preguntas.length}
        </div>
      </div>

      <div className={styles.questionList}>
        {preguntas.map((pregunta, idx) => (
          <QuestionCard
            key={pregunta.id}
            pregunta={pregunta}
            numero={idx + 1}
            seleccion={selecciones[pregunta.id] ?? null}
            onSeleccion={(opcionId) => handleSeleccion(pregunta.id, opcionId)}
          />
        ))}
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.footer}>
        <button
          className={styles.submitBtn}
          onClick={handleEnviar}
          disabled={enviando || respondidas < preguntas.length}
        >
          {enviando ? 'Enviando...' : 'Enviar respuestas'}
        </button>
        {respondidas < preguntas.length && (
          <span className={styles.pendingHint}>
            Responde todas las preguntas para continuar
          </span>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  pregunta,
  numero,
  seleccion,
  onSeleccion,
}: {
  pregunta: QuizQuestion;
  numero: number;
  seleccion: string | null;
  onSeleccion: (opcionId: string) => void;
}) {
  return (
    <div className={`${styles.questionCard} ${seleccion ? styles.answered : ''}`}>
      <div className={styles.questionHeader}>
        <span className={styles.questionNum}>{numero}</span>
        <p className={styles.enunciado}>{pregunta.enunciado || 'Sin enunciado'}</p>
      </div>
      <div className={styles.optionsList}>
        {pregunta.opciones.map((opcion) => (
          <label
            key={opcion.id}
            className={`${styles.optionLabel} ${seleccion === opcion.id ? styles.selected : ''}`}
          >
            <input
              type="radio"
              name={`q-${pregunta.id}`}
              value={opcion.id}
              checked={seleccion === opcion.id}
              onChange={() => onSeleccion(opcion.id)}
              className={styles.optionRadio}
            />
            <span className={styles.optionMark}>{seleccion === opcion.id ? '●' : '○'}</span>
            <span className={styles.optionText}>{opcion.texto}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
