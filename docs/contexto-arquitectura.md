# Arquitectura NGcourses — Referencia para nuevos integrantes

> Generado a partir de exploración del código real (julio 2026).  
> Actualizar cuando cambie estructura de modelos, enums, o patrones de código.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLModel + Python 3.10 |
| Base de datos | PostgreSQL 17 |
| Migraciones | Alembic |
| Frontend | Next.js App Router + TypeScript |
| Estilos | Tailwind CSS v4 + CSS Modules + CSS Variables |
| Video | Bunny.net (streaming HLS + upload TUS resumable) |
| Pagos | PayPal |
| PDF | ReportLab (certificados) |
| Infra | Docker Compose + Traefik (prod) |

---

## Estructura de carpetas

```
NGcourses/
├── backend/app/
│   ├── models/          # Modelos SQLModel (tabla + schema Pydantic en mismo archivo)
│   ├── api/routes/      # Un archivo por dominio (cursos, progreso, quiz, etc.)
│   ├── api/deps.py      # Dependencias de FastAPI (auth, roles)
│   ├── services/        # Integraciones externas (bunny, paypal, certificado_pdf)
│   ├── crud.py          # Todas las operaciones de BD centralizadas aquí
│   ├── core/            # config.py, security.py, db.py, limiter.py
│   └── alembic/         # Migraciones
├── frontend/src/
│   ├── app/             # Rutas Next.js App Router
│   │   ├── admin/       # Panel de administración
│   │   ├── instructor/  # Panel de instructor
│   │   ├── supervisor/  # Panel de supervisor
│   │   ├── curso/[id]/  # Ficha pública del curso
│   │   └── curso/[id]/videos/  # Reproductor de lecciones
│   ├── components/course/      # QuizBuilder, QuizPlayer, VideoPlayer, CourseVideoContent
│   ├── lib/api/client.ts       # Cliente HTTP centralizado
│   ├── types/course.ts         # Tipos TypeScript (QuizData, Lesson, Module, Course)
│   └── proxy.ts                # Middleware Next.js: route guards + CSP
└── docs/               # Documentación (este archivo, ROLES.md, PRE-DEPLOY.md)
```

---

## Modelos y relaciones

### Diagrama (texto)

```
User ──────────────────────────────────────────────────────────────────┐
 │ instructor_id                                                        │
 ▼                                                                      │
Curso ──── Categoria                                                    │ usuario_id
 │  └───── CursoEtiqueta ──── Etiqueta                                 │
 │                                                                      │
 ├── Modulo                                                             │
 │    └── Leccion                                                       │
 │         ├── RecursoLeccion                                           │
 │         ├── ProgresoLeccion ◄─────── Inscripcion ◄──────────────────┤
 │         └── QuizIntento ◄────────── Inscripcion                     │
 │              └── QuizRespuesta                                       │
 │                                                                      │
 ├── Inscripcion ──── Certificado                                       │
 ├── Calificacion                                                       │
 │    └── VotoResena                                                    │
 ├── LicenciaCurso ◄── Organizacion ◄── UsuarioOrganizacion ◄──────────┘
 └── Pago

InvitacionCurso (curso_id, email, token_hash)
SolicitudCurso  (organizacion_id, solicitante_id)
  └── ComentarioSolicitud
Notificacion, EventoSistema, RefreshToken, FeatureFlag
```

### Enums importantes

| Enum | Valores |
|------|---------|
| `RolUsuario` | `estudiante`, `instructor`, `supervisor`, `administrador` |
| `EstadoUsuario` | `activo`, `suspendido`, `pendiente_activacion` |
| `TipoLeccion` | `video`, `quiz`, `lectura` |
| `EstadoCurso` | `borrador`, `revision`, `publicado`, `archivado`, `rechazado` |
| `MarcaCurso` | `ram` (solo orgs con licencia), `nextgen` (visible para todos) |
| `EstadoInscripcion` | `activa`, `finalizada`, `cancelado` |
| `EstadoLicencia` | `activa`, `agotada`, `expirada` |
| `EstadoPago` | `pendiente`, `completado`, `fallido`, `cortesia` |
| `RolOrganizacion` | `miembro`, `admin_org` (supervisor de la org) |

