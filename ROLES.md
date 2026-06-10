# NGcourses — Roles de usuario (referencia completa)

> Última actualización: 2026-06-10. Documento de referencia del modelo de usuarios para la beta.
> Para la beta se trabaja con **4 roles**: **Administrador, Supervisor, Instructor, Alumno**.
> Existe además `usuario_control` en el enum (heredado) — ver §8, recomendación: no usarlo.

---

## 1. Panorama: dos dimensiones de identidad

Un usuario tiene **dos clasificaciones independientes**:

1. **Rol de plataforma** (`User.rol`, enum `RolUsuario`): qué puede hacer en el sistema.
   `estudiante · instructor · supervisor · administrador` (+ `usuario_control` heredado).
2. **Pertenencia a organización** (tabla `usuarios_organizacion`, enum `RolOrganizacion`):
   a qué empresa pertenece y si la administra → `miembro` · `admin_org`.

Además existe el flag `User.is_superuser` (booleano): **root del sistema**, ortogonal al rol.

Mapeo típico en la beta (una empresa):
| Persona real | `rol` (plataforma) | `rol_org` (organización) |
|---|---|---|
| Empleado que toma cursos | `estudiante` | `miembro` |
| Contacto/RH de la empresa | `supervisor` | `admin_org` |
| Autor de contenido (NextGen) | `instructor` | — (no atado a la empresa) |
| Operador de la plataforma (NextGen) | `administrador` | — |

---

## 2. Modelo de datos (PostgreSQL)

### Tabla `user` (modelo `User`, `backend/app/models/user.py`)
Campos relevantes a roles/acceso:
- `id` (uuid, PK)
- `email` (único, indexado)
- `hashed_password`
- `is_active: bool` — **candado de acceso real**: `get_current_user` lo valida en cada request.
- `is_superuser: bool` — root del sistema.
- `rol: RolUsuario` — `estudiante|instructor|supervisor|administrador|usuario_control` (default `estudiante`).
- `estado: EstadoUsuario` — `activo|suspendido|pendiente_activacion` (default `activo`).
- `token_activacion` / `token_activacion_expira` — activación de cuenta (uso único, 72 h).
- `password_reset_token` / `password_reset_expira` — recuperación de contraseña.
- `full_name`, `telefono`, `telefono_e164`, `whatsapp_opt_in`, `notif_prefs`.

Relaciones: `cursos_instructor` (cursos que imparte), `inscripciones`, `calificaciones`, `certificados`, `notificaciones`.

> **Invariante (corregido 2026-06-10):** `estado` e `is_active` se mantienen sincronizados en `crud.update_user`: `activo → is_active=True`; `suspendido|pendiente_activacion → is_active=False`. Y `get_current_user` rechaza además `estado==suspendido` (defensa en profundidad).

### Tabla `organizaciones` (modelo `Organizacion`)
`id, nombre, rfc, dominio_corporativo, estado (activa|inactiva), email_contacto, telefono_contacto, plan_de_cursos, fecha_compra, metadata`.

### Tabla `usuarios_organizacion` (junction `UsuarioOrganizacion`)
- `id, organizacion_id (FK), usuario_id (FK), rol_org (miembro|admin_org), creado_en`.
- Unique `(organizacion_id, usuario_id)` → un usuario aparece una vez por org.
- Es **la** fuente de verdad de "a qué empresa pertenece" y "quién la administra".

### Tablas relacionadas
- `licencias_curso` (`LicenciaCurso`): asientos/licencia de un curso para una org. `estado: activa|agotada|expirada`.
- `solicitudes_curso` (`SolicitudCurso`): petición de una org para que se le habilite un curso. `solicitante_id, organizacion_id, titulo_solicitud, descripcion, estado (abierta|en_revision|aprobada|rechazada|cerrada)`; con `comentarios_solicitud`.
- `cursos` (`Curso`): `estado (borrador|revision|publicado|archivado)`, `instructor_id`.
- `inscripcion` (`Inscripcion`): vincula `usuario_id ↔ curso_id`, `estado (activa|finalizada|cancelado)`.

---

## 3. Vínculo con el backend (autenticación y guardias)

- **Login** (`POST /login/access-token`): emite JWT en cookie HttpOnly `access_token` (fallback Bearer para Swagger). Rechaza si `not is_active`.
- **`get_current_user`** (`backend/app/api/deps.py`): decodifica el JWT, carga el `User`, y **bloquea si `not is_active` o `estado==suspendido`**. Es el candado que atraviesan todas las rutas autenticadas.
- **Dependencies de rol** (composables, se inyectan por endpoint):
  - `CurrentUser` — cualquier usuario autenticado y activo.
  - `require_admin_or_superuser` → `AdminOrSuperuser` = `administrador` **o** `is_superuser`.
  - `require_supervisor_or_above` → `SupervisorOrAbove` = `{supervisor, administrador, usuario_control}` o superuser.
  - `require_instructor_or_above` → `InstructorOrAbove` = `{instructor, administrador, usuario_control}` o superuser.
  - `get_current_active_superuser` — solo `is_superuser`.

