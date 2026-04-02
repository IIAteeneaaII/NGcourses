/**
 * Logger centralizado — ISO 25010 §6.4 Fiabilidad
 *
 * Reemplaza los bloques `.catch(() => {})` silenciosos para que los errores
 * sean al menos observables durante el desarrollo y puedan conectarse a un
 * servicio de monitoreo (Sentry, Datadog, etc.) en producción.
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Registra un error de forma que sea visible en desarrollo y extensible
 * para enviar a un servicio de monitoreo en producción.
 *
 * @param context - Identificador del lugar donde ocurrió el error (e.g., 'CourseVideoContent/saveProgress')
 * @param error   - El error capturado
 */
export function logError(context: string, error: unknown): void {
  if (isDev) {
    console.error(`[Error] ${context}:`, error);
  }
  // TECH DEBT: conectar aquí a Sentry u otro servicio de monitoreo en producción.
  // Ejemplo: Sentry.captureException(error, { extra: { context } });
}

/**
 * Registra un aviso (no bloqueante) en desarrollo.
 */
export function logWarn(context: string, message: string): void {
  if (isDev) {
    console.warn(`[Warn] ${context}: ${message}`);
  }
}
