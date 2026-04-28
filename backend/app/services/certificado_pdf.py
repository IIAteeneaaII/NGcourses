"""
Generación de PDF para certificados de completado de cursos.
Diseño basado en la referencia oficial NGcourses / RAM Electronics.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas

from app.models._enums import MarcaCurso

# ── Paleta ────────────────────────────────────────────────────────────────────

TEAL       = HexColor("#00968f")
TEAL_DARK  = HexColor("#007a74")
TEXT_DARK  = HexColor("#1a2e2d")
TEXT_GRAY  = HexColor("#5a6e6d")
TEXT_LIGHT = HexColor("#8a9e9d")
BG_COLOR   = HexColor("#f4f8f7")   # fondo muy suave

# ── Rutas ─────────────────────────────────────────────────────────────────────

STATIC_LOGOS = Path(__file__).parent.parent / "static" / "logos"
FIRMAS_DIR   = STATIC_LOGOS / "firmas"
CERT_DIR     = Path(__file__).parent.parent / "media" / "certificados"
MARCO_PATH   = STATIC_LOGOS / "marco.png"

PAGE_W, PAGE_H = landscape(letter)   # 792 × 612 pt
CX = PAGE_W / 2                       # centro horizontal


# ── Helpers ───────────────────────────────────────────────────────────────────

def _marca_str(marca: MarcaCurso | str) -> str:
    return marca.value if isinstance(marca, MarcaCurso) else str(marca)


def _cx_text(c: rl_canvas.Canvas, text: str, y: float) -> None:
    c.drawCentredString(CX, y, text)


def _hline(c: rl_canvas.Canvas, x1: float, x2: float, y: float,
           width: float = 0.8, color: Color = TEAL) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


# ── Fondo + Marco ─────────────────────────────────────────────────────────────

def _draw_background(c: rl_canvas.Canvas) -> None:
    """Dibuja el marco PNG a página completa. Fallback a fondo de color si no existe."""
    if MARCO_PATH.exists():
        img = ImageReader(str(MARCO_PATH))
        c.drawImage(img, 0, 0, width=PAGE_W, height=PAGE_H, mask="auto")
    else:
        c.setFillColor(BG_COLOR)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def _draw_borders(c: rl_canvas.Canvas) -> None:
    pass  # El marco PNG ya incluye los bordes


def _draw_all_corners(c: rl_canvas.Canvas) -> None:
    pass  # El marco PNG ya incluye los ornamentos


# ── Logo ──────────────────────────────────────────────────────────────────────

_LOGO_W: dict[str, float] = {
    "nextgen": PAGE_W * 0.30,
    "ram":     PAGE_W * 0.22,
}

def _draw_logo(c: rl_canvas.Canvas, marca: str) -> None:
    logo_path = STATIC_LOGOS / marca / "logo.png"
    if not logo_path.exists():
        return
    img = ImageReader(str(logo_path))
    iw, ih = img.getSize()
    fixed_w = _LOGO_W.get(marca, PAGE_W * 0.22)
    dw = fixed_w
    dh = ih * (fixed_w / iw)
    x = CX - dw / 2
    y = PAGE_H - 32 - dh
    c.drawImage(img, x, y, width=dw, height=dh, mask="auto")


# ── Sello ─────────────────────────────────────────────────────────────────────

_SEAL_W: dict[str, float] = {
    "nextgen": PAGE_W * 0.18,
    "ram":     PAGE_W * 0.26,
}

def _draw_seal(c: rl_canvas.Canvas, marca: str) -> None:
    seal_path = STATIC_LOGOS / marca / "sello.png"
    if not seal_path.exists():
        return
    img = ImageReader(str(seal_path))
    iw, ih = img.getSize()
    fixed_w = _SEAL_W.get(marca, PAGE_W * 0.18)
    dw = fixed_w
    dh = ih * (fixed_w / iw)
    x = PAGE_W - 38 - dw
    y = 35
    c.drawImage(img, x, y, width=dw, height=dh, mask="auto")


# ── Firmas ────────────────────────────────────────────────────────────────────


def _draw_signatures(c: rl_canvas.Canvas, marca: str) -> None:
    """Dos firmas horizontales en la parte inferior según la marca del curso."""
    # ── Posiciones relativas ──────────────────────────────────────────────────
    y_line  = PAGE_H * 0.20          # ~122 pt desde abajo
    sig_w   = PAGE_W * 0.18          # ~143 pt por bloque
    gap     = PAGE_W * 0.06          # ~47 pt entre bloques
    img_h   = PAGE_H * 0.08          # altura máx imagen de firma ~49 pt

    total_w = 2 * sig_w + gap
    x_start = (PAGE_W - total_w) / 2   # centrado en la página
    x1_a = x_start
    x2_a = x_start + sig_w
    x1_b = x_start + sig_w + gap
    x2_b = x_start + sig_w + gap + sig_w
    cx_a  = (x1_a + x2_a) / 2
    cx_b  = (x1_b + x2_b) / 2

    # ── Selección de firmas por marca ─────────────────────────────────────────
    if marca == "ram":
        bloques = [
            (cx_a, x1_a, x2_a, "director_general_rodrigo.png", "Ing. Rodrigo Ojeda Santillán", "Director General"),
            (cx_b, x1_b, x2_b, "director_general_mario.png",   "Ing. Mario  ",   "Director General"),
        ]
    else:  # nextgen
        bloques = [
            (cx_a, x1_a, x2_a, "director_general_rodrigo.png", "Ing. Rodrigo Ojeda Santillán", "Director General"),
            (cx_b, x1_b, x2_b, "director_academico.png",       "Ing. Abraham Correa Romero", "Director Académico"),
        ]

    for cx, x1, x2, fname, name, title in bloques:
        img_path = FIRMAS_DIR / fname
        if img_path.exists():
            img = ImageReader(str(img_path))
            iw, ih = img.getSize()
            scale = min(sig_w / iw, img_h / ih)
            dw, dh = iw * scale, ih * scale
            c.drawImage(img, cx - dw / 2, y_line + 4, width=dw, height=dh, mask="auto")
        _hline(c, x1, x2, y_line, width=0.8, color=TEXT_GRAY)
        c.setFillColor(TEXT_DARK)
        c.setFont("Times-Bold", 9)
        c.drawCentredString(cx, y_line - 13, title)
        c.setFillColor(TEXT_GRAY)
        c.setFont("Helvetica", 8)
        c.drawCentredString(cx, y_line - 24, name)


# ── Cuerpo del certificado ───────────────────────────────────────────────────

def _draw_body(c: rl_canvas.Canvas, folio: str, student_name: str,
               course_title: str, issued_date: datetime) -> None:

    # ── Título ────────────────────────────────────────────────────────────────
    c.setFillColor(TEAL_DARK)
    c.setFont("Times-Bold", 30)
    _cx_text(c, "CERTIFICADO DE FINALIZACIÓN", 428)

    # Divisor decorativo delgado bajo el título
    _hline(c, CX - 130, CX + 130, 419, width=0.7)

    # ── "This is to certify that" ─────────────────────────────────────────────
    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica-Oblique", 12)
    _cx_text(c, "Se certifica que", 395)

    # ── Nombre del alumno ─────────────────────────────────────────────────────
    c.setFillColor(TEXT_DARK)
    c.setFont("Times-BoldItalic", 38)
    _cx_text(c, student_name, 352)

    # Línea bajo el nombre
    name_w = c.stringWidth(student_name, "Times-BoldItalic", 38)
    line_half = min(name_w / 2 + 20, 240)
    _hline(c, CX - line_half, CX + line_half, 342, width=0.7)

    # ── "has successfully completed the course in:" ───────────────────────────
    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 12)
    _cx_text(c, "ha completado satisfactoriamente el curso:", 318)

    # ── Título del curso ──────────────────────────────────────────────────────
    max_chars = 58
    title_display = course_title if len(course_title) <= max_chars \
        else course_title[:max_chars - 1] + "…"
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 16)
    _cx_text(c, f"[{title_display.upper()}]", 290)

    # Línea bajo el curso
    course_w = c.stringWidth(f"[{title_display.upper()}]", "Helvetica-Bold", 16)
    course_half = min(course_w / 2 + 15, 260)
    _hline(c, CX - course_half, CX + course_half, 281, width=0.5, color=TEXT_LIGHT)

    # ── Fecha ─────────────────────────────────────────────────────────────────
    months_es = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    date_str = (f"A los {issued_date.day} días del mes de "
                f"{months_es[issued_date.month]} de {issued_date.year}")
    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 11)
    _cx_text(c, date_str, 256)

    # ── Folio ─────────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_LIGHT)
    _cx_text(c, f"Certificado No. {folio}", 240)


# ── Función principal ─────────────────────────────────────────────────────────

def generate_certificate_pdf(
    *,
    folio: str,
    student_name: str,
    course_title: str,
    issued_date: datetime,
    marca: MarcaCurso | str,
    output_path: str,
    # Mantenidos por compatibilidad, ya no se usan en las firmas
    instructor_name: str = "",
    instructor_id: str | None = None,
) -> str:
    """
    Genera el PDF del certificado y lo escribe en output_path.
    Devuelve output_path en caso de éxito.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    marca_s = _marca_str(marca)

    c = rl_canvas.Canvas(output_path, pagesize=landscape(letter))
    c.setTitle(f"Certificado de Completado — {folio}")

    _draw_background(c)
    _draw_borders(c)
    _draw_all_corners(c)
    _draw_logo(c, marca_s)
    _draw_body(c, folio, student_name, course_title, issued_date)
    _draw_signatures(c, marca_s)
    _draw_seal(c, marca_s)

    c.save()
    return output_path