### Campos Bunny en BD

| Tabla | Campo | Descripción |
|-------|-------|-------------|
| `cursos` | `bunny_library_id` | ID numérico de la library Bunny del curso |
| `cursos` | `bunny_collection_id` | GUID de la colección Bunny |
| `lecciones` | `bunny_video_id` | GUID del video en Bunny |
| `lecciones` | `hls_url` | URL de stream HLS (se llena al finalizar encoding) |
| `lecciones` | `thumbnail_url` | URL del thumbnail generado por Bunny |

Una lección de tipo `video` sin `bunny_video_id` está pendiente de subir. El estado de encoding se consulta via `BunnyVideoStatusResponse` (`queued|processing|encoding|finished|failed`).

---

## Tipo de lección y shape del campo `contenido`

El campo `Leccion.contenido` es un `Text` en PostgreSQL que almacena un JSON string. Su shape depende de `Leccion.tipo`:

### `tipo = "video"`
`contenido = null`  
El video se referencia vía `bunny_video_id` + `hls_url`.

### `tipo = "quiz"`
```json
{
  "preguntas": [
    {
      "id": "uuid-local-generado-en-frontend",
      "tipo": "multiple_choice",
      "enunciado": "¿Cuál es la capital de Francia?",
      "orden": 1,
      "opciones": [
        { "id": "uuid-opcion", "texto": "Madrid", "esCorrecta": false },
        { "id": "uuid-opcion", "texto": "París", "esCorrecta": true }
      ]
    }
  ]
}
```
`tipo` de pregunta puede ser `"multiple_choice"` o `"true_false"`.

El backend califica en `crud.crear_intento_quiz()` buscando la opción con `esCorrecta: true` por cada pregunta.  
Umbral de aprobación: **≥ 60% de aciertos** (`UMBRAL_APROBACION_QUIZ = 0.60`).  
Intentos máximos: **3** (`MAX_INTENTOS_QUIZ = 3`). Un admin puede reiniciarlos con `crud.reiniciar_intentos_quiz()`.

### `tipo = "lectura"`
Contenido de texto libre (HTML/Markdown). Existe el enum pero el UI de alumno solo muestra texto plano. No hay editor de rich text implementado aún para este tipo.

---

## Quiz editor (instructor)

**Componente:** `frontend/src/components/course/QuizBuilder.tsx`

Editor **estructurado** (no JSON raw). Características:
- Añadir/eliminar preguntas de tipo "Opción múltiple" o "V/F"
- Por pregunta: enunciado, opciones dinámicas, radio para marcar la correcta
- Validación en tiempo real (`quizValidation.ts`): badge "Incompleta" por pregunta
- Auto-save debounced (600 ms) → PATCH al endpoint de contenido de lección
- Indicador de estado: "Guardando..." / "✓ Guardado"

Para un nuevo tipo de contenido interactivo (e.g., conversación de inglés), **hay que construir un editor equivalente** desde cero siguiendo el patrón de `QuizBuilder`.

---

## Flujo progreso → certificado

```
POST /api/v1/progreso/
  └─ crud.upsert_progreso()
       ├─ Crea o actualiza ProgresoLeccion
       ├─ Si progreso_pct ≥ leccion.umbral_completado_pct (default 90%)
       │    → completado = True
       └─ crud.check_and_emit_certificate()
            ├─ crud.curso_completado() → True si TODAS las lecciones vigentes están completas
            ├─ inscripcion.estado = FINALIZADA
            ├─ Valida usuario.full_name (no vacío, sin '@')
            ├─ Genera Certificado (folio "NG-XXXX", hash_verificacion SHA-256)
            └─ services/certificado_pdf.py → PDF guardado en /media/certificados/{folio}.pdf
```

**CP20:** Si se agregan lecciones al curso después de finalizar, la inscripción vuelve a `ACTIVA` y el certificado no se regenera hasta completar el nuevo contenido.

