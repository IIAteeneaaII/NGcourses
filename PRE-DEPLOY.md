<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1c2b3a; background: white; font-size: 14px; line-height: 1.6; }

  /* Header */
  .doc-header { background: #0A2647; color: white; padding: 40px 40px 32px; margin-bottom: 40px; }
  .doc-header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }
  .doc-header .meta { font-size: 0.82rem; color: rgba(255,255,255,0.55); letter-spacing: 0.5px; }
  .doc-header .meta span { margin-right: 24px; }

  /* Section headings */
  h2 { font-size: 1.1rem; font-weight: 700; color: #0A2647; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 2px solid #0A2647; padding-bottom: 8px; margin: 44px 0 20px; }
  h3 { font-size: 0.9rem; font-weight: 700; color: #2C74B3; text-transform: uppercase; letter-spacing: 1px; margin: 28px 0 12px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 0.84rem; }
  thead th { background: #0A2647; color: white; padding: 10px 14px; text-align: left; font-weight: 600; letter-spacing: 0.3px; }
  tbody td { padding: 9px 14px; border-bottom: 1px solid #e4eaf0; color: #2d3f50; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }

  /* Code */
  code { background: #eef2f7; color: #2C74B3; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; font-family: 'Cascadia Code', 'Fira Code', monospace; }
  pre { background: #0A2647; color: #cfe2f3; padding: 20px 24px; border-radius: 6px; font-size: 0.78rem; line-height: 1.7; margin: 16px 0; }

  /* Cards & boxes */
  .card { background: white; border: 1px solid #dde5ee; border-radius: 6px; padding: 18px 20px; }
  .card-accent { border-left: 3px solid #2C74B3; }

  /* Diagram containers */
  .diagram { background: #f7f9fc; border: 1px solid #dde5ee; border-radius: 8px; padding: 28px 24px; margin: 16px 0 28px; }

  /* Badge */
  .badge { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.5px; text-transform: uppercase; }
  .badge-red { background: #fde8e8; color: #c0392b; }
  .badge-yellow { background: #fef9e7; color: #b7770d; }
  .badge-green { background: #eafaf1; color: #1a7a40; }

  /* Page break */
  .page-break { page-break-before: always; height: 0; }

  /* Label pill */
  .pill { display: inline-block; background: #e8f0fe; color: #1a56b0; font-size: 0.7rem; font-weight: 600; padding: 2px 9px; border-radius: 20px; }

  p { margin: 8px 0 14px; color: #3d5166; font-size: 0.86rem; }
</style>

<div class="doc-header">
  <h1>Pre-Deploy — NGcourses</h1>
  <div class="meta">
    <span>Versión 2</span>
    <span>2026-04-09</span>
    <span>Escenario: 300 estudiantes</span>
  </div>
</div>

## 1. Arquitectura del Proyecto

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Next.js App Router | 16.1.4 |
| UI | React | 19.2.3 |
| Lenguaje FE | TypeScript | ^5 |
| Backend | FastAPI | ^0.114 |
| Lenguaje BE | Python | 3.10 |
| ORM | SQLModel (SQLAlchemy + Pydantic) | ^0.0.21 |
| Base de Datos | PostgreSQL | 17 |
| Migraciones | Alembic | ^1.12 |
| Auth | JWT HS256 — 8 días | PyJWT ^2.8 |
| Video CDN | Bunny.net — TUS resumable | — |
| Generación PDF | ReportLab | ^4.2 |
| Monitoreo | Sentry | ^1.40 |
| Reverse Proxy | Traefik + Let's Encrypt | — |
| Contenedores | Docker Compose | — |
| Gestor de paquetes BE | uv | — |

### Diagrama de Servicios

<div class="diagram">
  <div style="display:flex;flex-direction:column;align-items:center;gap:0;">

    <!-- Internet -->
    <div style="border:1.5px solid #8aaac8;background:white;border-radius:5px;padding:9px 36px;font-size:0.8rem;font-weight:600;color:#0A2647;letter-spacing:0.5px;">INTERNET</div>
    <div style="width:1px;height:20px;background:#8aaac8;"></div>

    <!-- Traefik -->
    <div style="background:#0A2647;color:white;border-radius:5px;padding:10px 40px;font-size:0.85rem;font-weight:700;letter-spacing:0.5px;">TRAEFIK  <span style="font-weight:400;font-size:0.72rem;opacity:0.7;">Reverse Proxy · SSL/TLS</span></div>
    <div style="width:1px;height:20px;background:#8aaac8;"></div>

    <!-- Three services -->
    <div style="display:flex;gap:12px;align-items:flex-start;width:100%;justify-content:center;">

      <div style="flex:1;max-width:200px;">
        <div style="width:1px;height:20px;background:#8aaac8;margin:0 auto;"></div>
        <div style="border:1.5px solid #2C74B3;border-radius:5px;padding:12px 14px;text-align:center;background:white;">
          <div style="font-weight:700;font-size:0.82rem;color:#0A2647;">NEXT.JS</div>
          <div style="font-size:0.7rem;color:#6b8aaa;margin-top:3px;">dashboard.DOMAIN · :3000</div>
        </div>
      </div>

      <div style="flex:1;max-width:200px;">
        <div style="width:1px;height:20px;background:#8aaac8;margin:0 auto;"></div>
        <div style="border:1.5px solid #2C74B3;border-radius:5px;padding:12px 14px;text-align:center;background:white;">
          <div style="font-weight:700;font-size:0.82rem;color:#0A2647;">FASTAPI</div>
          <div style="font-size:0.7rem;color:#6b8aaa;margin-top:3px;">api.DOMAIN · :8000</div>
          <div style="width:1px;height:18px;background:#8aaac8;margin:10px auto 0;"></div>
          <!-- Deps row -->
          <div style="display:flex;gap:6px;justify-content:center;margin-top:0;">
            <div style="border:1px solid #dde5ee;border-radius:4px;padding:6px 8px;font-size:0.68rem;color:#3d5166;background:#f7f9fc;text-align:center;min-width:60px;">PostgreSQL<br><span style="color:#8aaac8;">Base de datos</span></div>
            <div style="border:1px solid #dde5ee;border-radius:4px;padding:6px 8px;font-size:0.68rem;color:#3d5166;background:#f7f9fc;text-align:center;min-width:60px;">Bunny.net<br><span style="color:#8aaac8;">Video CDN</span></div>
            <div style="border:1px solid #dde5ee;border-radius:4px;padding:6px 8px;font-size:0.68rem;color:#3d5166;background:#f7f9fc;text-align:center;min-width:50px;">SMTP<br><span style="color:#8aaac8;">Email</span></div>
            <div style="border:1px solid #dde5ee;border-radius:4px;padding:6px 8px;font-size:0.68rem;color:#3d5166;background:#f7f9fc;text-align:center;min-width:50px;">Sentry<br><span style="color:#8aaac8;">Errores</span></div>
          </div>
        </div>
      </div>

      <div style="flex:1;max-width:200px;">
        <div style="width:1px;height:20px;background:#8aaac8;margin:0 auto;"></div>
        <div style="border:1.5px solid #2C74B3;border-radius:5px;padding:12px 14px;text-align:center;background:white;">
          <div style="font-weight:700;font-size:0.82rem;color:#0A2647;">ADMINER</div>
          <div style="font-size:0.7rem;color:#6b8aaa;margin-top:3px;">adminer.DOMAIN</div>
        </div>
      </div>

    </div>

    <!-- Docker label -->
    <div style="margin-top:20px;border:1px dashed #8aaac8;border-radius:4px;padding:4px 16px;font-size:0.7rem;color:#6b8aaa;letter-spacing:0.5px;">Orquestado con Docker Compose</div>
  </div>
</div>

### Jerarquía de Roles

<div class="diagram" style="padding:20px;">
  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="background:#0A2647;color:white;padding:10px 0;width:420px;text-align:center;border-radius:4px 4px 0 0;font-size:0.82rem;font-weight:700;letter-spacing:0.5px;">SUPERUSER <span style="font-weight:400;opacity:0.6;font-size:0.72rem;">· is_superuser=true · acceso total</span></div>
    <div style="background:#144272;color:white;padding:10px 0;width:380px;text-align:center;font-size:0.82rem;font-weight:700;letter-spacing:0.5px;">ADMINISTRADOR / USUARIO_CONTROL <span style="font-weight:400;opacity:0.6;font-size:0.72rem;">· gestión global</span></div>
    <div style="background:#205295;color:white;padding:10px 0;width:300px;text-align:center;font-size:0.82rem;font-weight:700;letter-spacing:0.5px;">INSTRUCTOR <span style="font-weight:400;opacity:0.6;font-size:0.72rem;">· sus propios cursos</span></div>
    <div style="background:#2C74B3;color:white;padding:10px 0;width:220px;text-align:center;border-radius:0 0 4px 4px;font-size:0.82rem;font-weight:700;letter-spacing:0.5px;">ESTUDIANTE <span style="font-weight:400;opacity:0.6;font-size:0.72rem;">· cursos inscritos</span></div>
  </div>
</div>

### Rutas del Sistema

| Panel | Rutas | Rol mínimo |
|-------|-------|-----------|
| Público | `/` · `/invitacion` | — |
| Alumno | `/cursos` · `/curso/[id]` · `/curso/[id]/videos` · `/mis-cursos` · `/perfil` | ESTUDIANTE |
| Instructor | `/instructor/**` | INSTRUCTOR |
| Admin | `/admin/**` | ADMINISTRADOR |

---

## 2. Happy Path

### 2.1 Admin: Crear y publicar un curso

<div class="diagram" style="padding:24px 20px;">
  <div style="display:flex;align-items:stretch;gap:0;overflow:hidden;justify-content:center;">

    <div style="flex:1;max-width:130px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#0A2647;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">1</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Login</div>
      <div style="font-size:0.65rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST<br>/login/access-token</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px;color:#c5d3de;font-size:1rem;">›</div>

    <div style="flex:1;max-width:130px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#144272;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">2</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Crear Curso</div>
      <div style="font-size:0.65rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST /cursos/<br>(borrador)</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px;color:#c5d3de;font-size:1rem;">›</div>

    <div style="flex:1;max-width:130px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#205295;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">3</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Portada + Módulos</div>
      <div style="font-size:0.65rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST /cover<br>POST /modulos</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px;color:#c5d3de;font-size:1rem;">›</div>

    <div style="flex:1;max-width:130px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#2C74B3;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">4</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Subir Video</div>
      <div style="font-size:0.65rem;color:#8aaac8;margin-top:5px;line-height:1.4;">TUS → Bunny.net<br>Webhook responde</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px;color:#c5d3de;font-size:1rem;">›</div>

    <div style="flex:1;max-width:130px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#2C74B3;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">5</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Agregar Quiz</div>
      <div style="font-size:0.65rem;color:#8aaac8;margin-top:5px;line-height:1.4;">tipo=QUIZ<br>en lección</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px;color:#c5d3de;font-size:1rem;">›</div>

    <div style="flex:1;max-width:130px;border:1px solid #2C74B3;border-radius:5px;padding:14px 10px;text-align:center;background:#f0f6ff;">
      <div style="background:#0A2647;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">6</div>
      <div style="font-weight:700;font-size:0.78rem;color:#0A2647;">Publicar + Invitar</div>
      <div style="font-size:0.65rem;color:#2C74B3;margin-top:5px;line-height:1.4;">estado=PUBLICADO<br>POST /invitaciones</div>
    </div>

  </div>
</div>

### 2.2 Alumno: Tomar un curso y obtener certificado

<div class="diagram" style="padding:24px 20px;">
  <div style="display:flex;align-items:stretch;gap:0;justify-content:center;">

    <div style="flex:1;max-width:115px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#0A2647;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">1</div>
      <div style="font-weight:700;font-size:0.76rem;color:#0A2647;">Invitación</div>
      <div style="font-size:0.63rem;color:#8aaac8;margin-top:5px;line-height:1.4;">Token por email<br>/invitacion?token</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 3px;color:#c5d3de;">›</div>

    <div style="flex:1;max-width:115px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#144272;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">2</div>
      <div style="font-weight:700;font-size:0.76rem;color:#0A2647;">Registro</div>
      <div style="font-size:0.63rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST<br>/users/signup</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 3px;color:#c5d3de;">›</div>

    <div style="flex:1;max-width:115px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#205295;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">3</div>
      <div style="font-weight:700;font-size:0.76rem;color:#0A2647;">Inscribirse</div>
      <div style="font-size:0.63rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST<br>/inscripciones/</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 3px;color:#c5d3de;">›</div>

    <div style="flex:1;max-width:115px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#2C74B3;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">4</div>
      <div style="font-weight:700;font-size:0.76rem;color:#0A2647;">Ver Lecciones</div>
      <div style="font-size:0.63rem;color:#8aaac8;margin-top:5px;line-height:1.4;">HLS stream<br>Bunny.net CDN</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 3px;color:#c5d3de;">›</div>

    <div style="flex:1;max-width:115px;border:1px solid #dde5ee;border-radius:5px;padding:14px 10px;text-align:center;background:white;">
      <div style="background:#2C74B3;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">5</div>
      <div style="font-weight:700;font-size:0.76rem;color:#0A2647;">Quiz + Progreso</div>
      <div style="font-size:0.63rem;color:#8aaac8;margin-top:5px;line-height:1.4;">POST /progreso/<br>POST /quiz/</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 3px;color:#c5d3de;">›</div>

    <div style="flex:1;max-width:115px;border:1px solid #2C74B3;border-radius:5px;padding:14px 10px;text-align:center;background:#0A2647;">
      <div style="background:white;color:#0A2647;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;margin-bottom:8px;">6</div>
      <div style="font-weight:700;font-size:0.76rem;color:white;">Certificado</div>
      <div style="font-size:0.63rem;color:rgba(255,255,255,0.55);margin-top:5px;line-height:1.4;">≥ 90% completado<br>PDF auto-generado</div>
    </div>

  </div>
</div>

### 2.3 Flujo de Certificación Automática

<div class="diagram" style="padding:24px;">
  <div style="display:flex;flex-direction:column;align-items:center;">

    <div style="border:1.5px solid #0A2647;background:#0A2647;color:white;border-radius:5px;padding:10px 32px;font-size:0.8rem;font-weight:700;letter-spacing:0.3px;">Alumno completa lección — POST /progreso/</div>
    <div style="width:1px;height:18px;background:#8aaac8;"></div>

    <div style="border:1.5px solid #2C74B3;background:white;border-radius:5px;padding:10px 32px;font-size:0.8rem;font-weight:700;color:#0A2647;">¿Progreso ≥ 90%?</div>

    <div style="display:flex;gap:80px;margin-top:0;align-items:flex-start;">

      <!-- No branch -->
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:1px;height:18px;background:#8aaac8;"></div>
        <div style="font-size:0.68rem;color:#8aaac8;margin-bottom:4px;font-weight:600;">NO</div>
        <div style="border:1px solid #dde5ee;background:#f7f9fc;border-radius:5px;padding:9px 18px;font-size:0.76rem;color:#3d5166;font-weight:600;text-align:center;">Actualiza barra<br>de progreso</div>
      </div>

      <!-- Yes branch -->
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:1px;height:18px;background:#8aaac8;"></div>
        <div style="font-size:0.68rem;color:#8aaac8;margin-bottom:4px;font-weight:600;">SÍ</div>
        <div style="border:1px solid #2C74B3;background:#f0f6ff;border-radius:5px;padding:9px 22px;font-size:0.76rem;color:#0A2647;font-weight:600;text-align:center;">check_and_emit_certificate</div>
        <div style="width:1px;height:14px;background:#8aaac8;"></div>
        <div style="border:1px solid #dde5ee;background:white;border-radius:5px;padding:9px 22px;font-size:0.76rem;color:#3d5166;text-align:center;">Genera PDF (ReportLab)<br>Guarda <code>Certificado</code> en DB</div>
        <div style="width:1px;height:14px;background:#8aaac8;"></div>
        <div style="border:1.5px solid #0A2647;background:#0A2647;color:white;border-radius:5px;padding:9px 22px;font-size:0.76rem;font-weight:700;text-align:center;">GET /certificados/descargar/{folio}<br><span style="font-weight:400;opacity:0.65;font-size:0.7rem;">Descarga PDF con folio único</span></div>
      </div>

    </div>
  </div>
</div>

<div class="page-break"></div>

---

## 3. Errores Encontrados Durante el Desarrollo

| # | Área | Error | Causa | Solución |
|---|------|-------|-------|---------|
| 1 | Backend | CORS bloqueaba todas las peticiones | Orígenes no configurados en FastAPI | Configurar `BACKEND_CORS_ORIGINS` + regex para tunnels locales |
| 2 | Backend | Eliminar curso dejaba huérfanos en DB | Cascada `ON DELETE` no definida | Cascada manual en `delete_curso` antes del DELETE padre |
| 3 | Backend | Certificado generaba antes de persistir progreso | `await` faltante en cadena async | Awaitar `upsert_progreso` antes de `check_and_emit_certificate` |
| 4 | Frontend | Error de hidratación SSR en Next.js | Diferencia HTML servidor/cliente por `localStorage` | `suppressHydrationWarning` en elemento `<html>` |
| 5 | Frontend | Imágenes externas bloqueadas | `remotePatterns` no configurado en next.config | Agregar patrones `localhost:8000` y `https://**/media/**` |
| 6 | Frontend | Conflicto con middleware de Next.js | `middleware.ts` con nombre reservado del framework | Renombrar a `proxy.ts` |
| 7 | Frontend | Pantalla en blanco en curso sin lecciones | `CourseVideoContent` sin guard para array vacío | Agregar condicional antes de renderizar el player |
| 8 | Frontend | Turbopack fallaba en modo dev | Root mal apuntado en configuración | Corregir `appDir` en next.config |
| 9 | Frontend | Certificado no descargaba en modal | Endpoint incorrecto invocado directamente | Usar `certificadosApi.descargar(folio)` del cliente API |
| 10 | Frontend | Logo/sello del PDF desproporcionados | Coordenadas hardcodeadas sin escala | Ajustar dimensiones relativas en ReportLab |
| 11 | Frontend | Cursos desordenados en dashboard instructor | Sin `ORDER BY fecha_creacion` | Reordenar lista en el componente |
| 12 | Frontend | Imagen de curso rompía layout | `<img>` sin dimensiones fallback | Agregar `onError` con imagen placeholder |

---

## 4. Costos — 300 Estudiantes

<p>Estimación mensual en USD. Supuestos: 20 cursos activos · 10 videos/curso · 45 min/video · 40% alumnos activos/mes · 3 h de video visto por alumno activo.</p>

### Cálculo de Bunny.net

| Concepto | Cálculo | Resultado |
|---------|---------|-----------|
| Videos totales | 20 cursos × 10 videos | 200 videos |
| Tamaño promedio por video | 45 min a 720p (~675 MB/h) | ~506 MB/video |
| **Storage total** | 200 × 506 MB | **~100 GB** |
| Costo storage | 100 GB × $0.005/GB | **$0.50/mes** |
| Alumnos activos/mes | 300 × 40% | 120 alumnos |
| Tráfico de video | 120 × 3 h × 675 MB/h | **~240 GB/mes** |
| Costo CDN zona LATAM | 240 GB × $0.045/GB | **$10.80/mes** |
| Costo CDN zona US/EU | 240 GB × $0.010/GB | $2.40/mes |

### Comparativa de Proveedores de Servidor

| Proveedor | Plan | vCPU | RAM | SSD | Costo/mes |
|----------|------|:----:|:---:|:---:|:---------:|
| **Hetzner** *(recomendado)* | CX31 | 2 | 8 GB | 80 GB | **$10** |
| Contabo | VPS S | 4 | 8 GB | 200 GB | ~$7 |
| DigitalOcean | Basic 2/8 GB | 2 | 8 GB | 100 GB | $36 |
| AWS EC2 | t3.medium | 2 | 4 GB | — | ~$30 |

### Resumen Mensual

<div style="background:#f7f9fc;border:1px solid #dde5ee;border-radius:8px;overflow:hidden;margin:16px 0;">
  <table style="margin:0;">
    <thead>
      <tr><th>Concepto</th><th style="text-align:right;">USD/mes</th></tr>
    </thead>
    <tbody>
      <tr><td>VPS Hetzner CX31</td><td style="text-align:right;font-weight:600;">$10.00</td></tr>
      <tr><td>Backups VPS</td><td style="text-align:right;font-weight:600;">$2.00</td></tr>
      <tr><td>Bunny.net Storage (~100 GB)</td><td style="text-align:right;font-weight:600;">$0.50</td></tr>
      <tr><td>Bunny.net CDN (~240 GB, LATAM)</td><td style="text-align:right;font-weight:600;">$10.80</td></tr>
      <tr><td>Dominio</td><td style="text-align:right;font-weight:600;">$1.00</td></tr>
      <tr><td>Email + Sentry (free tier)</td><td style="text-align:right;color:#6b8aaa;">$0.00</td></tr>
    </tbody>
  </table>
  <div style="background:#0A2647;color:white;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:700;font-size:0.88rem;letter-spacing:0.3px;">TOTAL MENSUAL — 300 ESTUDIANTES</span>
    <span style="font-size:1.2rem;font-weight:700;">~$24–26</span>
  </div>
  <div style="background:#0d2f52;color:rgba(255,255,255,0.5);padding:7px 14px;display:flex;justify-content:space-between;font-size:0.75rem;">
    <span>Costo por estudiante</span>
    <span>~$0.08 USD / alumno / mes</span>
  </div>
</div>

### Proyección de Escalabilidad

<div style="margin:16px 0 8px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
    <div style="width:90px;font-size:0.78rem;font-weight:600;color:#3d5166;text-align:right;flex-shrink:0;">300 alumnos</div>
    <div style="flex:1;background:#e4eaf0;border-radius:3px;height:16px;overflow:hidden;">
      <div style="width:10%;background:#0A2647;height:100%;border-radius:3px;"></div>
    </div>
    <div style="width:60px;font-size:0.78rem;font-weight:700;color:#0A2647;flex-shrink:0;">~$25/mes</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
    <div style="width:90px;font-size:0.78rem;font-weight:600;color:#3d5166;text-align:right;flex-shrink:0;">600 alumnos</div>
    <div style="flex:1;background:#e4eaf0;border-radius:3px;height:16px;overflow:hidden;">
      <div style="width:20%;background:#144272;height:100%;border-radius:3px;"></div>
    </div>
    <div style="width:60px;font-size:0.78rem;font-weight:700;color:#0A2647;flex-shrink:0;">~$45/mes</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
    <div style="width:90px;font-size:0.78rem;font-weight:600;color:#3d5166;text-align:right;flex-shrink:0;">1,500 alumnos</div>
    <div style="flex:1;background:#e4eaf0;border-radius:3px;height:16px;overflow:hidden;">
      <div style="width:42%;background:#205295;height:100%;border-radius:3px;"></div>
    </div>
    <div style="width:60px;font-size:0.78rem;font-weight:700;color:#0A2647;flex-shrink:0;">~$90/mes</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;">
    <div style="width:90px;font-size:0.78rem;font-weight:600;color:#3d5166;text-align:right;flex-shrink:0;">5,000 alumnos</div>
    <div style="flex:1;background:#e4eaf0;border-radius:3px;height:16px;overflow:hidden;">
      <div style="width:100%;background:#2C74B3;height:100%;border-radius:3px;"></div>
    </div>
    <div style="width:60px;font-size:0.78rem;font-weight:700;color:#0A2647;flex-shrink:0;">~$260/mes</div>
  </div>
</div>

---

## 5. Backlog

### Funcionalidades Pendientes

| # | Feature | Prioridad | Descripción |
|---|---------|:---------:|-------------|
| 1 | Route Guards completos | <span class="badge badge-red">Alta</span> | Validar rol en cada página con redirect. Hoy solo protege rutas superficialmente. |
| 2 | RBAC unificado | <span class="badge badge-red">Alta</span> | `USUARIO_CONTROL` no tiene panel propio en frontend. |
| 3 | Panel Supervisor | <span class="badge badge-yellow">Media</span> | Rol existe en DB pero sin rutas `/supervisor/**` ni UI dedicada. |
| 4 | Notas por lección | <span class="badge badge-yellow">Media</span> | UI creada en `VideoControls`. Falta endpoint de persistencia. |
| 5 | Comentarios de curso | <span class="badge badge-yellow">Media</span> | UI iniciada pero sin endpoint conectado. |
| 6 | Recuperación de contraseña | <span class="badge badge-yellow">Media</span> | Backend + SMTP listos. Falta flujo completo en frontend. |
| 7 | Verificación pública de certificado | <span class="badge badge-yellow">Media</span> | `GET /certificados/verificar/{folio}` existe. Falta página pública. |
| 8 | Admin: Solicitudes | <span class="badge badge-green">Baja</span> | Página sin caso de uso de negocio definido. |
| 9 | Filtros avanzados catálogo | <span class="badge badge-green">Baja</span> | No todos los parámetros conectados al backend. |

### Deuda Técnica

| # | Área | Descripción | Impacto |
|---|------|-------------|:-------:|
| 1 | Certificados | PDF regenerado en cada descarga. Sin caché del archivo generado. | <span class="badge badge-red">Perf</span> |
| 2 | Media en producción | `SERVE_MEDIA=true` por defecto. FastAPI sirve estáticos, satura workers. | <span class="badge badge-red">Perf</span> |
| 3 | JWT en localStorage | Vulnerable a XSS. Migrar a `httpOnly` cookie. | <span class="badge badge-red">Seg</span> |
| 4 | Tests | pytest instalado sin cobertura conocida. Sin tests en frontend. | <span class="badge badge-yellow">Conf</span> |
| 5 | Paginación frontend | API soporta paginación pero UI no la implementa completamente. | <span class="badge badge-yellow">Esc</span> |
| 6 | Error Boundaries | Creado pero no envuelve todas las páginas críticas. | <span class="badge badge-yellow">UX</span> |
| 7 | WEB_CONCURRENCY | Hardcodeado en docker-compose. Extraer a `.env`. | <span class="badge badge-green">Ops</span> |

### Mejoras de Infraestructura

| # | Mejora | Descripción |
|---|--------|-------------|
| 1 | CDN para imágenes | Portadas servidas desde VPS. Migrar a Bunny.net Storage o Cloudflare. |
| 2 | Backups de DB | `pg_dump` automatizado con retención de 7 días fuera del VPS. |
| 3 | Seguridad Adminer | Expuesto en subdominio público. Restringir por IP o añadir auth básica. |
| 4 | Restart policies | Agregar `restart: unless-stopped` a backend y frontend en docker-compose. |
| 5 | Alertas Sentry | DSN configurado sin reglas activas. Configurar notificaciones a email/Slack. |