## 4. Vínculo con el frontend (ruteo por rol)

- **`frontend/src/middleware.ts`** protege por prefijo de ruta usando cookies `access_token`, `user_rol`, `user_superuser`:
  - `/admin/*` → requiere `administrador` (o superuser).
  - `/supervisor/*` → requiere `supervisor`.
  - `/instructor/*` → requiere `instructor`.
  - `/cursos, /curso, /mis-cursos, /perfil, /pagos` → solo requieren sesión.
  - En `/` con sesión activa, redirige al **home del rol** (`administrador→/admin`, `supervisor→/supervisor`, `instructor→/instructor`, resto→`/cursos`).
- Rol incorrecto para un prefijo → redirige al home propio con `?error=role`.
- `ProfileSetupGate` (root layout) sondea `authApi.me()`; en rutas públicas no fuerza logout (corregido 2026-06-10).

---

## 5. ADMINISTRADOR

**Quién es:** operador de la plataforma (lado NextGen). Es el rol con más alcance fuera del superuser.

**Flujo:** inicia sesión → aterriza en `/admin` → gestiona usuarios, cursos, organizaciones, instructores, alumnos y solicitudes.

**A nivel interfaz (`frontend/src/app/admin/`):**
- `/admin` — dashboard.
- `/admin/usuarios` — listar/crear/editar usuarios; **dar de baja/reactivar** (toggle `estado`); reenviar activación; cancelar invitación (borrar usuario pendiente).
- `/admin/usuarios/crear` — "Alta empresa" (`POST /users/empresa`): crea cuenta pendiente + correo de activación.
- `/admin/alumnos`, `/admin/instructores` — vistas segmentadas por rol.
- `/admin/cursos` y `/admin/cursos/[id]/invitaciones` — gestión de cursos e invitaciones a alumnos por curso.
- `/admin/organizaciones` — crear/gestionar organizaciones y su supervisor (admin_org).
- `/admin/solicitudes` — revisar/aprobar/rechazar solicitudes de curso de las organizaciones.
- `/admin/perfil`.

**A nivel técnico (endpoints, guardia `AdminOrSuperuser` salvo nota):**
- `users.py`: `POST /users/` (crea pendiente+activación), `POST /users/empresa`, `PATCH /users/{id}`, `DELETE /users/{id}`, `GET /users/` (listado/filtros), `POST /users/{id}/reenviar-activacion`.
- `cursos.py`: alta/edición/publicación de cursos; invitaciones por curso (`/cursos/{id}/invitaciones`, **solo admin/superuser**).
- `invitaciones.py`: `POST /invitaciones/` (enviar), listar, reenviar, revocar.
- `organizaciones.py`: CRUD de organizaciones; crear supervisor (rol `supervisor` + `admin_org`).
- `certificados.py`, `categorias.py`, `etiquetas.py`, etc.: administración general.

**Permisos clave:** crear/editar/suspender cualquier usuario (salvo que modificar cuentas `administrador` exige `is_superuser`); no puede auto-promoverse a superuser; aprueba publicación de cursos; gestiona organizaciones y licencias.

**BD:** `user.rol='administrador'`. Normalmente sin fila en `usuarios_organizacion` (no pertenece a una empresa cliente).

---

## 6. SUPERVISOR

**Quién es:** persona de la empresa cliente que administra a su gente (RH/líder). En BD es `admin_org` de su organización.

**Flujo:** login → `/supervisor` → ve su organización, invita empleados, sigue su progreso/stats, solicita cursos.

**A nivel interfaz (`frontend/src/app/supervisor/`):**
- `/supervisor` — dashboard de la organización.
- `/supervisor/mi-organizacion` — datos de la org, miembros, licencias.
- `/supervisor/usuarios` — alta/baja de empleados de su organización.
- `/supervisor/invitaciones` — enviar/listar/reenviar/revocar invitaciones a cursos para su gente.
- `/supervisor/cursos` — cursos disponibles para la organización.
- `/supervisor/solicitudes` — abrir solicitudes de curso (que el admin revisa).

**A nivel técnico (`backend/app/api/routes/supervisor.py`, guardia `SupervisorOrAbove`):**
- `GET /supervisor/mi-organizacion`, `GET /supervisor/cursos`, `GET /supervisor/stats`.
- `GET/POST/DELETE /supervisor/usuarios` — gestiona miembros de **su** org.
- `POST/GET /supervisor/invitaciones`, `POST .../{id}/reenviar`, `DELETE .../{id}`.
- Las invitaciones crean la cuenta del alumno como pendiente y envían correo de activación (mismo flujo que admin).

**Permisos clave:** **acotado a su propia organización** (no ve usuarios/datos de otras empresas). Invita y da de baja empleados de su org; no administra la plataforma ni publica cursos.

