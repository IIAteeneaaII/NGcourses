const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApiError {
  detail: string;
  status: number;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = {
        detail: await response.text(),
        status: response.status,
      };
      throw error;
    }

    // 204 No Content
    if (response.status === 204) return undefined as T;

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /** Login con OAuth2 form data */
  async loginForm(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const url = `${this.baseUrl}/api/v1/login/access-token`;
    const body = new URLSearchParams({ username: email, password });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error: ApiError = { detail: await response.text(), status: response.status };
      throw error;
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_URL);

// ── APIs tipadas ────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) => apiClient.loginForm(email, password),
  me: () => apiClient.get('/api/v1/users/me'),
};

export const cursosApi = {
  list: (params?: { skip?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiClient.get(`/api/v1/cursos/?${qs}`);
  },
  get: (id: string) => apiClient.get(`/api/v1/cursos/${id}`),
  create: (data: unknown) => apiClient.post('/api/v1/cursos/', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/cursos/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/cursos/${id}`),
};

export const inscripcionesApi = {
  mis: () => apiClient.get('/api/v1/inscripciones/me'),
  inscribirse: (curso_id: string) => apiClient.post('/api/v1/inscripciones/', { curso_id }),
};

export const progresoApi = {
  registrar: (data: { inscripcion_id: string; leccion_id: string; visto_seg: number; progreso_pct: number }) =>
    apiClient.post('/api/v1/progreso/', data),
  curso: (curso_id: string) => apiClient.get(`/api/v1/progreso/curso/${curso_id}`),
};

export const videoApi = {
  initUpload: (curso_id: string, modulo_id: string, leccion_id: string) =>
    apiClient.post(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/video-init`),
  status: (curso_id: string, modulo_id: string, leccion_id: string) =>
    apiClient.get(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/video-status`),
  delete: (curso_id: string, modulo_id: string, leccion_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/video`),
};

export const calificacionesApi = {
  list: (curso_id: string) => apiClient.get(`/api/v1/calificaciones/cursos/${curso_id}`),
  create: (curso_id: string, data: unknown) => apiClient.post(`/api/v1/calificaciones/cursos/${curso_id}`, data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/calificaciones/${id}`, data),
  votar: (id: string, voto: number) => apiClient.post(`/api/v1/calificaciones/${id}/votar`, { voto }),
};

export const certificadosApi = {
  mis: () => apiClient.get('/api/v1/certificados/me'),
  verificar: (folio: string) => apiClient.get(`/api/v1/certificados/verificar/${folio}`),
};
