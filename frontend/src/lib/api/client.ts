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
      let detail = 'Error desconocido';
      try {
        const body = await response.json();
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body);
      } catch {
        detail = await response.text();
      }
      const error: ApiError = { detail, status: response.status };
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

  async uploadFile<T>(endpoint: string, file: File, fieldName = 'file'): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const error: ApiError = { detail: await response.text(), status: response.status };
      throw error;
    }
    return response.json();
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
  list: (params?: { skip?: number; limit?: number; categoria_id?: string; search?: string; estado?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.categoria_id) qs.set('categoria_id', params.categoria_id);
    if (params?.search) qs.set('search', params.search);
    if (params?.estado) qs.set('estado', params.estado);
    return apiClient.get(`/api/v1/cursos/?${qs}`);
  },
  get: (id: string) => apiClient.get(`/api/v1/cursos/${id}`),
  create: (data: unknown) => apiClient.post('/api/v1/cursos/', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/cursos/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/cursos/${id}`),
  uploadCover: (id: string, file: File) => apiClient.uploadFile(`/api/v1/cursos/${id}/cover`, file),
  // Módulos
  createModulo: (curso_id: string, data: unknown) =>
    apiClient.post(`/api/v1/cursos/${curso_id}/modulos`, data),
  updateModulo: (curso_id: string, modulo_id: string, data: unknown) =>
    apiClient.patch(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}`, data),
  deleteModulo: (curso_id: string, modulo_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}`),
  // Lecciones
  createLeccion: (curso_id: string, modulo_id: string, data: unknown) =>
    apiClient.post(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones`, data),
  updateLeccion: (curso_id: string, modulo_id: string, leccion_id: string, data: unknown) =>
    apiClient.patch(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}`, data),
  deleteLeccion: (curso_id: string, modulo_id: string, leccion_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}`),
  // Recursos
  listRecursos: (curso_id: string, modulo_id: string, leccion_id: string) =>
    apiClient.get(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/recursos`),
  createRecurso: (curso_id: string, modulo_id: string, leccion_id: string, data: unknown) =>
    apiClient.post(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/recursos`, data),
  uploadRecurso: async (curso_id: string, modulo_id: string, leccion_id: string, file: File, titulo?: string) => {
    const url = `${API_URL}/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/recursos/upload`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const form = new FormData();
    form.append('file', file);
    if (titulo) form.append('titulo', titulo);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { method: 'POST', headers, body: form });
    if (!response.ok) {
      const error: ApiError = { detail: await response.text(), status: response.status };
      throw error;
    }
    return response.json();
  },
  deleteRecurso: (curso_id: string, modulo_id: string, leccion_id: string, recurso_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/recursos/${recurso_id}`),
  saveQuizData: (curso_id: string, modulo_id: string, leccion_id: string, quizData: unknown) =>
    apiClient.patch(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}`, { contenido: JSON.stringify(quizData) }),
};

export const inscripcionesApi = {
  mis: () => apiClient.get('/api/v1/inscripciones/me'),
  inscribirse: (curso_id: string) => apiClient.post('/api/v1/inscripciones/', { curso_id }),
  porCurso: (curso_id: string) => apiClient.get(`/api/v1/inscripciones/curso/${curso_id}`),
  porUsuario: (usuario_id: string) => apiClient.get(`/api/v1/inscripciones/usuario/${usuario_id}`),
  cancelar: (inscripcion_id: string) => apiClient.patch(`/api/v1/inscripciones/${inscripcion_id}/cancelar`, {}),
};

export const categoriasApi = {
  list: () => apiClient.get('/api/v1/categorias/'),
  create: (data: unknown) => apiClient.post('/api/v1/categorias/', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/categorias/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/categorias/${id}`),
};

export const etiquetasApi = {
  list: () => apiClient.get('/api/v1/etiquetas/'),
  create: (data: unknown) => apiClient.post('/api/v1/etiquetas/', data),
  asignar: (curso_id: string, etiqueta_id: string) =>
    apiClient.post(`/api/v1/cursos/${curso_id}/etiquetas`, { etiqueta_id }),
  remover: (curso_id: string, etiqueta_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/etiquetas/${etiqueta_id}`),
};

export const usersApi = {
  list: (params?: { skip?: number; limit?: number; rol?: string; estado?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.rol) qs.set('rol', params.rol);
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.search) qs.set('search', params.search);
    return apiClient.get(`/api/v1/users/?${qs}`);
  },
  get: (id: string) => apiClient.get(`/api/v1/users/${id}`),
  create: (data: unknown) => apiClient.post('/api/v1/users/', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/users/${id}`, data),
  updateMe: (data: { email?: string; telefono?: string | null }) => apiClient.patch('/api/v1/users/me', data),
  delete: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
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
  descargar: async (folio: string): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const url = `${API_URL}/api/v1/certificados/descargar/${folio}`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let detail = 'Error al descargar el certificado';
      try { const b = await response.json(); detail = b.detail ?? detail; } catch { /* noop */ }
      throw { detail, status: response.status } as ApiError;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `certificado-${folio.toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  },
};

export const invitacionesApi = {
  crear: (data: { curso_id: string; emails: string[] }) =>
    apiClient.post('/api/v1/invitaciones/', data),
  porCurso: (curso_id: string) =>
    apiClient.get(`/api/v1/invitaciones/curso/${curso_id}`),
  revocar: (id: string) =>
    apiClient.delete(`/api/v1/invitaciones/${id}`),
  canjear: (token: string) =>
    apiClient.post('/api/v1/invitaciones/canjear', { token }),
};

export const quizApi = {
  /** El alumno envía sus respuestas y obtiene resultado inmediato. */
  enviar: (leccion_id: string, data: { inscripcion_id: string; respuestas: { pregunta_id: string; opcion_id: string }[] }) =>
    apiClient.post(`/api/v1/quiz/lecciones/${leccion_id}/enviar`, data),
  /** Último intento del alumno en esta lección. */
  ultimoIntento: (leccion_id: string, inscripcion_id: string) =>
    apiClient.get(`/api/v1/quiz/lecciones/${leccion_id}/ultimo-intento?inscripcion_id=${inscripcion_id}`),
  /** Instructor/admin: todos los resultados de quiz en un curso. */
  resultadosCurso: (curso_id: string) =>
    apiClient.get(`/api/v1/quiz/cursos/${curso_id}/resultados`),
};
