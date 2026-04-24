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
  rol: 'estudiante' | 'instructor' | 'supervisor' | 'usuario_control' | 'administrador';
  is_superuser: boolean;
  is_active: boolean;
  organizacion?: OrganizacionInfo | null;
}

const TOKEN_KEY = 'access_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  // SECURITY TODO (ISO 25010 §6.7): localStorage es vulnerable a XSS.
  // Migrar a HttpOnly cookies requiere que el backend emita la cookie directamente
  // en el endpoint /login/access-token. Mientras tanto, se mitiga con CSP estricto.
  localStorage.setItem(TOKEN_KEY, token);
  // Sincronizar a cookie para que el middleware de Next.js pueda leerlo
  // SECURITY TODO: agregar flag Secure en producción (requiere HTTPS)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `user_rol=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `user_superuser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiClient.loginForm(email, password);
  setToken(data.access_token);
  const user = await getCurrentUser();
  document.cookie = `user_rol=${user.rol}; path=/; SameSite=Lax`;
  document.cookie = `user_superuser=${user.is_superuser ? '1' : '0'}; path=/; SameSite=Lax`;
  return user;
}

export async function logout(): Promise<void> {
  clearToken();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const user = await apiClient.get<AuthUser>('/api/v1/users/me');
  return user;
}

/** Retorna el rol del usuario desde el token almacenado, sin hacer petición. */
export function getRolFromStorage(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.rol ?? null;
  } catch {
    return null;
  }
}
