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
      <div className={`${styles.container} ${styles.stateCard}`} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.emptyMsg}>Cargando tu progreso del cuestionario…</p>
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
      <div className={`${styles.container} ${styles.stateCard}`}>
        <p className={styles.emptyMsg}>Este cuestionario aún no tiene preguntas configuradas.</p>
      </div>
    );
  }

  const totalLabel = `${preguntas.length} ${preguntas.length === 1 ? 'pregunta' : 'preguntas'}`;

  if (readOnlyMode) {
    return (
      <section className={styles.container} aria-labelledby="quiz-title">
        <header className={styles.head}>
          <span className={styles.tag}>Cuestionario · vista de supervisor</span>
          <h2 id="quiz-title" className={styles.title}>Preguntas y respuestas correctas</h2>
          <p className={styles.meta}>
            {totalLabel}
            <span aria-hidden="true">·</span>
            Se aprueba con 60 % de aciertos
          </p>
        </header>

        <ol className={styles.questionList}>
          {preguntas.map((pregunta, idx) => (
            <ReadOnlyQuestionCard key={pregunta.id} pregunta={pregunta} numero={idx + 1} total={preguntas.length} />
          ))}
        </ol>
      </section>
    );
  }

  const respondidas = preguntas.filter((p) => selecciones[p.id]).length;
  const completo = respondidas === preguntas.length;

  return (
    <section className={styles.container} aria-labelledby="quiz-title">
      <header className={styles.head}>
        <span className={styles.tag}>Cuestionario</span>
        <h2 id="quiz-title" className={styles.title}>Comprueba lo que aprendiste</h2>
        <p className={styles.meta}>
          {totalLabel}
          <span aria-hidden="true">·</span>
          Apruebas con 60 % de aciertos
          {!previewMode && intentosMax > 0 && (
            <>
              <span aria-hidden="true">·</span>
              Intento {Math.min(intentosUsados + 1, intentosMax)} de {intentosMax}
            </>
          )}
        </p>

        <div className={styles.progress}>
          <div
            className={styles.segments}
            role="progressbar"
            aria-label="Preguntas respondidas"
            aria-valuenow={respondidas}
            aria-valuemin={0}
            aria-valuemax={preguntas.length}
          >
            {preguntas.map((p) => (
              <i key={p.id} className={selecciones[p.id] ? styles.segmentOn : undefined} />
            ))}
          </div>
          <span className={styles.progressLabel}>
            {respondidas} de {preguntas.length}
          </span>
        </div>
      </header>

      <ol className={styles.questionList}>
        {preguntas.map((pregunta, idx) => (
          <QuestionCard
            key={pregunta.id}
            pregunta={pregunta}
            numero={idx + 1}
            total={preguntas.length}
            seleccion={selecciones[pregunta.id] ?? null}
            onSeleccion={(opcionId) => handleSeleccion(pregunta.id, opcionId)}
          />
        ))}
      </ol>

      <footer className={styles.footer}>
        {previewMode && (
          <p className={styles.previewNote}>
            Modo vista previa: las respuestas se califican localmente y no se guardan.
          </p>
        )}

        {error && <p className={styles.errorMsg} role="alert">{error}</p>}

        <div className={styles.submitRow}>
          <span className={styles.pendingHint} aria-live="polite">
            {completo
              ? 'Todo listo. Revisa tus respuestas antes de enviar.'
              : `Te ${preguntas.length - respondidas === 1 ? 'falta' : 'faltan'} ${preguntas.length - respondidas} por responder.`}
          </span>
          <button
            type="button"
            className={`ng-btn ng-btn-primary ${styles.submitBtn}`}
            onClick={handleEnviar}
            disabled={enviando || respondidas < preguntas.length}
          >
            {enviando ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </footer>
    </section>
  );
}


function ReadOnlyQuestionCard({ pregunta, numero, total }: { pregunta: QuizQuestion; numero: number; total: number }) {
  return (
    <li className={styles.question}>
      <p className={styles.questionNum}>Pregunta {numero} de {total}</p>
      <p className={styles.enunciado}>{pregunta.enunciado || 'Sin enunciado'}</p>
      <ul className={styles.optionsList}>
        {pregunta.opciones.map((opcion) => (
          <li
            key={opcion.id}
            className={`${styles.option} ${styles.optionReadOnly} ${opcion.esCorrecta ? styles.optionCorrect : ''}`}
          >
            <span className={styles.radio} aria-hidden="true">
              {opcion.esCorrecta && <CheckGlyph />}
            </span>
            <span className={styles.optionText}>{opcion.texto}</span>
            {opcion.esCorrecta && <span className={styles.correctBadge}>Correcta</span>}
          </li>
        ))}
      </ul>
    </li>
  );
}

function QuestionCard({
  pregunta,
  numero,
  total,
  seleccion,
  onSeleccion,
}: {
  pregunta: QuizQuestion;
  numero: number;
  total: number;
  seleccion: string | null;
  onSeleccion: (opcionId: string) => void;
}) {
  return (
    <li className={styles.question}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          <span className={styles.questionNum}>Pregunta {numero} de {total}</span>
          <span className={styles.enunciado}>{pregunta.enunciado || 'Sin enunciado'}</span>
        </legend>
        <div className={styles.optionsList}>
          {pregunta.opciones.map((opcion) => (
            <label
              key={opcion.id}
              className={`${styles.option} ${seleccion === opcion.id ? styles.selected : ''}`}
            >
              <input
                type="radio"
                name={`q-${pregunta.id}`}
                value={opcion.id}
                checked={seleccion === opcion.id}
                onChange={() => onSeleccion(opcion.id)}
                className={styles.optionRadio}
              />
              <span className={styles.radio} aria-hidden="true" />
              <span className={styles.optionText}>{opcion.texto}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </li>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
