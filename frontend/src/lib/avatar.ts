/**
 * Foto de perfil. Vive en el servidor (avatar_url del usuario); antes se
 * guardaba en localStorage como data URL. Al leerla se borra la copia vieja del
 * navegador para liberar ese espacio.
 */
export function avatarOf(user: { id: string; avatar_url?: string | null }): string | null {
  try {
    localStorage.removeItem(`avatar_${user.id}`);
  } catch {
    // almacenamiento no disponible: no pasa nada
  }
  return user.avatar_url ?? null;
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Valida en el navegador antes de subir; el backend vuelve a validar. */
export function avatarFileError(file: File): string | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) return 'Usa una imagen JPG, PNG o WEBP.';
  if (file.size > AVATAR_MAX_BYTES) return 'La foto pesa más de 2 MB. Elige una más ligera.';
  return null;
}
