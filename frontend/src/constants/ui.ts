/**
 * Constantes de UI — ISO 25010 §6.5 Mantenibilidad
 * Centraliza valores mágicos para facilitar su modificación y auditoría.
 */

/** Ítems por página en tablas paginadas (alumnos, cursos). */
export const ITEMS_PER_PAGE = 10;

/** Intervalo de throttle para guardar progreso de video (ms). */
export const PROGRESS_THROTTLE_MS = 10_000;

/** Tiempo que permanece visible el indicador "Guardado" (ms). */
export const SAVE_INDICATOR_SHOW_MS = 600;

/** Tiempo hasta que el indicador "Guardado" desaparece (ms). */
export const SAVE_INDICATOR_HIDE_MS = 2_200;

/** Duración de la notificación de lección completada (ms). */
export const COMPLETION_NOTIFY_MS = 2_000;
