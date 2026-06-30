# ANÁLISIS SAST — NGcourses
**Analista:** Titan Alexis | **Plataforma:** NextGen IA | **Fecha:** 2026-06-17  
**Herramientas:** Gitleaks 8.30.1 | Semgrep (pysemgrep) 1.167.0 | Revisión manual  
**Alcance:** Repositorio completo + historial git (220 commits)

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad |
|-----------|----------|
| 🔴 Crítica | 1 |
| 🟠 Alta | 3 |
| 🟡 Media | 5 |
| 🔵 Baja | 5 |
| ℹ️ Info | 2 |
| **Total** | **16** |

El sistema presenta una **postura de seguridad moderada** con buenas prácticas implementadas (JWT en HttpOnly cookie, refresh token hashing, rate limiting, HMAC en webhooks, CSP en frontend). Sin embargo, se identificaron vulnerabilidades reales que requieren atención, destacando credenciales de producción de Bunny.net hardcodeadas en el historial git y un fallo de CSP crítico.

---

## HALLAZGOS CRÍTICOS — ACCIÓN INMEDIATA

### GIT-001 🔴 CRÍTICA — Bunny.net API Keys en historial git
**Ubicación:** `frontend/PROYECTO.md` líneas 48-49  
**Commit:** `45e7d13ab53f91796301c5ad696056bd3df75adf` (Roman Rivera, 2026-01-21)  
**Código expuesto:**
```
BUNNY_API_KEY=f8370c09-4192-4941-bcde72f3c50e-ad1d-4367
BUNNY_TOKEN_KEY=5e74ac0b-bb86-45c1-945b-e6f18ba8ebf5
```
**Impacto:** Acceso no autorizado a la librería de video de Bunny.net. Un atacante puede eliminar videos, subir contenido malicioso, o agotar el ancho de banda de la cuenta. Las claves PERMANECEN en el historial git incluso si el archivo fue modificado posteriormente.  
**CWE:** CWE-798 (Uso de credenciales hardcodeadas)  
**Marco:** OWASP A02:2021 — Cryptographic Failures  
**Recomendación:** Rotar inmediatamente ambas claves en el panel de Bunny.net. Usar `git filter-repo` para purgar el historial. Configurar gitleaks como pre-commit hook.

---

## TODOS LOS HALLAZGOS

### GIT-001 🔴 CRÍTICA
Ver sección anterior.

---

### SEM-001 🟠 ALTA — CSP con 'unsafe-inline' en script-src
**Herramienta:** Revisión manual  
**Ubicación:** `frontend/next.config.ts:31`  
**CWE:** CWE-79 (XSS)  
**OWASP:** A03:2021 — Injection  
**Código:**
```typescript
"script-src 'self' 'unsafe-inline' https://www.paypal.com ..."
```
**Problema:** La directiva `'unsafe-inline'` en `script-src` anula completamente la protección anti-XSS que ofrece el Content Security Policy. Cualquier script inline inyectado por un atacante se ejecutará sin restricción.  
**Impacto:** XSS exitoso puede robar cookies de sesión (aunque las HttpOnly resisten), manipular el DOM, exfiltrar datos del usuario, o escalar el ataque.  
**Recomendación:** Migrar a CSP basado en nonces (`'nonce-{random}'`) generados por el servidor. Next.js soporta nonces desde v14. Eliminar `'unsafe-inline'`.

---

