'use client';

import { apiClient } from './api/client';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  rol: 'estudiante' | 'instructor' | 'usuario_control' | 'administrador';
  is_superuser: boolean;
  is_active: boolean;
}

const TOKEN_KEY = 'access_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Sincronizar a cookie para que el middleware de Next.js pueda leerlo
  document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiClient.loginForm(email, password);
  setToken(data.access_token);
  const user = await getCurrentUser();
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