**BD:** `user.rol='supervisor'` + fila en `usuarios_organizacion` con `rol_org='admin_org'` apuntando a su `organizacion_id`. Sus empleados: `rol='estudiante'` + `rol_org='miembro'` de la misma org.

---

## 7. INSTRUCTOR

**Quién es:** autor de contenido. Crea y mantiene cursos; pide su publicación. **No gestiona alumnos ni invitaciones** (eso se removió: ya no tiene página de invitaciones).

**Flujo:** login → `/instructor` → crea curso (`borrador`) → lo manda a `revision` → el **administrador** lo publica (`publicado`).

**A nivel interfaz (`frontend/src/app/instructor/`):**
- `/instructor` — dashboard.
- `/instructor/cursos` — crear/editar sus cursos, lecciones, recursos, quizzes.
- `/instructor/alumnos` — ver alumnos inscritos en sus cursos (lectura/seguimiento).
- `/instructor/perfil`.
- *(Removido: `/instructor/invitaciones`.)*

**A nivel técnico (`cursos.py`, guardia `InstructorOrAbove`; ownership por `instructor_id`):**
- Crear/editar curso y su contenido (lecciones, recursos, quiz) **propios**.
- Cambiar estado de su curso a `revision` (solicitar publicación). La transición a `publicado` la hace admin.
- Acceso a contenido de cursos no publicados solo si es owner o admin (`cursos.py:159`).

**Permisos clave:** CRUD sobre **sus** cursos/contenido; sin acceso al panel admin/supervisor; sin invitaciones.

**BD:** `user.rol='instructor'`; `cursos.instructor_id = user.id` para sus cursos. Normalmente sin `usuarios_organizacion`.

---

## 8. ALUMNO (ESTUDIANTE)

**Quién es:** usuario final que toma cursos. Rol por defecto (`RolUsuario.ESTUDIANTE`). En la beta, empleado de la empresa (`miembro` de la org).

**Flujo de alta (activación por correo, sin contraseña expuesta):**
1. Es invitado a un curso (por admin o supervisor) **o** dado de alta por admin.
2. Recibe correo **"Activa tu cuenta"** con enlace a `/activar?token=…` (cuenta nace `pendiente_activacion`, `is_active=False`).
3. En `/activar` fija su contraseña → cuenta pasa a `activo`/`is_active=True` (token de uso único).
4. Inicia sesión y accede a sus cursos.

**A nivel interfaz (rutas que solo requieren sesión):**
- `/cursos` — catálogo. `/curso/[id]` — detalle/reproductor. `/mis-cursos` — inscritos y progreso.
- `/perfil` — datos personales. `/pagos` — pagos (si aplica). `/activar`, `/invitacion`, `/reset-password`, `/forgot-password` — públicas.

**A nivel técnico (guardia `CurrentUser`):**
- `inscripciones.py` / `progreso.py` — su inscripción y avance.
- `quiz.py`, `calificaciones.py` — responder quizzes, ver calificaciones.
- `certificados.py` — su certificado al completar (requiere `full_name`).
- `users.py` `PATCH /users/me`, `/me/password` — autoservicio de perfil.

**Permisos clave:** solo sus propios datos, cursos en los que está inscrito y cursos `publicado`. Sin acceso a paneles de gestión.

**BD:** `user.rol='estudiante'`; inscripciones en `inscripcion`; en beta, fila en `usuarios_organizacion` con `rol_org='miembro'`.

---

## 9. usuario_control (heredado) y is_superuser

- **`usuario_control`**: existe en el enum y aparece en `_INSTRUCTOR_ROLES` y `_SUPERVISOR_ROLES` (puede hacer casi todo lo de instructor + supervisor), pero **no** pasa `require_admin_or_superuser`. Solapa fuertemente con `administrador` y **no tiene UI propia ni caso de uso claro**. **Recomendación: no asignarlo en la beta.** Si en el futuro se necesita un auditor de solo-lectura, definirlo como rol explícito y acotado.
- **`is_superuser`**: root del sistema (no es un valor de `rol`). Puede todo, incluido crear/modificar administradores. Reservar para 1–2 cuentas de operación.

---

## 10. Ciclo de vida del estado de cuenta (`EstadoUsuario`)
```
[creada por invitación/admin] → pendiente_activacion (is_active=False)
        │  usa enlace /activar y fija contraseña
        ▼
     activo (is_active=True) ←──reactivar── suspendido (is_active=False)
        │  admin/supervisor "da de baja"
        └──────────────────────────────────►
```
- `pendiente_activacion`: no puede iniciar sesión; reenvío vía `/users/{id}/reenviar-activacion` o `/users/solicitar-reactivacion`.
- `suspendido`: acceso revocado de inmediato (sincronizado con `is_active` + chequeo en `get_current_user`).
- `activo`: operativo.