### SEM-002 🟠 ALTA — Password reset token almacenado en texto plano
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/api/routes/login.py:196-197`  
**CWE:** CWE-257 (Almacenamiento de contraseñas en formato recuperable)  
**OWASP:** A02:2021 — Cryptographic Failures  
**Código:**
```python
token = secrets.token_urlsafe(32)
user.password_reset_token = token  # almacena el token RAW en BD
```
**Contexto:** Los refresh tokens sí usan hashing (`security.hash_token(raw_rt)`), pero los tokens de recuperación de contraseña se guardan en claro en la columna `password_reset_token` de la tabla `User`.  
**Impacto:** Una brecha de base de datos expone tokens de reset válidos. Un atacante con acceso de lectura puede resetear contraseñas de cualquier usuario que tenga solicitud pendiente.  
**Recomendación:** Hashear el token antes de guardarlo, al igual que el refresh token: `user.password_reset_token_hash = hash_token(token)`. Buscar en la DB por hash, no por valor raw.

---

### SEM-003 🟠 ALTA — Webhook Bunny.net fail-open sin secret configurado
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/api/routes/webhooks.py:43-47`  
**CWE:** CWE-284 (Control de acceso incorrecto)  
**OWASP:** A01:2021 — Broken Access Control  
**Código:**
```python
if settings.BUNNY_WEBHOOK_SECRET:           # ← Si no está configurado, se salta TODO
    if not bunnycdn_signature or not bunny_svc.verify_webhook_signature(...):
        raise HTTPException(status_code=401, ...)
# Sin secret → cualquier POST pasa sin validación
```
**Contexto:** Si `BUNNY_WEBHOOK_SECRET` no está configurado en el entorno de producción, el endpoint `POST /api/v1/webhooks/bunny` acepta cualquier petición sin autenticación y actualiza URLs de video en la base de datos.  
**Impacto:** Un atacante puede enviar webhooks falsos para marcar videos como "listo" con URLs maliciosas, limpiar `bunny_video_id` (borrando referencia a videos legítimos), o causar disrupciones en el contenido de los cursos.  
**Recomendación:** Invertir la lógica: si no hay secret, rechazar siempre. El comentario en `bunny.py` dice "fail-closed" pero la implementación en `webhooks.py` es fail-open.

---

### SEM-004 🟡 MEDIA — Middleware frontend confía en cookies no-HttpOnly para autorización
**Herramienta:** Revisión manual  
**Ubicación:** `frontend/src/middleware.ts:19-43`  
**CWE:** CWE-345 (Verificación insuficiente de autenticidad de datos)  
**OWASP:** A01:2021 — Broken Access Control  
**Código:**
```typescript
const token = request.cookies.get('access_token')?.value;  // solo verifica PRESENCIA
const userRol = request.cookies.get('user_rol')?.value;     // cookie JS-accessible
const isSuperuser = request.cookies.get('user_superuser')?.value === '1';

// Decisiones de routing basadas en estas cookies
if (userRol !== requiredRole) { redirect... }
```
**Contexto:** El JWT real (HttpOnly) no se valida en el middleware — solo se verifica su presencia. El rol se lee de `user_rol`, una cookie accesible por JavaScript (no-HttpOnly). Ante un XSS, un atacante puede modificar `user_rol=administrador` y navegar al panel admin sin redirección.  
**Impacto:** Bypass de redirecciones de frontend. Las API calls al backend siguen rechazadas (el servidor sí valida el JWT), pero el atacante accede a la UI del panel admin. El impacto se amplifica si hay data en el cliente que no pase por el backend.  
**Recomendación:** El middleware no puede validar un JWT HttpOnly (no accesible en Edge). La alternativa es añadir un endpoint backend `/api/v1/auth/session` que valide el cookie HttpOnly y retorne el rol; usarlo en middleware server-side action o confiar en los guards de componente (que SÍ verifican contra el backend).

---

### SEM-005 🟡 MEDIA — OpenAPI/Swagger expuesto en producción sin restricción
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/main.py:25-29`  
**CWE:** CWE-200 (Exposición de información sensible)  
**OWASP:** A05:2021 — Security Misconfiguration  
**Código:**
```python
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",  # no condicional por entorno
    ...
)
```
**Impacto:** El endpoint `/api/v1/openapi.json` (y `/docs`, `/redoc`) es accesible en producción. Expone la estructura completa de la API, parámetros, modelos de datos y autenticación, facilitando el reconocimiento para atacantes.  
**Recomendación:** Deshabilitar en producción: `openapi_url=None if settings.ENVIRONMENT == "production" else f"{settings.API_V1_STR}/openapi.json"`.

---

### SEM-006 🟡 MEDIA — X-Forwarded-For confiado sin validación de proxy
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/api/routes/login.py:59-60`  
**CWE:** CWE-348 (Uso de información de IP provista por el cliente)  
**OWASP:** A05:2021 — Security Misconfiguration  
**Código:**
```python
ip = (request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
      or (request.client.host if request.client else None))
```
**Contexto:** La dirección IP se extrae del header `X-Forwarded-For` sin verificar que provenga de un proxy confiable. Este header puede ser falsificado por cualquier cliente.  
**Impacto:** Un atacante puede falsificar su IP enviando `X-Forwarded-For: 1.1.1.1` para evadir bloqueos por IP y el registro de `ip_creacion` en los refresh tokens queda corrompido. También afecta al rate limiter (SlowAPI) si usa la misma lógica.  
**Recomendación:** Configurar Traefik para que sobrescriba el header, o usar `request.client.host` directamente en entornos donde Traefik ya elimina headers falsificados. Alternativamente, configurar SlowAPI con `forwarded_for_header` y `trusted_proxies`.

