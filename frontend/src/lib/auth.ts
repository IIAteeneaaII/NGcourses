'use client';

import { apiClient } from './api/client';

export interface OrganizacionInfo {
  id: string;
  nombre: string;
  rol_org: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  rol: 'estudiante' | 'instructor' | 'supervisor' | 'administrador';
  is_superuser: boolean;
  is_active: boolean;
  organizacion?: OrganizacionInfo | null;
}

// Cookies no-HttpOnly para que el proxy (server-side) pueda leer el rol.
// El JWT real se maneja como HttpOnly cookie emitida por el backend (FND-003).
export function setRolCookies(rol: string, isSuperuser: boolean): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `user_rol=${rol}; path=/; SameSite=Strict${secure}`;
  document.cookie = `user_superuser=${isSuperuser ? '1' : '0'}; path=/; SameSite=Strict${secure}`;
}

export function clearRolCookies(): void {
  ['user_rol', 'user_superuser'].forEach(k => {
    document.cookie = `${k}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
}

export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('user_rol='));
}

export async function login(email: string, password: string): Promise<AuthUser> {
  // El backend emite la cookie HttpOnly access_token y devuelve UserPublic
  const user = await apiClient.loginForm(email, password);
  setRolCookies(user.rol, user.is_superuser);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/v1/logout');
  } catch {
    // ignorar errores de red en logout
  }
  clearRolCookies();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const user = await apiClient.get<AuthUser>('/api/v1/users/me');
  return user;
}
