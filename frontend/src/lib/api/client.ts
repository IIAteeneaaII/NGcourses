// Rutas relativas → proxeadas por Next.js a BACKEND_URL (server-side)
// Las cookies HttpOnly se envían automáticamente en requests same-origin (FND-003)
const API_URL = '';

export interface ApiError {
  detail: string;
  status: number;
}

/**
 * fetch para endpoints autenticados que NO pasan por ApiClient.request (subida y
 * descarga de archivos con FormData/blob). Espeja su manejo de sesión: si el
 * access token (cookie HttpOnly, de vida corta) ya expiró y la respuesta es 401,
 * intenta refrescarlo una vez y reintenta. Evita el 401 intermitente al
 * subir/descargar recursos, portadas y certificados.
 */
async function fetchConRefresh(input: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(input, init);
  if (resp.status !== 401 || typeof window === 'undefined') return resp;
  const refreshed = await fetch('/api/v1/login/refresh-token', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false);
  return refreshed ? fetch(input, init) : resp;
}

class ApiClient {
  private baseUrl: string;
  private _refreshInProgress: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private tryRefresh(): Promise<boolean> {
    if (!this._refreshInProgress) {
      this._refreshInProgress = fetch('/api/v1/login/refresh-token', { method: 'POST' })
        .then(r => r.ok)
        .catch(() => false)
        .finally(() => { this._refreshInProgress = null; });
    }
    return this._refreshInProgress;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    skipRefresh = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
      // Nunca servir datos autenticados desde caché del navegador: evita que,
      // tras revocar acceso/baja de curso, una respuesta vieja siga vigente.
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401 && !skipRefresh && typeof window !== 'undefined') {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return this.request<T>(endpoint, options, true);
        }
        // Refresh fallido: limpiar cookies de rol y redirigir al login
        // Solo redirigir si no estamos ya en la raíz (evita loop infinito)
        ['user_rol', 'user_superuser'].forEach(k => {
          document.cookie = `${k}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        });
        // No botar al login en rutas públicas: un visitante sin sesión que abre
        // p.ej. /activar o /invitacion no debe ser redirigido a session_expired
        // por la sonda de sesión global (ProfileSetupGate -> authApi.me()).
        const publicPrefixes = ['/invitacion', '/activar', '/reset-password', '/forgot-password'];
        const path = window.location.pathname;
        const isPublic = path === '/' || publicPrefixes.some((p) => path.startsWith(p));
        if (!isPublic) {
          window.location.href = '/?error=session_expired';
        }
        return undefined as T;
      }

      let detail = 'Error desconocido';
      try {
        const text = await response.text();
        try {
          const body = JSON.parse(text);
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body);
        } catch {
          detail = text || detail;
        }
      } catch {
        // ignorar error al leer body
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
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetchConRefresh(url, { method: 'POST', body: formData });
    if (!response.ok) {
      let detail = 'Error desconocido';
      try {
        const text = await response.text();
        try {
          const body = JSON.parse(text);
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body);
        } catch {
          detail = text || detail;
        }
      } catch { /* keep default */ }
      const error: ApiError = { detail, status: response.status };
      throw error;
    }
    return response.json();
  }

  /** Login con OAuth2 form data — el backend emite cookie HttpOnly con el JWT */
  async loginForm(email: string, password: string): Promise<import('@/lib/auth').AuthUser> {
    const url = `${this.baseUrl}/api/v1/login/access-token`;
    const body = new URLSearchParams({ username: email, password });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      let detail = 'Error desconocido';
      try {
        const text = await response.text();
        try {
          const b = JSON.parse(text);
          detail = typeof b.detail === 'string' ? b.detail : text;
        } catch { detail = text || detail; }
      } catch { /* noop */ }
      const error: ApiError = { detail, status: response.status };
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
  list: (params?: { skip?: number; limit?: number; categoria_id?: string; search?: string; estado?: string; destacado?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.categoria_id) qs.set('categoria_id', params.categoria_id);
    if (params?.search) qs.set('search', params.search);
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.destacado !== undefined) qs.set('destacado', String(params.destacado));
    return apiClient.get(`/api/v1/cursos/?${qs}`);
  },
  /** Endpoint publico (sin auth): cursos destacados para el carrete del login. */
  destacados: (limit = 12) =>
    apiClient.get(`/api/v1/cursos/destacados?limit=${limit}`),
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
    const form = new FormData();
    form.append('file', file);
    if (titulo) form.append('titulo', titulo);
    const response = await fetchConRefresh(url, { method: 'POST', body: form });
    if (!response.ok) {
      const error: ApiError = { detail: await response.text(), status: response.status };
      throw error;
    }
    return response.json();
  },
  deleteRecurso: (curso_id: string, modulo_id: string, leccion_id: string, recurso_id: string) =>
    apiClient.delete(`/api/v1/cursos/${curso_id}/modulos/${modulo_id}/lecciones/${leccion_id}/recursos/${recurso_id}`),
  // Descarga autenticada de un recurso (el archivo ya NO es público vía /media).
  descargarRecurso: async (recurso_id: string): Promise<void> => {
    const resp = await fetchConRefresh(`${API_URL}/api/v1/cursos/recursos/${recurso_id}/download`, { cache: 'no-store' });
    if (!resp.ok) {
      let detail = 'No se pudo descargar el recurso';
      try { const b = await resp.json(); detail = b.detail ?? detail; } catch { /* noop */ }
      throw { detail, status: resp.status } as ApiError;
    }
    const cd = resp.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = match?.[1] || 'recurso';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  },
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
  /** Alta de empleado (estudiante) ligado a una organización; envía correo de activación. */
  createEmpresa: (data: { email: string; full_name?: string | null; organizacion_id?: string }) =>
    apiClient.post('/api/v1/users/empresa', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/users/${id}`, data),
  updateMe: (data: { email?: string; telefono?: string | null; full_name?: string }) => apiClient.patch('/api/v1/users/me', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.patch('/api/v1/users/me/password', data),
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

export const pagosApi = {
  /** Crea una orden PayPal y un Pago(pendiente) en el backend. */
  crearOrden: (curso_id: string) =>
    apiClient.post('/api/v1/pagos/crear-orden', { curso_id }) as Promise<{
      pago_id: string;
      paypal_order_id: string;
      monto: string;
      moneda: string;
    }>,
  /** Captura la orden y desbloquea el curso (crea Inscripcion). */
  confirmar: (pago_id: string, paypal_order_id: string) =>
    apiClient.post('/api/v1/pagos/confirmar', { pago_id, paypal_order_id }) as Promise<{
      pago_id: string;
      status: 'pendiente' | 'completado' | 'fallido' | 'cortesia';
      inscripcion_id: string | null;
    }>,
  /** Historial de pagos del usuario autenticado. */
  misCompras: () => apiClient.get('/api/v1/pagos/mis-compras') as Promise<{
    data: Array<{
      id: string;
      curso_id: string;
      curso_titulo: string | null;
      monto: string;
      moneda: string;
      status: 'pendiente' | 'completado' | 'fallido' | 'cortesia';
      created_at: string;
      referencia_paypal: string | null;
    }>;
    count: number;
  }>,
  /** Admin: desbloqueo manual sin pago (cortesia). */
  cortesia: (usuario_id: string, curso_id: string) =>
    apiClient.post('/api/v1/pagos/admin/cortesia', { usuario_id, curso_id }),
};

export const certificadosApi = {
  mis: () => apiClient.get('/api/v1/certificados/me'),
  verificar: (folio: string) => apiClient.get(`/api/v1/certificados/verificar/${folio}`),
  descargar: async (folio: string): Promise<void> => {
    const url = `${API_URL}/api/v1/certificados/descargar/${folio}`;
    const response = await fetchConRefresh(url);
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
  reenviar: (id: string) =>
    apiClient.post(`/api/v1/invitaciones/${id}/reenviar`, {}),
};

export const organizacionesApi = {
  list: (params?: { skip?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    return apiClient.get(`/api/v1/organizaciones/?${qs}`);
  },
  get: (id: string) => apiClient.get(`/api/v1/organizaciones/${id}`),
  create: (data: unknown) => apiClient.post('/api/v1/organizaciones/', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/v1/organizaciones/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/organizaciones/${id}`),
  listMiembros: (id: string) => apiClient.get(`/api/v1/organizaciones/${id}/miembros`),
  asignarMiembro: (id: string, data: { user_id: string; rol_org?: string }) =>
    apiClient.post(`/api/v1/organizaciones/${id}/miembros`, data),
  quitarMiembro: (id: string, user_id: string) =>
    apiClient.delete(`/api/v1/organizaciones/${id}/miembros/${user_id}`),
  crearSupervisor: (id: string, data: { email: string; full_name: string; telefono?: string }) =>
    apiClient.post(`/api/v1/organizaciones/${id}/supervisor`, data),
  listLicencias: (id: string) => apiClient.get(`/api/v1/organizaciones/${id}/licencias`),
  asignarLicencia: (id: string, curso_id: string) =>
    apiClient.post(`/api/v1/organizaciones/${id}/licencias`, { curso_id }),
  quitarLicencia: (id: string, curso_id: string) =>
    apiClient.delete(`/api/v1/organizaciones/${id}/licencias/${curso_id}`),
};

export const supervisorApi = {
  miOrganizacion: () => apiClient.get('/api/v1/supervisor/mi-organizacion'),
  cursos: () => apiClient.get('/api/v1/supervisor/cursos'),
  usuarios: () => apiClient.get('/api/v1/supervisor/usuarios'),
  crearUsuario: (data: { email: string; password: string; full_name?: string; telefono?: string }) =>
    apiClient.post('/api/v1/supervisor/usuarios', data),
  quitarUsuario: (user_id: string) => apiClient.delete(`/api/v1/supervisor/usuarios/${user_id}`),
  invitar: (data: { curso_id: string; emails: string[] }) =>
    apiClient.post('/api/v1/supervisor/invitaciones', data),
  listarInvitaciones: () => apiClient.get('/api/v1/supervisor/invitaciones'),
  reenviarInvitacion: (id: string) =>
    apiClient.post(`/api/v1/supervisor/invitaciones/${id}/reenviar`, {}),
  revocarInvitacion: (id: string) =>
    apiClient.delete(`/api/v1/supervisor/invitaciones/${id}`),
  stats: () => apiClient.get('/api/v1/supervisor/stats'),
  crearSolicitud: (data: { titulo_solicitud: string; descripcion?: string }) =>
    apiClient.post('/api/v1/supervisor/solicitudes', data),
  listarSolicitudes: () => apiClient.get('/api/v1/supervisor/solicitudes'),
};

// Solicitudes de curso de los supervisores, vistas/gestionadas por el admin (CP09).
export const solicitudesAdminApi = {
  listar: () => apiClient.get('/api/v1/solicitudes'),
  actualizar: (id: string, data: { estado: string; comentario?: string }) =>
    apiClient.patch(`/api/v1/solicitudes/${id}`, data),
};

// Feature flags: interruptores de funcionalidad controlados por el admin.
export interface FeatureFlag {
  nombre: string;
  habilitado: boolean;
  actualizado_en: string;
}

export const featureFlagsApi = {
  list: () => apiClient.get('/api/v1/feature-flags') as Promise<FeatureFlag[]>,
  set: (nombre: string, habilitado: boolean) =>
    apiClient.patch(`/api/v1/feature-flags/${nombre}`, { habilitado }) as Promise<FeatureFlag>,
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
  /** Admin/instructor: reinicia los intentos de un alumno en una lección de quiz. */
  reiniciarIntentos: (leccion_id: string, usuario_id: string) =>
    apiClient.post(`/api/v1/quiz/lecciones/${leccion_id}/reiniciar-intentos`, { usuario_id }),
};