---

## Autenticación y roles

### Backend (`backend/app/api/deps.py`)

JWT en cookie HttpOnly `access_token` (8 días). Las dependencias de FastAPI protegen endpoints:

| Dependency | Quién puede acceder |
|-----------|-------------------|
| `CurrentUser` | Cualquier usuario activo |
| `InstructorOrAbove` | instructor, administrador, superuser |
| `SupervisorOrAbove` | supervisor, administrador, superuser |
| `AdminOrSuperuser` | administrador, superuser |
| `get_current_active_superuser` | Solo `is_superuser=True` |

Ejemplo de uso:
```python
@router.post("/")
def crear_curso(current_user: InstructorOrAbove, session: SessionDep, ...) -> CursoPublic:
```

### Frontend (`frontend/src/proxy.ts`)

Middleware de Next.js que protege rutas antes de renderizar:
- `/admin/**` → requiere `rol === 'administrador'` o `is_superuser`
- `/instructor/**` → requiere `rol === 'instructor'` o superior
- `/supervisor/**` → requiere `rol === 'supervisor'` o superior
- `/cursos`, `/curso`, `/mis-cursos`, `/perfil`, `/pagos` → requiere sesión activa

> **Estado de route guards (julio 2026):** El PRE-DEPLOY.md menciona "Route Guards completos" como pendiente en backlog. El middleware actual protege las rutas principales, pero la cobertura fina (e.g., verificar que el instructor solo edite sus propios cursos) se hace en el backend. No confiar solo en el frontend para control de acceso.

---

## Estilos y sistema visual

**Tailwind CSS v4** (sin `tailwind.config.ts`, usa defaults + plugins PostCSS).  
**CSS Modules** por componente (`.module.css` junto al `.tsx`).  
**Tokens de diseño** en `frontend/src/app/globals.css`:

```css
--color-secondary-30: #00968f;       /* Turquesa PANTONE 7716 C — headers, sidebar */
--color-secondary-30-light: #3DC1CC; /* Turquesa claro — logo */
--color-accent-10: #1B8D56;          /* Verde — botón CTA principal */
--color-primary-60: #F5F7FA;         /* Gris muy claro — fondos */
--color-text-primary: #333333;
--color-text-secondary: #666666;
```

Regla 60-30-10: fondo (60) + turquesa (30) + verde acento (10).

---

## Bunny.net — Flujo de video

1. Instructor crea lección → backend crea video en Bunny (`services/bunny.py`) → devuelve `tus_upload_url`
2. Frontend hace upload TUS resumable al URL de Bunny (componente `VideoUploadButton`)
3. Bunny procesa el video (encoding HLS) → notifica via webhook (`POST /webhooks/bunny`)
4. Backend actualiza `leccion.hls_url`, `leccion.thumbnail_url` al recibir webhook
5. Alumno reproduce via `VideoPlayer` con URL HLS + autenticación Bunny

---

## Background jobs

**No existen** Celery, ARQ, BackgroundTasks de FastAPI, ni ninguna cola de tareas asíncrona.

Todo corre de forma síncrona dentro del request:
- PDF del certificado → se genera en el mismo endpoint de progreso (no-fatal: si falla, el registro de certificado ya existe y el PDF se regenera on-demand)
- Notificaciones → se envían síncronamente o quedan en estado `pendiente`
- Webhooks Bunny → FastAPI los procesa directo

**Impacto para funciones nuevas:** Transcripción de audio, generación de contenido IA, o cualquier tarea de larga duración necesita un patrón nuevo. Opciones a evaluar: `BackgroundTasks` de FastAPI (simple, in-process), ARQ (Redis), o Celery.

---

## Convenciones de código (backend)

### Funciones CRUD
- Siempre `kwargs-only`: `def crear_algo(*, session: Session, param: Tipo) -> Modelo`
- Nombres en español (entidades, funciones, variables del dominio)
- Pattern: `get_X`, `create_X`, `update_X`, `delete_X` por entidad
- Los `get_*` devuelven `None` si no existe — **nunca levantan HTTPException**
- Las rutas validan la existencia y levantan `HTTPException(404)` antes de llamar a crud

