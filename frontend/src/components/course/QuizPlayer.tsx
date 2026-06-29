'use client';

import React, { useEffect, useState } from 'react';
import type { QuizData, QuizQuestion } from '@/types/course';
import { quizApi } from '@/lib/api/client';
import QuizResult from './QuizResult';
import styles from './QuizPlayer.module.css';

/** Fracción mínima de aciertos para aprobar (debe coincidir con el backend). */
const UMBRAL_APROBACION = 0.6;

interface QuizIntentoPublic {
  id: string;
  leccion_id: string;
  aprobado: boolean;
  total_preguntas: number;
  correctas: number;
  creado_en: string;
  respuestas: { pregunta_id: string; opcion_id_seleccionada: string; es_correcta: boolean }[];
  intentos_usados: number;
  intentos_max: number;
}

interface Props {
  leccionId: string;
  inscripcionId: string | null;
  quizData: QuizData;
  /** Resultado previo (si el alumno ya intentó antes) */
  ultimoIntento?: QuizIntentoPublic | null;
  /** Llamado cuando el alumno aprueba para marcar completada la lección en UI */
  onAprobado?: () => void;
  /** Vista previa (admin/instructor sin inscripción): califica localmente sin guardar. */
  previewMode?: boolean;
  /** Vista de supervisor: solo muestra preguntas y respuestas, sin enviar intento. */
  readOnlyMode?: boolean;
}