---

### SEM-007 🟡 MEDIA — Backend sin headers CSP y Permissions-Policy
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/main.py:37-47`  
**CWE:** CWE-693 (Mecanismo de protección incorrecto)  
**OWASP:** A05:2021 — Security Misconfiguration  
**Código:**
```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # ← Sin Content-Security-Policy
        # ← Sin Permissions-Policy
```
**Impacto:** La API no incluye CSP ni Permissions-Policy. Si algún endpoint sirve HTML directamente (e.g., `/password-recovery-html-content/`), queda sin protección anti-XSS del lado servidor.  
**Recomendación:** Añadir al middleware: `Content-Security-Policy: default-src 'none'` para respuestas de API (JSON), y `Permissions-Policy: camera=(), microphone=()`.

---

### SEM-008 🟡 MEDIA — BUNNY_WEBHOOK_SECRET débil en entorno local
**Herramienta:** Revisión manual  
**Ubicación:** `.env:83`  
**CWE:** CWE-521 (Requisitos de contraseña débiles)  
**Código:**
```
BUNNY_WEBHOOK_SECRET=dev_webhook_secret_change_me
```
**Contexto:** El archivo `.env` está en `.gitignore` pero existe en disco. El validator `_check_default_secret` en `config.py` solo verifica `SECRET_KEY`, no `BUNNY_WEBHOOK_SECRET`. Este valor placeholder es predecible.  
**Impacto:** Bajo en dev (secret no expuesto externamente), pero si el mismo `.env` se usa para staging/producción sin modificación, el webhook queda con secret débil.  
**Recomendación:** Extender el validator `_check_default_secret` para cubrir `BUNNY_WEBHOOK_SECRET`, o añadir una verificación específica.

---

### SEM-009 🔵 BAJA — `assert` en código de producción eliminable con `-O`
**Herramienta:** Semgrep (gitlab.bandit.B101)  
**Ubicación:** `backend/app/utils.py:39`  
**CWE:** CWE-617 (Reachable Assertion)  
**Código:**
```python
def send_email(...) -> None:
    assert settings.emails_enabled, "no provided configuration for email variables"
```
**Impacto:** Con Python ejecutado en modo optimizado (`-O`), la assertion se elimina y `send_email` procede aunque no haya configuración de email, causando errores oscuros en vez de una excepción clara.  
**Recomendación:** Reemplazar con `if not settings.emails_enabled: raise ValueError(...)`.

---

### SEM-010 🔵 BAJA — Función `generate_password_reset_token` no importada en login.py
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/api/routes/login.py:263`  
**CWE:** CWE-398 (Mala calidad del código)  
**Código:**
```python
@router.post("/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)], ...)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    ...
    password_reset_token = generate_password_reset_token(email=email)  # ← NameError
```
**Contexto:** `generate_password_reset_token` está definida en `utils.py:122` pero no aparece en los imports de `login.py`. El endpoint solo es accesible a superusuarios.  
**Impacto:** El endpoint `/password-recovery-html-content/{email}` falla con `NameError` en runtime. Impacto operacional bajo (es un endpoint de debug).  
**Recomendación:** Agregar `generate_password_reset_token` a los imports de `login.py`.

---

