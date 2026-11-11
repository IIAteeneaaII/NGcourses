'use client';

import { useEffect, useState } from 'react';
import { calificacionesApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './CourseReviews.module.css';

interface Calificacion {
  id: string;
  comentario: string | null;
  titulo: string | null;
  estrellas: number;
  creado_en: string;
}

interface CalificacionesResp {
  data: Calificacion[];
  count: number;
}

interface CourseReviewsProps {
  courseId: string;
  /** Solo quien ya terminó el curso puede dejar reseña (el backend lo valida). */
  canReview?: boolean;
  /** Alumno inscrito que aún no termina: se le explica cuándo podrá calificar. */
  reviewLockedHint?: string | null;
}

const dateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= value ? styles.starOn : styles.starOff}>★</span>
      ))}
    </span>
  );
}

/**
 * Reseñas del curso. Viven en la ficha del curso (no en cada lección) porque
 * califican el curso completo.
 */
export default function CourseReviews({ courseId, canReview = false, reviewLockedHint = null }: CourseReviewsProps) {
  const [items, setItems] = useState<Calificacion[] | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (calificacionesApi.list(courseId) as Promise<CalificacionesResp>)
      .then((r) => setItems(r.data ?? []))
      .catch((e) => {
        logError('CourseReviews/list', e);
        setItems([]);
      });
  }, [courseId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estrellas === 0) {
      setMsg({ ok: false, text: 'Elige de 1 a 5 estrellas para publicar tu reseña.' });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      await calificacionesApi.create(courseId, { estrellas, comentario: texto.trim() || undefined });
      const r = (await calificacionesApi.list(courseId)) as CalificacionesResp;
      setItems(r.data ?? []);
      setTexto('');
      setEstrellas(0);
      setMsg({ ok: true, text: 'Reseña publicada.' });
    } catch (err) {
      // 409: ya reseñaste este curso. 403: no estás inscrito.
      const detail = (err as { detail?: string })?.detail;
      setMsg({ ok: false, text: detail || 'No se pudo publicar la reseña. Inténtalo de nuevo.' });
    } finally {
      setSending(false);
    }
  };

  const promedio = items && items.length > 0 ? items.reduce((s, c) => s + c.estrellas, 0) / items.length : 0;

  return (
    <section id="resenas" className={styles.reviews} aria-labelledby="reviews-title">
      <div className={styles.head}>
        <h2 id="reviews-title" className={styles.title}>Reseñas</h2>
        {items && items.length > 0 && (
          <span className={styles.summary}>
            <b>{promedio.toFixed(1)}</b> de 5 · {items.length} {items.length === 1 ? 'reseña' : 'reseñas'}
          </span>
        )}
      </div>

      {!canReview && reviewLockedHint && (
        <p className={styles.locked}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinejoin="round" d="M12 17.3l-6.2 3.7 1.7-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.8 1.7 7z" />
          </svg>
          <span>{reviewLockedHint}</span>
        </p>
      )}

      {canReview && (
        <form className={styles.form} onSubmit={submit}>
          <fieldset className={styles.rating}>
            <legend className={styles.label}>Tu calificación</legend>
            <div className={styles.starPicker}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={styles.starOption}>
                  <input
                    type="radio"
                    name="estrellas"
                    value={n}
                    checked={estrellas === n}
                    onChange={() => setEstrellas(n)}
                  />
                  <span aria-hidden="true" className={n <= estrellas ? styles.starOn : styles.starOff}>★</span>
                  <span className={styles.srOnly}>{n} {n === 1 ? 'estrella' : 'estrellas'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="review-text" className={styles.label}>Comentario (opcional)</label>
          <textarea
            id="review-text"
            className={styles.textarea}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="¿Qué te pareció el curso?"
          />
          <div className={styles.formFoot}>
            <span className={styles.hint}>Terminaste el curso: tu opinión ayuda a otros alumnos. Puedes dejar una reseña por curso.</span>
            <button type="submit" className="ng-btn ng-btn-primary" disabled={sending}>
              {sending ? 'Publicando…' : 'Publicar reseña'}
            </button>
          </div>
          {msg && (
            <p role="status" className={msg.ok ? styles.ok : styles.error}>{msg.text}</p>
          )}
        </form>
      )}

      {items === null ? (
        <p className={styles.empty}>Cargando reseñas…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Este curso todavía no tiene reseñas.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((c) => (
            <li key={c.id} className={styles.item}>
              <div className={styles.meta}>
                <Stars value={c.estrellas} />
                <time dateTime={c.creado_en}>{dateFormat.format(new Date(c.creado_en))}</time>
              </div>
              {c.titulo && <p className={styles.itemTitle}>{c.titulo}</p>}
              {c.comentario && <p className={styles.itemText}>{c.comentario}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