### Cascadas de borrado manuales
Los FKs no todos tienen `ON DELETE CASCADE` a nivel DB. Las cascadas se hacen explícitamente en crud. Ejemplos reales:

| Función | Qué borra en cascada |
|---------|---------------------|
| `_purgar_dependientes_leccion()` | `QuizIntento` + `QuizRespuesta` + `ProgresoLeccion` de la lección |
| `delete_modulo()` | Llama a `_purgar_dependientes_leccion()` por cada lección del módulo |
| `delete_curso()` | Progreso → Certificados → Inscripciones → Calificaciones → VotosReseña, luego curso (cascade ORM a módulos/lecciones/recursos) |
| `_delete_user_cascade()` | RefreshToken, Notificacion, EventoAnalytics, VotoResena, Calificacion, Certificado, Inscripcion, Pago, InvitacionCurso, ComentarioSolicitud, SolicitudCurso, UsuarioOrganizacion, Item |
| `delete_organizacion()` | Da de baja a cada miembro primero (revoca accesos), luego borra la org, luego borra cuentas de supervisor |

**Regla:** Al crear una entidad con FK a otra, verificar si necesita purga manual en el borrado del padre.

### Referencias en comentarios

| Prefijo | Significado |
|---------|-------------|
| `ISO 25010 §6.X` | Atributo de calidad del estándar (§6.4 Fiabilidad, §6.5 Mantenibilidad, §6.7 Seguridad) |
| `CP20`, `CP29`... | Caso de Prueba numerado (no hay documento externo; el comentario es la especificación) |
| `FND-003`, `FND-009`... | Decisión de diseño fundamental (JWT en cookie, race condition en certificados, etc.) |

**Convención a seguir:** Añadir estas referencias en comentarios de código nuevo cuando la decisión o restricción no sea obvia del nombre del identificador.

---

## Página de reproducción de lecciones (`/curso/[id]/videos`)

**Archivo:** `frontend/src/app/curso/[id]/videos/page.tsx`  
**Componente principal:** `CourseVideoContent`

Estructura visual (dos columnas):
```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo + user menu (solo modo estudiante)          │
├───────────────────┬─────────────────────────────────────┤
│ LessonsSidebar    │ Área de contenido                   │
│ - Módulos         │  tipo=video  → VideoPlayer (Bunny)  │
│ - Lecciones       │  tipo=quiz   → QuizPlayer           │
│ - Marca completas │  tipo=lectura→ texto                │
│                   │                                     │
│                   │ VideoControls (play, velocidad, etc)│
└───────────────────┴─────────────────────────────────────┘
```

Modos especiales:
- `previewMode=true` — admin/instructor sin inscripción; quiz califica localmente
- `readOnlyMode=true` — supervisor; sin tracking de progreso

Tracking de progreso: cada 10 segundos via `POST /api/v1/progreso/` con `{visto_seg, progreso_pct}`.  
Al llegar al 100% → modal de felicitaciones + folio del certificado.

---

## Bug resuelto: `reenviar_invitacion` duplicada

`crud.py` tenía dos definiciones de `reenviar_invitacion`. La segunda (al final del archivo) sobreescribía a la primera y referenciaba `HTTPException` sin importarlo, causando `NameError` en runtime si se llamaba con un `invitacion_id` inexistente.

**Solución:** Se eliminó el duplicado. La validación 404 ya existía correctamente en la capa de rutas (`invitaciones.py:317-319`, `cursos.py`, `supervisor.py`) antes de llamar a `crud.reenviar_invitacion()`. No se necesita validación adicional en crud.

---

## Lo que NO existe aún (a julio 2026)

- Background jobs / colas de tareas asíncronas
- Rich text editor para lecciones tipo `lectura`
- Route guards finos en frontend (cobertura parcial vía `proxy.ts`)
- Tests automatizados (no se encontró directorio `tests/` con cobertura significativa)
- Lecciones de tipo conversacional / IA interactiva