export default function QuizPlayer({ leccionId, inscripcionId, quizData, ultimoIntento, onAprobado, previewMode, readOnlyMode }: Props) {
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<QuizIntentoPublic | null>(ultimoIntento ?? null);
  const [intentosUsados, setIntentosUsados] = useState(ultimoIntento?.intentos_usados ?? 0);
  const [intentosMax, setIntentosMax] = useState(ultimoIntento?.intentos_max ?? 0);
  // Mientras se consulta el último intento al montar, mostramos "cargando" en vez
  // del quiz vacío (evita el parpadeo del quiz en blanco antes de ver el resultado).
  const [cargandoIntento, setCargandoIntento] = useState(!previewMode && !readOnlyMode && !!inscripcionId);

  const preguntas = quizData.preguntas ?? [];

  // Al montar (cambio de lección, por el `key`), restaura el último intento del
  // alumno: si ya aprobó/reprobó lo muestra, y sincroniza el conteo de intentos.
  useEffect(() => {
    if (previewMode || readOnlyMode || !inscripcionId) return;
    let activo = true;
    (quizApi.ultimoIntento(leccionId, inscripcionId) as Promise<QuizIntentoPublic | null>)
      .then((resp) => {
        if (!activo || !resp) return;
        setResultado(resp);
        setIntentosUsados(resp.intentos_usados);
        setIntentosMax(resp.intentos_max);
      })
      .catch(() => { /* sin intento previo o error: se queda como nuevo */ })
      .finally(() => { if (activo) setCargandoIntento(false); });
    return () => { activo = false; };
  }, [leccionId, inscripcionId, previewMode, readOnlyMode]);

  const handleSeleccion = (preguntaId: string, opcionId: string) => {
    setSelecciones((prev) => ({ ...prev, [preguntaId]: opcionId }));
  };

  const handleEnviar = async () => {
    const sinResponder = preguntas.filter((p) => !selecciones[p.id]);
    if (sinResponder.length > 0) {
      setError(`Debes responder todas las preguntas (faltan ${sinResponder.length}).`);
      return;
    }
    setError('');

    // Modo vista previa (admin/instructor): califica localmente sin guardar intento.
    if (previewMode) {
      const respuestas = preguntas.map((p) => {
        const opId = selecciones[p.id];
        const op = p.opciones.find((o) => o.id === opId);
        return { pregunta_id: p.id, opcion_id_seleccionada: opId, es_correcta: !!op?.esCorrecta };
      });
      const correctas = respuestas.filter((r) => r.es_correcta).length;
      const aprobado = preguntas.length > 0 && (correctas / preguntas.length) >= UMBRAL_APROBACION;
      setResultado({
        id: 'preview',
        leccion_id: leccionId,
        aprobado,
        total_preguntas: preguntas.length,
        correctas,
        creado_en: new Date().toISOString(),
        respuestas,
        intentos_usados: 0,
        intentos_max: 0, // 0 = sin límite (vista previa de admin/instructor)
      });
      if (aprobado) onAprobado?.();
      return;
    }

    if (!inscripcionId) {
      setError('Debes estar inscrito para responder el quiz.');
      return;
    }

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
      setIntentosUsados(resp.intentos_usados);
      setIntentosMax(resp.intentos_max);
      if (resp.aprobado) onAprobado?.();
    } catch (e) {
      // El backend devuelve 409 con detalle si ya aprobó o agotó los intentos,
      // y 404 si la lección ya no existe (p.ej. la eliminaron mientras el alumno
      // tenía el curso abierto → su página quedó desactualizada).
      const err = e as { detail?: string; status?: number };
      if (err.status === 404) {
        setError('Esta lección ya no está disponible (pudo haberse eliminado). Recarga la página.');
      } else {
        setError(err.detail || 'Error al enviar el quiz. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleReintentar = () => {
    setResultado(null);
    setSelecciones({});
    setError('');
  };

  // Mientras carga el último intento, evitar mostrar el quiz vacío (parpadeo).
  if (cargandoIntento) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyMsg}>Cargando tu progreso del quiz…</p>
      </div>
    );
  }

  // Mostrar resultado si ya hay uno
  if (resultado) {
    const puedeReintentar =
      !resultado.aprobado && (previewMode || intentosMax === 0 || intentosUsados < intentosMax);
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
        onReintentar={puedeReintentar ? handleReintentar : undefined}
        intentosUsados={previewMode ? 0 : intentosUsados}
        intentosMax={previewMode ? 0 : intentosMax}
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

  if (readOnlyMode) {
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
              Vista de supervisor: revisión de preguntas y respuestas correctas.
            </p>
          </div>
          <div className={styles.counter}>{preguntas.length}</div>
        </div>

        <div className={styles.questionList}>
          {preguntas.map((pregunta, idx) => (
            <ReadOnlyQuestionCard key={pregunta.id} pregunta={pregunta} numero={idx + 1} />
          ))}
        </div>
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
            Necesitas al menos <strong>60%</strong> de aciertos para aprobar.
            {!previewMode && intentosMax > 0 && (
              <> · Intento <strong>{Math.min(intentosUsados + 1, intentosMax)}</strong> de {intentosMax}</>
            )}
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

      {previewMode && (
        <p style={{ fontSize: '0.85rem', color: '#1e40af', background: '#dbeafe', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', margin: '0 0 0.5rem' }}>
          Modo vista previa: las respuestas se califican localmente y no se guardan.
        </p>
      )}

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


function ReadOnlyQuestionCard({ pregunta, numero }: { pregunta: QuizQuestion; numero: number }) {
  return (
    <div className={styles.questionCard}>
      <div className={styles.questionHeader}>
        <span className={styles.questionNum}>{numero}</span>
        <p className={styles.enunciado}>{pregunta.enunciado || 'Sin enunciado'}</p>
      </div>
      <div className={styles.optionsList}>
        {pregunta.opciones.map((opcion) => (
          <div
            key={opcion.id}
            className={`${styles.optionLabel} ${styles.optionReadOnly} ${opcion.esCorrecta ? styles.optionCorrect : ''}`}
          >
            <span className={styles.optionMark}>{opcion.esCorrecta ? '✓' : '○'}</span>
            <span className={styles.optionText}>{opcion.texto}</span>
            {opcion.esCorrecta && <span className={styles.correctBadge}>Correcta</span>}
          </div>
        ))}
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
