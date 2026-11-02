/**
 * Tema claro/oscuro.
 *
 * El tema vive en el atributo `data-theme` de <html>; globals.css redefine las
 * variables de color bajo `[data-theme="dark"]`. La preferencia se guarda en
 * localStorage. Sin preferencia guardada se usa el tema claro.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ng-theme';

/**
 * Script que corre antes del primer pintado (inyectado en <head> por el layout)
 * para aplicar el tema guardado y evitar el parpadeo claro → oscuro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();`;

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage bloqueado (modo privado estricto): el tema aplica solo a esta sesión.
  }
}

/** Notifica cambios de `data-theme` en <html> (para useSyncExternalStore). */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