### SEM-011 🔵 BAJA — Excepción silenciosa en creación de refresh token
**Herramienta:** Revisión manual  
**Ubicación:** `backend/app/api/routes/login.py:78-79`  
**CWE:** CWE-390 (Detección de condición de error sin acción)  
**Código:**
```python
    except Exception:
        session.rollback()
    return UserPublic.model_validate(user)
```
**Contexto:** Si la creación del refresh token falla, la excepción se descarta silenciosamente sin logging. El usuario recibe un access token pero sin refresh token, sin saberlo.  
**Impacto:** Dificulta el diagnóstico. El usuario tendrá que re-loguearse al expirar el access token (sin auto-renovación).  
**Recomendación:** Agregar logging: `logger.warning("Refresh token creation failed: %s", exc)`.

---

### SEM-012 🔵 BAJA — Guardias de ruta frontend con flash transitorio
**Herramienta:** Revisión manual  
**Ubicación:** `frontend/src/components/admin/AdminLayout.tsx:20-48`  
**CWE:** CWE-602 (Side-Channel Attack via Timing)  
**Código:**
```typescript
useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.rol !== 'administrador' && !u.is_superuser) {
        router.replace('/');
        return;
      }
      setHeaderUser(...);  // solo entonces se muestran los hijos
    });
}, [router]);

return <div>
  <AdminHeader user={headerUser} ... />  {/* header renders immediately */}
  {headerUser && children}              {/* children wait for auth */}
</div>
```
**Contexto:** La verificación de rol es asíncrona (requiere una petición a `/api/v1/users/me`). Durante ese tiempo el layout del admin se renderiza parcialmente. El middleware de Next.js hace una verificación de primer nivel, pero solo por presencia de cookie, no por validez.  
**Impacto:** Un usuario no autorizado que forcejee la cookie puede ver brevemente la estructura del panel antes de la redirección. El impacto real es bajo ya que los datos los sirve el backend.  
**Recomendación:** Añadir un estado de `loading` que muestre un skeleton o spinner en lugar del layout completo hasta que la autenticación se confirme.

---

### SEM-013 🔵 BAJA — localStorage para avatares (superficie de ataque XSS)
**Herramienta:** Revisión manual  
**Ubicación:** `frontend/src/components/admin/AdminLayout.tsx:27`, `InstructorLayout.tsx:27`  
**CWE:** CWE-922 (Almacenamiento inseguro de información sensible)  
**Código:**
```typescript
const stored = localStorage.getItem(`avatar_${u.id}`);
```
**Contexto:** Solo se almacena una URL de avatar, no credenciales. Sin embargo, cualquier dato en `localStorage` es accesible a scripts maliciosos en caso de XSS.  
**Impacto:** Mínimo en aislamiento (solo URL), pero amplifica superficie si XSS ocurre.  
**Recomendación:** Considerar usar `sessionStorage` en lugar de `localStorage`, o eliminar el almacenamiento local de avatares.

---

### INFO-001 ℹ️ INFO — AWS Account ID expuesto en archivos locales no-git
**Herramienta:** Revisión manual  
**Ubicación:** `.env:19`, `.env.prod:19`  
**Código:**
```
ECR_REGISTRY=[AWS_ECR_REGISTRY_REDACTED]
```
**Contexto:** Archivos gitignoreados. El AWS Account ID es parcialmente público (aparece en ARNs).  
**Impacto:** Muy bajo. Los archivos no están en git. El Account ID solo es útil para atacantes que ya tienen credenciales AWS.  
**Recomendación:** Documentar que estos archivos locales no deben compartirse.

---

### INFO-002 ℹ️ INFO — Dominios de producción expuestos en `.env.prod.example`
**Herramienta:** Revisión manual  
**Ubicación:** `.env.prod.example:1-22`  
**Código:**
```
DOMAIN=nextgenia.lat
FRONTEND_HOST=https://app.nextgenia.lat
BACKEND_CORS_ORIGINS=https://app.nextgenia.lat
```
**Contexto:** El archivo `example` está en git y contiene el dominio real de producción.  
**Impacto:** Mínimo — el dominio es público. Facilita levemente el reconocimiento.  
**Recomendación:** Usar placeholder genérico (`TU-DOMINIO.com`) en lugar del dominio real.

---

## BUENAS PRÁCTICAS IDENTIFICADAS

