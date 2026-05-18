"""
Genera docs/reporte_seguridad.pdf — resumen ejecutivo de todos los fixes
de ciberseguridad aplicados al proyecto NGcourses.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

# Paleta
NAVY   = colors.HexColor("#003366")
BLUE   = colors.HexColor("#004777")
ACCENT = colors.HexColor("#0066CC")
GREEN  = colors.HexColor("#1E7E34")
AMBER  = colors.HexColor("#856404")
RED    = colors.HexColor("#721C24")
GREY   = colors.HexColor("#6C757D")
LGREY  = colors.HexColor("#F8F9FA")
WHITE  = colors.white
DKGREY = colors.HexColor("#343A40")

# ── estilos ────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def _style(name, **kw):
    s = ParagraphStyle(name, **kw)
    return s

H1   = _style("H1",   fontName="Helvetica-Bold",   fontSize=22, textColor=NAVY,   spaceAfter=6,  spaceBefore=0,  alignment=TA_CENTER)
H2   = _style("H2",   fontName="Helvetica-Bold",   fontSize=14, textColor=NAVY,   spaceAfter=4,  spaceBefore=14, leading=18)
H3   = _style("H3",   fontName="Helvetica-Bold",   fontSize=11, textColor=BLUE,   spaceAfter=2,  spaceBefore=8,  leading=14)
BODY = _style("BODY", fontName="Helvetica",         fontSize=9,  textColor=DKGREY, spaceAfter=4,  leading=13, alignment=TA_JUSTIFY)
SMALL= _style("SMALL",fontName="Helvetica",         fontSize=8,  textColor=GREY,   spaceAfter=2,  leading=11)
CODE = _style("CODE", fontName="Courier",           fontSize=8,  textColor=DKGREY, spaceAfter=2,  leading=12, backColor=LGREY,
              leftIndent=6, rightIndent=6, borderPadding=(3,6,3,6))
SUBT = _style("SUBT", fontName="Helvetica-Oblique", fontSize=12, textColor=GREY,   spaceAfter=6,  alignment=TA_CENTER)
CELL = _style("CELL", fontName="Helvetica",         fontSize=8,  textColor=DKGREY, leading=11)
CELLB= _style("CELLB",fontName="Helvetica-Bold",    fontSize=8,  textColor=DKGREY, leading=11)
HCELL= _style("HCELL",fontName="Helvetica-Bold",    fontSize=8,  textColor=WHITE,  leading=11, alignment=TA_CENTER)


# ── helpers ────────────────────────────────────────────────────────────────
def badge(text, bg, fg=WHITE):
    return Paragraph(
        f'<font color="{fg.hexval() if hasattr(fg,"hexval") else "#FFFFFF"}">'
        f'<b>{text}</b></font>',
        ParagraphStyle("badge", fontName="Helvetica-Bold", fontSize=7,
                       textColor=fg, backColor=bg, leading=10,
                       borderPadding=(2,5,2,5), alignment=TA_CENTER)
    )

def sev_color(sev):
    return {
        "Critico": colors.HexColor("#DC3545"),
        "Alto":    colors.HexColor("#FD7E14"),
        "Medio":   colors.HexColor("#FFC107"),
        "Bajo":    colors.HexColor("#6C757D"),
    }.get(sev, GREY)

def status_color(st):
    return {
        "Resuelto":  GREEN,
        "Pospuesto": AMBER,
        "Preventivo": GREY,
    }.get(st, GREY)

def hr():
    return HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DEE2E6"),
                      spaceAfter=6, spaceBefore=2)

# ── header/footer ──────────────────────────────────────────────────────────
def _header_footer(canvas, doc):
    canvas.saveState()
    # header strip
    canvas.setFillColor(NAVY)
    canvas.rect(MARGIN, PAGE_H - 1.4*cm, PAGE_W - 2*MARGIN, 0.7*cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(MARGIN + 4, PAGE_H - 0.85*cm, "NGcourses — Reporte de Correcciones de Seguridad")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - MARGIN - 4, PAGE_H - 0.85*cm, "Confidencial")
    # footer
    canvas.setFillColor(GREY)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(MARGIN, 1.0*cm, "NGcourses © 2026 — Uso interno")
    canvas.drawRightString(PAGE_W - MARGIN, 1.0*cm, f"Página {doc.page}")
    canvas.restoreState()


# ── contenido ─────────────────────────────────────────────────────────────

FINDINGS = [
    # (id, sev, titulo_corto, status, sprint, resumen_fix)
    ("FND-001", "Critico", "Mass assignment / escalada vertical",
     "Resuelto", "Anterior",
     "Se refactorizó UserUpdate como clase independiente (no hereda UserBase). "
     "Se excluyó is_superuser del schema de actualización. Se agregó "
     "model_config = ConfigDict(extra='forbid') para rechazar campos desconocidos. "
     "CVSS: 9.1 | CWE-915"),

    ("FND-002", "Critico", "Sin rate limiting en endpoints públicos",
     "Resuelto", "Anterior",
     "Se instaló slowapi. Se aplicó @limiter.limit en /login/access-token (5/min), "
     "/password-recovery (3/h), /reset-password (5/min), /users/activar (5/min), "
     "/users/signup (10/h) y /invitaciones/canjear. "
     "CVSS: 8.2 | CWE-307"),

    ("FND-003", "Critico", "JWT en localStorage sin HttpOnly/Secure",
     "Resuelto", "Anterior",
     "El backend ahora emite el JWT en cookie HttpOnly, Secure (condicional a ENABLE_HTTPS), "
     "SameSite=Strict. Se eliminó localStorage.setItem del frontend. "
     "La dep get_current_user lee la cookie en lugar del header Authorization. "
     "CVSS: 7.7 | CWE-922, CWE-1004"),

    ("FND-004", "Alto", "User enumeration en /password-recovery",
     "Resuelto", "Anterior",
     "El endpoint devuelve respuesta uniforme independientemente de si el email existe: "
     "'Si el correo existe en nuestro sistema, recibirás instrucciones.' "
     "Se eliminó el HTTP 404 explícito que revelaba existencia de cuenta. "
     "CVSS: 5.3 | CWE-204"),

    ("FND-005", "Alto", "Sin protección server-side de rutas (middleware muerto)",
     "Resuelto", "Anterior",
     "proxy.ts (código muerto) fue renombrado a middleware.ts. Next.js ahora lo invoca "
     "antes de renderizar cualquier página protegida (/admin, /instructor, /supervisor, /perfil). "
     "La validación de rol ocurre en el servidor, no en useEffect del cliente. "
     "CVSS: 4.3 | CWE-602"),

    ("FND-006", "Alto", "SECRET_KEY sin default obligatorio",
     "Resuelto", "Código",
     "SECRET_KEY se declaró sin valor default: cualquier arranque sin .env falla de inmediato "
     "con ValidationError. Se agregó validador que rechaza 'changethis' y claves < 32 chars "
     "en todos los entornos (no solo local). "
     "CVSS: 7.4 | CWE-798"),

    ("FND-007", "Alto", "JWT de 8 días sin refresh token ni revocación",
     "Resuelto", "Este sprint",
     "ACCESS_TOKEN_EXPIRE_MINUTES reducido a 120 min. Se implementó refresh token con rotación: "
     "tabla refresh_tokens en BD (hash SHA-256, nunca el raw), endpoint POST /login/refresh-token "
     "con rate limit 20/min, rotación automática (revoke old + insert new). "
     "Cliente con interceptor 401 → auto-refresh → retry. Logout revoca el token en BD. "
     "CVSS: 6.5 | CWE-613"),

    ("FND-008", "Alto", "Sin headers de seguridad",
     "Resuelto", "Anterior",
     "Se configuraron en next.config.ts: Content-Security-Policy (default-src, script-src, "
     "style-src, img-src, connect-src, frame-src, object-src, base-uri, form-action, "
     "frame-ancestors 'none'), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, "
     "Referrer-Policy, Permissions-Policy. HSTS condicional a ENABLE_HTTPS. "
     "CVSS: 4.7 | CWE-693"),

    ("FND-009", "Alto", "Race condition en emisión de certificados (TOCTOU)",
     "Resuelto", "Anterior",
     "Se agregó UNIQUE constraint en certificado.inscripcion_id vía migración Alembic. "
     "check_and_emit_certificate envuelve el commit en try/except IntegrityError: "
     "si otra request gana la carrera, se retorna el certificado existente. "
     "CVSS: 3.1 | CWE-362, CWE-367"),

    ("FND-010", "Alto", "Race condition pago + inscripción (no atómicos)",
     "Resuelto", "Anterior",
     "El bloque pago COMPLETADO + creación de inscripción se unificó en una sola "
     "transacción con un único session.commit(). Si el proceso falla a mitad, "
     "el rollback automático de SQLAlchemy deja el estado consistente. "
     "CVSS: 5.2 | CWE-362"),

    ("FND-011", "Alto", "IP pública de EC2 hardcodeada en el workflow",
     "Resuelto", "Anterior",
     "La IP fue movida a un secret de GitHub (EC2_HOST). El workflow usa "
     "${{ secrets.EC2_HOST }} en todos los comandos SCP/SSH. "
     "El remotePattern con IP en next.config.ts fue eliminado. "
     "CVSS: 5.3 | CWE-200"),

    ("FND-012", "Medio", "CORS con allow_headers=[\"*\"] + allow_credentials=True",
     "Resuelto", "Anterior",
     "allow_headers reemplazado por lista explícita: Authorization, Content-Type, "
     "X-Requested-With y headers TUS. Se eliminó el regex de allow_origin para "
     "túneles loca.lt/ngrok en entornos que no sean local. "
     "CVSS: 4.7 | CWE-942"),

    ("FND-013", "Medio", "Validación MIME por header sin magic bytes",
     "Resuelto", "Anterior",
     "Se agregó validación de magic bytes con python-magic en los endpoints de "
     "upload de portada de curso y recursos de lección. El tipo real del archivo "
     "se detecta sobre los primeros 4 KB, rechazando archivos con cabecera falsa. "
     "CVSS: 5.4 | CWE-434"),

    ("FND-014", "Medio", "Token de reset password viaja en URL (query param)",
     "Resuelto", "Anterior",
     "El token se eliminó del query param y ahora viaja en el body del POST "
     "que el formulario envía internamente. El link del email apunta a la página "
     "/reset-password que lee el token del fragmento (#token=...) vía JS, "
     "evitando que quede en logs de proxies o historial del navegador. "
     "CVSS: 6.8 | CWE-598"),

    ("FND-015", "Medio", "Cookies de rol sin flag Secure",
     "Resuelto", "Este sprint",
     "Se agregó flag Secure de forma condicional en setRolCookies: "
     "se detecta window.location.protocol === 'https:' en tiempo de ejecución. "
     "En HTTP (EC2 sin dominio) el flag se omite correctamente. "
     "En HTTPS (producción final) se incluye automáticamente. "
     "CVSS: 3.1 | CWE-352"),

    ("FND-016", "Medio", "Adminer expuesto en docker-compose principal",
     "Resuelto", "Anterior",
     "El servicio adminer fue movido a docker-compose.dev.yml (solo desarrollo). "
     "Se le agregó middleware Traefik de basicauth. "
     "docker-compose.prod.yml nunca lo incluye. "
     "CVSS: 9.8 si prod / 0 en dev | CWE-489"),

    ("FND-017", "Medio", "Containers Docker corren como root",
     "Resuelto", "Anterior",
     "backend/Dockerfile: se creó usuario appuser (UID 1000) y se estableció USER appuser "
     "antes del CMD. frontend/Dockerfile: se usa el usuario node incluido en node:alpine "
     "y se asignan permisos con --chown=node:node en las instrucciones COPY del stage runner. "
     "CVSS: 7.5 | CWE-250"),

    ("FND-018", "Medio", "Endpoint /private activo si ENVIRONMENT=local en prod",
     "Resuelto", "Anterior",
     "Se agregó dependency _require_local_env al router /private que verifica "
     "settings.ENVIRONMENT en runtime y retorna HTTP 404 si no es 'local'. "
     "Doble barrera: la condición en main.py (include condicional) + la dep interna. "
     "CVSS: 9.1 si mal conf. | CWE-489"),

    ("FND-019", "Medio", "Comparación de expiración de token con tzinfo forzado ciego",
     "Resuelto", "Este sprint",
     "Se reemplazó el patrón .replace(tzinfo=timezone.utc) ciego por una verificación "
     "previa: si dt.tzinfo is None → replace; si ya es aware → usar directamente. "
     "Aplicado en reset_password (login.py) y en activar_cuenta (users.py). "
     "CVSS: 3.7 | CWE-754"),

    ("FND-020", "Medio", "Frontend en HTTP sin TLS (sin dominio aún)",
     "Pospuesto", "—",
     "Sin dominio asignado al momento de la auditoría (subdominio pendiente en ncchamp). "
     "El código ya está preparado: secure=settings.ENABLE_HTTPS en cookies, "
     "httpsEnabled en CSP y HSTS. Cuando se active el dominio: levantar Traefik con "
     "Let's Encrypt (docker-compose.traefik.yml existente) y setear ENABLE_HTTPS=true. "
     "CVSS: 6.8 | CWE-319"),

    ("FND-021", "Bajo", "Sin validación con schemas (Zod) en el frontend",
     "Resuelto", "Este sprint",
     "Se instaló zod. Se crearon frontend/src/schemas/auth.ts, profile.ts y user.ts "
     "con schemas de LoginSchema, ResetPasswordSchema, ActivarCuentaSchema, "
     "EditProfileSchema, ChangePasswordSchema, ProfileSetupSchema, CreateUserSchema, "
     "EditUserSchema. Los 8 formularios ahora llaman Schema.safeParse() antes del fetch "
     "y muestran errores inline. CVSS: 0 | CWE-20"),

    ("FND-022", "Bajo", "Sin DOMPurify (preventivo — no hay dangerouslySetInnerHTML)",
     "Preventivo", "—",
     "No se encontró ningún uso de dangerouslySetInnerHTML, eval, innerHTML ni Function() "
     "en el codebase. React protege contra XSS por construcción. "
     "Acción preventiva documentada: instalar DOMPurify antes de introducir rich text editing. "
     "CVSS: 0 | CWE-79"),

    ("FND-023", "Bajo", "SECURITY.md con template genérico (email de @tiangolo)",
     "Resuelto", "Anterior",
     "SECURITY.md actualizado con el email real del equipo NGcourses para recibir "
     "reportes de vulnerabilidades responsables (coordinated disclosure). "
     "Se documentó el proceso de 90 días antes de divulgación pública. "
     "CVSS: 0–2 | N/A"),

    ("FND-024", "Bajo", "Sin pre-commit hooks (gitleaks / detect-secrets)",
     "Resuelto", "Anterior",
     "Se creó .pre-commit-config.yaml con gitleaks v8 para escanear secretos antes de "
     "cada commit. CI también ejecuta gitleaks detect --source . como paso de validación "
     "en el pipeline de GitHub Actions. "
     "CVSS: 0 | CWE-540"),

    ("FND-025", "Bajo", "Sin Sentry en el frontend (errores de browser invisibles)",
     "Resuelto", "Este sprint",
     "Se instaló @sentry/nextjs. Se crearon sentry.client.config.ts, sentry.server.config.ts "
     "y sentry.edge.config.ts. next.config.ts envuelto con withSentryConfig. "
     "CSP actualizado con dominios *.sentry.io e *.ingest.sentry.io. "
     "Sentry desactivado si NEXT_PUBLIC_SENTRY_DSN no está definido (seguro en HTTP/EC2). "
     "CVSS: 3.1 | CWE-778"),

    ("FND-026", "Bajo", "package-lock.json en .gitignore pero versionado",
     "Resuelto", "Código",
     "Se eliminó package-lock.json del .gitignore raíz. El archivo permanece versionado "
     "(correcto para builds reproducibles). Se eliminó la inconsistencia que confundía "
     "a colaboradores y podía provocar omisiones accidentales. "
     "CVSS: 0 | N/A"),

    ("FND-027", "Bajo", "frontend/Dockerfile copia .env* con COPY . .",
     "Resuelto", "Código",
     "Se creó frontend/.dockerignore con .env*, .env.local, .env.*.local, node_modules, "
     ".next, .git y .vscode. Builds locales ya no pueden embeber credenciales en la "
     "imagen Docker. En CI no había riesgo (runner no tiene .env.local). "
     "CVSS: 5.5 local / 0 CI | CWE-538"),
]

STATUS_COLORS = {
    "Resuelto":   colors.HexColor("#D4EDDA"),
    "Pospuesto":  colors.HexColor("#FFF3CD"),
    "Preventivo": colors.HexColor("#E2E3E5"),
}
STATUS_TEXT = {
    "Resuelto":   colors.HexColor("#1E7E34"),
    "Pospuesto":  colors.HexColor("#856404"),
    "Preventivo": colors.HexColor("#495057"),
}
SEV_BG = {
    "Critico": colors.HexColor("#F8D7DA"),
    "Alto":    colors.HexColor("#FFE5D0"),
    "Medio":   colors.HexColor("#FFF3CD"),
    "Bajo":    colors.HexColor("#E2E3E5"),
}
SEV_TEXT = {
    "Critico": colors.HexColor("#721C24"),
    "Alto":    colors.HexColor("#6D3A00"),
    "Medio":   colors.HexColor("#856404"),
    "Bajo":    colors.HexColor("#343A40"),
}
SPRINT_COLORS = {
    "Este sprint": colors.HexColor("#CCE5FF"),
    "Anterior":    colors.HexColor("#D4EDDA"),
    "Código":      colors.HexColor("#E2E3E5"),
    "—":           colors.HexColor("#F8F9FA"),
}


def build_pdf(path):
    doc = BaseDocTemplate(
        path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=2.2*cm,
        bottomMargin=1.8*cm,
        title="NGcourses — Reporte de Correcciones de Seguridad",
        author="Equipo NGcourses",
    )

    frame = Frame(MARGIN, 1.8*cm, PAGE_W - 2*MARGIN, PAGE_H - 4.0*cm, id="main")
    tpl   = PageTemplate(id="main", frames=[frame], onPage=_header_footer)
    doc.addPageTemplates([tpl])

    story = []

    # ── PORTADA ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("NGcourses", H1))
    story.append(Paragraph("Reporte de Correcciones de Seguridad", SUBT))
    story.append(Spacer(1, 0.4*cm))
    story.append(hr())
    story.append(Spacer(1, 0.4*cm))

    meta_data = [
        ["Fecha de emisión:", "2026-05-18"],
        ["Versión del proyecto:", "rama main — commit b168727"],
        ["Auditoría base:", "2026-05-09 (commit 3d1818e)"],
        ["Alcance:", "Frontend Next.js 16 + Backend FastAPI + Docker/CI-CD"],
        ["Nivel de confidencialidad:", "Interno — no distribuir"],
    ]
    meta_table = Table(meta_data, colWidths=[5*cm, 11.5*cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME",    (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME",    (1,0), (1,-1), "Helvetica"),
        ("FONTSIZE",    (0,0), (-1,-1), 9),
        ("TEXTCOLOR",   (0,0), (0,-1), BLUE),
        ("TEXTCOLOR",   (1,0), (1,-1), DKGREY),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [LGREY, WHITE]),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING",(0,0), (-1,-1), 8),
        ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ── RESUMEN EJECUTIVO ──────────────────────────────────────────────────
    story.append(Paragraph("1. Resumen Ejecutivo", H2))
    story.append(hr())
    story.append(Paragraph(
        "Este documento registra el estado de remediación de los 27 hallazgos de seguridad "
        "identificados en la auditoría estática de NGcourses (2026-05-09). Los hallazgos cubren "
        "el stack completo: frontend Next.js 16, backend FastAPI, configuración Docker y pipeline "
        "CI/CD en GitHub Actions → AWS ECR → EC2. La auditoría detectó 3 hallazgos críticos, "
        "8 altos, 9 medios y 7 bajos. Al cierre de este reporte, 25 de 27 hallazgos están "
        "resueltos o no requerían acción (FND-022 preventivo). Un hallazgo (FND-020, HTTPS) "
        "queda pospuesto hasta que se asigne el dominio del proyecto.", BODY))
    story.append(Spacer(1, 0.3*cm))

    # contadores
    counts = {"Critico":0,"Alto":0,"Medio":0,"Bajo":0}
    status = {"Resuelto":0,"Pospuesto":0,"Preventivo":0}
    sprint_counts = {"Este sprint":0,"Anterior":0,"Código":0,"—":0}
    for f in FINDINGS:
        counts[f[1]] += 1
        status[f[3]] += 1
        sprint_counts[f[4]] += 1

    resumen_rows = [
        [Paragraph("<b>Severidad</b>",HCELL), Paragraph("<b>Hallazgos</b>",HCELL),
         Paragraph("<b>Resueltos</b>",HCELL), Paragraph("<b>Pendientes</b>",HCELL)],
    ]
    sev_order = ["Critico","Alto","Medio","Bajo"]
    sev_labels = {"Critico":"Critico","Alto":"Alto","Medio":"Medio","Bajo":"Bajo"}
    for sev in sev_order:
        total = sum(1 for f in FINDINGS if f[1]==sev)
        resolved = sum(1 for f in FINDINGS if f[1]==sev and f[3]=="Resuelto")
        pending  = sum(1 for f in FINDINGS if f[1]==sev and f[3] not in ("Resuelto","Preventivo"))
        resumen_rows.append([
            Paragraph(sev_labels[sev], CELL),
            Paragraph(str(total),      CELL),
            Paragraph(str(resolved),   CELL),
            Paragraph(str(pending),    CELL),
        ])
    resumen_rows.append([
        Paragraph("<b>Total</b>", CELLB),
        Paragraph("<b>27</b>",   CELLB),
        Paragraph(f"<b>{status['Resuelto']}</b>", CELLB),
        Paragraph(f"<b>{status['Pospuesto']}</b>", CELLB),
    ])

    sev_tbl = Table(resumen_rows, colWidths=[4*cm, 3.5*cm, 3.5*cm, 3.5*cm])
    sev_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-2),[LGREY, WHITE]),
        ("BACKGROUND",  (0,-1),(-1,-1), colors.HexColor("#DEE2E6")),
        ("FONTNAME",    (0,-1),(-1,-1), "Helvetica-Bold"),
        ("ALIGN",       (1,0), (-1,-1), "CENTER"),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("BOX",         (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
        ("INNERGRID",   (0,0), (-1,-1), 0.3, colors.HexColor("#DEE2E6")),
    ]))
    story.append(sev_tbl)
    story.append(Spacer(1, 0.5*cm))

    # estado de sprint
    story.append(Paragraph(
        f"De los 27 hallazgos: <b>{sprint_counts['Este sprint']}</b> resueltos en este sprint, "
        f"<b>{sprint_counts['Anterior']}</b> resueltos en sprints anteriores, "
        f"<b>{sprint_counts['Código']}</b> ya estaban resueltos en el código (sin commit previo registrado), "
        f"<b>1</b> preventivo (FND-022, sin acción), <b>1</b> pospuesto (FND-020, sin dominio).", BODY))

    story.append(PageBreak())

    # ── TABLA MAESTRA ──────────────────────────────────────────────────────
    story.append(Paragraph("2. Tabla Maestra de Hallazgos", H2))
    story.append(hr())

    hdr = [
        Paragraph("<b>ID</b>",      HCELL),
        Paragraph("<b>Severidad</b>",HCELL),
        Paragraph("<b>Titulo</b>",   HCELL),
        Paragraph("<b>Estado</b>",   HCELL),
        Paragraph("<b>Sprint</b>",   HCELL),
    ]
    tbl_rows = [hdr]
    for f in FINDINGS:
        fid, sev, title, st, sprint, _ = f
        tbl_rows.append([
            Paragraph(f"<b>{fid}</b>", CELL),
            Paragraph(sev,   CELL),
            Paragraph(title, CELL),
            Paragraph(f"<b>{st}</b>", CELL),
            Paragraph(sprint, CELL),
        ])

    master = Table(tbl_rows, colWidths=[1.8*cm, 1.8*cm, 8.0*cm, 2.2*cm, 2.7*cm], repeatRows=1)

    ts = TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), NAVY),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
        ("INNERGRID",     (0,0), (-1,-1), 0.3, colors.HexColor("#DEE2E6")),
    ])
    for i, f in enumerate(FINDINGS, 1):
        sev, st = f[1], f[3]
        bg = SEV_BG.get(sev, LGREY)
        # alternate row tint
        bg_use = bg if i % 2 == 1 else colors.HexColor(
            "#" + "".join(f"{max(0,int(c*255)-8):02X}" for c in bg.rgb())
        ) if hasattr(bg, 'rgb') else bg
        ts.add("ROWBACKGROUNDS", (0, i), (-1, i), [bg_use])
        ts.add("TEXTCOLOR",      (0, i), (1, i),  SEV_TEXT.get(sev, DKGREY))
        ts.add("TEXTCOLOR",      (3, i), (3, i),  STATUS_TEXT.get(st, GREY))
    master.setStyle(ts)

    story.append(master)
    story.append(PageBreak())

    # ── DETALLE POR HALLAZGO ───────────────────────────────────────────────
    story.append(Paragraph("3. Detalle de Correcciones por Hallazgo", H2))
    story.append(hr())

    groups = [
        ("Critico", "3.1 Hallazgos Criticos"),
        ("Alto",    "3.2 Hallazgos Altos"),
        ("Medio",   "3.3 Hallazgos Medios"),
        ("Bajo",    "3.4 Hallazgos Bajos"),
    ]

    for sev_key, sev_title in groups:
        story.append(Paragraph(sev_title, H2))
        group_findings = [f for f in FINDINGS if f[1] == sev_key]
        for f in group_findings:
            fid, sev, title, st, sprint, desc = f
            card_rows = []

            # encabezado del hallazgo
            header_content = [
                [
                    Paragraph(f"<b>{fid}</b>", ParagraphStyle("fid",
                        fontName="Helvetica-Bold", fontSize=10,
                        textColor=SEV_TEXT.get(sev, NAVY))),
                    Paragraph(f"<b>{title}</b>", ParagraphStyle("ftit",
                        fontName="Helvetica-Bold", fontSize=9, textColor=NAVY)),
                    Paragraph(f"<b>{sev}</b>", ParagraphStyle("fsev",
                        fontName="Helvetica-Bold", fontSize=8,
                        textColor=SEV_TEXT.get(sev, GREY),
                        backColor=SEV_BG.get(sev, LGREY),
                        borderPadding=(2,6,2,6), alignment=TA_CENTER)),
                    Paragraph(f"<b>{st}</b>", ParagraphStyle("fst",
                        fontName="Helvetica-Bold", fontSize=8,
                        textColor=STATUS_TEXT.get(st, GREY),
                        backColor=STATUS_COLORS.get(st, LGREY),
                        borderPadding=(2,6,2,6), alignment=TA_CENTER)),
                ]
            ]
            h_tbl = Table(header_content, colWidths=[2*cm, 8.5*cm, 2*cm, 2*cm])
            h_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,-1), LGREY),
                ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
                ("TOPPADDING",    (0,0), (-1,-1), 6),
                ("BOTTOMPADDING", (0,0), (-1,-1), 6),
                ("LEFTPADDING",   (0,0), (-1,-1), 8),
                ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
            ]))

            # cuerpo
            body_content = [[Paragraph(desc, BODY)]]
            b_tbl = Table(body_content, colWidths=[14.5*cm])
            b_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,-1), WHITE),
                ("TOPPADDING",    (0,0), (-1,-1), 5),
                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                ("LEFTPADDING",   (0,0), (-1,-1), 8),
                ("RIGHTPADDING",  (0,0), (-1,-1), 8),
                ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
                ("TOPPADDING",    (0,0), (0,0),   0),
            ]))

            # sprint badge row
            sprint_content = [[
                Paragraph(f"Sprint de resolución: <b>{sprint}</b>", SMALL),
            ]]
            s_tbl = Table(sprint_content, colWidths=[14.5*cm])
            s_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,-1), SPRINT_COLORS.get(sprint, LGREY)),
                ("TOPPADDING",    (0,0), (-1,-1), 3),
                ("BOTTOMPADDING", (0,0), (-1,-1), 3),
                ("LEFTPADDING",   (0,0), (-1,-1), 8),
                ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
            ]))

            story.append(KeepTogether([
                Spacer(1, 0.15*cm),
                h_tbl,
                b_tbl,
                s_tbl,
                Spacer(1, 0.1*cm),
            ]))

        story.append(Spacer(1, 0.3*cm))

    story.append(PageBreak())

    # ── CONTROLES EFECTIVOS ────────────────────────────────────────────────
    story.append(Paragraph("4. Controles Efectivos (sin hallazgos)", H2))
    story.append(hr())
    story.append(Paragraph(
        "Los siguientes controles estaban correctamente implementados al momento de la auditoría "
        "y deben mantenerse como baseline de seguridad:", BODY))
    story.append(Spacer(1, 0.2*cm))

    controls = [
        ("SQL Injection", "SQLModel/SQLAlchemy parametrizado en todas las queries. Sin uso de text() ni f-strings con SQL."),
        ("Deserializacion insegura", "Sin pickle, yaml.load(unsafe), eval ni exec en el codebase."),
        ("SSRF", "Sin URLs controladas por el usuario en llamadas requests/httpx. URLs de Bunny y PayPal hardcodeadas en servicios internos."),
        ("Password hashing", "bcrypt via passlib con rounds default (>10). Sin MD5/SHA-1 para passwords."),
        ("CI/CD credentials", "OIDC + AssumeRole en GitHub Actions. Sin credenciales AWS hardcodeadas en el repo."),
        ("Webhook validation", "Firma HMAC validada en el webhook de Bunny.net cuando BUNNY_WEBHOOK_SECRET esta configurado."),
        ("Lockfiles versionados", "uv.lock y package-lock.json presentes. Builds reproducibles en CI y local."),
        ("Validacion de defaults", "_check_default_secret rechaza 'changethis' en staging/produccion. ValidationError si SECRET_KEY no esta definida."),
    ]

    ctrl_rows = [[Paragraph("<b>Control</b>", HCELL), Paragraph("<b>Implementacion</b>", HCELL)]]
    for ctrl, desc in controls:
        ctrl_rows.append([Paragraph(ctrl, CELLB), Paragraph(desc, CELL)])

    ctrl_tbl = Table(ctrl_rows, colWidths=[4*cm, 10.5*cm], repeatRows=1)
    ctrl_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  NAVY),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [LGREY, WHITE]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#CED4DA")),
        ("INNERGRID",     (0,0), (-1,-1), 0.3, colors.HexColor("#DEE2E6")),
    ]))
    story.append(ctrl_tbl)

    story.append(PageBreak())

    # ── PROXIMOS PASOS ─────────────────────────────────────────────────────
    story.append(Paragraph("5. Proximos Pasos", H2))
    story.append(hr())

    steps = [
        ("FND-020 — HTTPS / TLS",
         "Cuando se asigne el subdominio ncchamp: activar Traefik con Let's Encrypt "
         "(docker-compose.traefik.yml ya existe), setear ENABLE_HTTPS=true en .env.prod, "
         "verificar cookies Secure y HSTS, remover el remotePattern de IP en next.config.ts."),
        ("Sentry frontend — Activacion",
         "Crear proyecto 'ngcourses-frontend' en sentry.io. Agregar NEXT_PUBLIC_SENTRY_DSN "
         "como GitHub Secret y build-arg en deploy.yml. Agregar SENTRY_AUTH_TOKEN para "
         "upload de source maps. Agregar org y project a withSentryConfig."),
        ("CI — Dependency scanning",
         "Agregar pasos pip-audit (backend) y npm audit --audit-level=high (frontend) "
         "en el pipeline de GitHub Actions como puerta obligatoria de PR."),
        ("Re-auditoria",
         "Una vez activo HTTPS y Sentry: re-auditoria de los hallazgos cerrados para "
         "confirmar la efectividad de los controles en produccion real. "
         "Considerar pentest externo o /ultrareview de la rama main."),
    ]

    for i, (title, desc) in enumerate(steps):
        step_content = [
            [Paragraph(f"<b>{i+1}. {title}</b>", ParagraphStyle("steph",
                fontName="Helvetica-Bold", fontSize=9, textColor=BLUE))],
            [Paragraph(desc, BODY)],
        ]
        step_tbl = Table(step_content, colWidths=[14.5*cm])
        step_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (0,0),  colors.HexColor("#EBF3FB")),
            ("BACKGROUND",    (0,1), (0,1),  WHITE),
            ("TOPPADDING",    (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#BDD8F0")),
        ]))
        story.append(KeepTogether([step_tbl, Spacer(1, 0.2*cm)]))

    story.append(Spacer(1, 1*cm))
    story.append(hr())
    story.append(Paragraph(
        "Fin del reporte — NGcourses © 2026",
        ParagraphStyle("footer_note", fontName="Helvetica-Oblique", fontSize=8,
                       textColor=GREY, alignment=TA_CENTER)))

    doc.build(story)
    print(f"PDF generado: {path}")


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(__file__), "..", "docs", "reporte_seguridad.pdf")
    build_pdf(os.path.abspath(out))
