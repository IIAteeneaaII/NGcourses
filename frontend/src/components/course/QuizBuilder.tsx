'use client';

import React, { useState } from 'react';
import type { QuizData, QuizQuestion, QuizOption, QuestionType } from '@/types/course';
import styles from './QuizBuilder.module.css';

interface Props {
  quizData: QuizData;
  onChange: (quizData: QuizData) => void;
  onSave: (data: QuizData) => void;
}

function createEmptyQuestion(tipo: QuestionType, orden: number): QuizQuestion {
  if (tipo === 'true_false') {
    return {
      id: crypto.randomUUID(),
      tipo,
      enunciado: '',
      orden,
      opciones: [
        { id: crypto.randomUUID(), texto: 'Verdadero', esCorrecta: false },
        { id: crypto.randomUUID(), texto: 'Falso', esCorrecta: false },
      ],
    };
  }
  return {
    id: crypto.randomUUID(),
    tipo,
    enunciado: '',
    orden,
    opciones: [
      { id: crypto.randomUUID(), texto: '', esCorrecta: false },
      { id: crypto.randomUUID(), texto: '', esCorrecta: false },
      { id: crypto.randomUUID(), texto: '', esCorrecta: false },
      { id: crypto.randomUUID(), texto: '', esCorrecta: false },
    ],
  };
}

export default function QuizBuilder({ quizData, onChange, onSave }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newType, setNewType] = useState<QuestionType>('multiple_choice');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const triggerSave = (data: QuizData) => {
    setSaveStatus('saving');
    onSave(data);
    setTimeout(() => setSaveStatus('saved'), 600);
    setTimeout(() => setSaveStatus('idle'), 2200);
  };

  const addQuestion = () => {
    const pregunta = createEmptyQuestion(newType, quizData.preguntas.length + 1);
    const updated: QuizData = { preguntas: [...quizData.preguntas, pregunta] };
    onChange(updated);
    setExpandedId(pregunta.id);
  };

  const deleteQuestion = (qId: string) => {
    const updated: QuizData = {
      preguntas: quizData.preguntas
        .filter((q) => q.id !== qId)
        .map((q, i) => ({ ...q, orden: i + 1 })),
    };
    onChange(updated);
    triggerSave(updated);
  };

  const updateQuestion = (qId: string, patch: Partial<QuizQuestion>) => {
    const updated: QuizData = {
      preguntas: quizData.preguntas.map((q) => q.id === qId ? { ...q, ...patch } : q),
    };
    onChange(updated);
    return updated;
  };

  const updateOption = (qId: string, optId: string, patch: Partial<QuizOption>) => {
    const updated: QuizData = {
      preguntas: quizData.preguntas.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, opciones: q.opciones.map((o) => o.id === optId ? { ...o, ...patch } : o) };
      }),
    };
    onChange(updated);
    return updated;
  };

  const setCorrectOption = (qId: string, optId: string) => {
    const updated: QuizData = {
      preguntas: quizData.preguntas.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, opciones: q.opciones.map((o) => ({ ...o, esCorrecta: o.id === optId })) };
      }),
    };
    onChange(updated);
    return updated;
  };

  return (
    <div className={styles.builderWrapper}>
      <div className={styles.builderHeader}>
        <span className={styles.builderTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Quiz — {quizData.preguntas.length} {quizData.preguntas.length === 1 ? 'pregunta' : 'preguntas'}
        </span>
        {saveStatus !== 'idle' && (
          <span className={`${styles.saveIndicator} ${saveStatus === 'saved' ? styles.saved : ''}`}>
            {saveStatus === 'saving' ? 'Guardando...' : '✓ Guardado'}
          </span>
        )}
      </div>

      <div className={styles.questionList}>
        {quizData.preguntas.map((q, idx) => (
          <div key={q.id} className={styles.questionCard}>
            <div
              className={styles.questionHeader}
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              <span className={styles.questionNum}>{idx + 1}</span>
              <span className={styles.questionPreview}>
                {q.enunciado || <em className={styles.emptyEnunciado}>Sin enunciado</em>}
              </span>
              <span className={styles.questionTypeBadge}>
                {q.tipo === 'multiple_choice' ? 'Opción múltiple' : 'V / F'}
              </span>
              <button
                type="button"
                className={styles.deleteQuestionBtn}
                onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                title="Eliminar pregunta"
                aria-label={`Eliminar pregunta ${idx + 1}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={expandedId === q.id ? styles.chevronOpen : styles.chevron}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>

            {expandedId === q.id && (
              <div className={styles.questionBody}>
                <div className={styles.fieldGroup}>
                  <label htmlFor={`enunciado-${q.id}`} className={styles.fieldLabel}>Enunciado</label>
                  <textarea
                    id={`enunciado-${q.id}`}
                    className={styles.enunciadoInput}
                    rows={2}
                    placeholder="Escribe la pregunta..."
                    value={q.enunciado}
                    onChange={(e) => updateQuestion(q.id, { enunciado: e.target.value })}
                    onBlur={(e) => {
                      const updated = updateQuestion(q.id, { enunciado: e.target.value });
                      triggerSave(updated);
                    }}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Opciones — marca la respuesta correcta con el radio
                  </label>
                  <div className={styles.optionsList}>
                    {q.opciones.map((opt) => (
                      <div key={opt.id} className={`${styles.optionRow} ${opt.esCorrecta ? styles.correct : ''}`}>
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={opt.esCorrecta}
                          onChange={() => { const updated = setCorrectOption(q.id, opt.id); triggerSave(updated); }}
                          className={styles.optionRadio}
                          title="Marcar como correcta"
                          aria-label={`Marcar "${opt.texto || `Opción ${q.opciones.indexOf(opt) + 1}`}" como respuesta correcta`}
                        />
                        {q.tipo === 'true_false' ? (
                          <span className={styles.optionTextFixed}>{opt.texto}</span>
                        ) : (
                          <input
                            type="text"
                            className={styles.optionTextInput}
                            placeholder={`Opción ${q.opciones.indexOf(opt) + 1}`}
                            value={opt.texto}
                            onChange={(e) => updateOption(q.id, opt.id, { texto: e.target.value })}
                            onBlur={(e) => {
                              const updated = updateOption(q.id, opt.id, { texto: e.target.value });
                              triggerSave(updated);
                            }}
                            aria-label={`Texto de opción ${q.opciones.indexOf(opt) + 1}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.addQuestionBar}>
        <select
          className={styles.typeSelect}
          value={newType}
          onChange={(e) => setNewType(e.target.value as QuestionType)}
        >
          <option value="multiple_choice">Opción múltiple</option>
          <option value="true_false">Verdadero / Falso</option>
        </select>
        <button type="button" className={styles.addQuestionBtn} onClick={addQuestion}>
          + Agregar pregunta
        </button>
      </div>
    </div>
  );
}