| Práctica | Ubicación |
|----------|-----------|
| JWT almacenado en HttpOnly cookie (FND-003) | `backend/login.py:46-54` |
| Refresh token rotativo con hash SHA-256 | `backend/security.py:27-28`, `login.py:57-77` |
| Rate limiting en login (5/min), password reset (3/h) | `backend/login.py:28, 187` |
| SameSite=strict en producción (mitiga CSRF) | `backend/login.py:51, 74` |
| HMAC-SHA256 para verificación de webhooks | `backend/services/bunny.py:219-236` |
| `compare_digest` para comparación de firmas (anti-timing) | `backend/services/bunny.py:236` |
| Magic bytes validation en upload de imágenes/recursos | `backend/api/routes/cursos.py:308-319` |
| CSP con nonces preparados en frontend (falta nonce, tiene framework) | `frontend/next.config.ts:29-42` |
| HSTS configurado para HTTPS | `frontend/next.config.ts:54-56` |
| Pydantic validators con `_check_default_secret` | `backend/core/config.py:129-136` |
| OpenAPI deshabilitado en producción sugerido (pero no implementado) | pendiente |
| Cuentas inactivas/suspendidas bloqueadas en auth | `backend/deps.py:59-61` |

---

## MATRIZ DE HALLAZGOS RÁPIDA

| ID | Severidad | Área | CWE | Herramienta | Archivo |
|----|-----------|------|-----|-------------|---------|
| GIT-001 | 🔴 CRÍTICA | Secrets | CWE-798 | Gitleaks | PROYECTO.md:48-49 |
| SEM-001 | 🟠 ALTA | XSS/CSP | CWE-79 | Manual | next.config.ts:31 |
| SEM-002 | 🟠 ALTA | Crypto | CWE-257 | Manual | login.py:196-197 |
| SEM-003 | 🟠 ALTA | AuthZ | CWE-284 | Manual | webhooks.py:43-47 |
| SEM-004 | 🟡 MEDIA | AuthZ | CWE-345 | Manual | middleware.ts:19-43 |
| SEM-005 | 🟡 MEDIA | Config | CWE-200 | Manual | main.py:25-29 |
| SEM-006 | 🟡 MEDIA | Config | CWE-348 | Manual | login.py:59-60 |
| SEM-007 | 🟡 MEDIA | Headers | CWE-693 | Manual | main.py:37-47 |
| SEM-008 | 🟡 MEDIA | Config | CWE-521 | Manual | .env:83 |
| SEM-009 | 🔵 BAJA | Code | CWE-617 | Semgrep | utils.py:39 |
| SEM-010 | 🔵 BAJA | Code | CWE-398 | Manual | login.py:263 |
| SEM-011 | 🔵 BAJA | Code | CWE-390 | Manual | login.py:78-79 |
| SEM-012 | 🔵 BAJA | AuthZ | CWE-602 | Manual | AdminLayout.tsx:20 |
| SEM-013 | 🔵 BAJA | Storage | CWE-922 | Manual | AdminLayout.tsx:27 |
| INFO-001 | ℹ️ INFO | Config | — | Manual | .env:19 |
| INFO-002 | ℹ️ INFO | Config | — | Manual | .env.prod.example:1 |

---

## FALSOS POSITIVOS DESCARTADOS

| Hallazgo | Razón |
|----------|-------|
| Keys en `frontend/.next/cache/.rscinfo` | Auto-generado por Next.js build cache (RSC encryption) |
| Keys en `frontend/.next/*/prerender-manifest.json` | Auto-generado por Next.js (preview mode signing keys) |
| Keys en `frontend/.next/dev/server/server-reference-manifest.json` | Auto-generado |
| Strings en `frontend/.next/dev/static/chunks/*.js` | IDs de componentes React generados por el compilador, no credenciales |
| `BUNNY_API_KEY=put_real_bunny_api_key_here` en `.env` | Placeholder explícito, no credencial real |
| `SECRET_KEY=change_me_...` en `.env.example` | Placeholder intencional con instrucción de cambio |
| `POSTGRES_PASSWORD=change_me` en `.env.example` | Placeholder intencional |

---

*Análisis generado el 2026-06-17. No se realizó ningún cambio al código fuente.*

<!-- TEST GITLEAKS HOOK — BORRAR ANTES DE MERGEAR
BUNNY_API_KEY=deadbeef-cafe-babe-deadbeefcafe-dead-beef
-->
