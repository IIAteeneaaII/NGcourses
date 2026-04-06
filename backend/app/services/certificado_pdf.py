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
CERT_DIR     = Path(__file__).parent.parent / "media" / "certificados"

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


# ── Fondo ─────────────────────────────────────────────────────────────────────

def _draw_background(c: rl_canvas.Canvas) -> None:
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


# ── Bordes ────────────────────────────────────────────────────────────────────

def _draw_borders(c: rl_canvas.Canvas) -> None:
    margin = 18
    # Borde exterior fino
    c.setStrokeColor(TEAL)
    c.setLineWidth(1.5)
    c.rect(margin, margin, PAGE_W - 2*margin, PAGE_H - 2*margin, fill=0, stroke=1)
    # Borde interior más fino
    inner = margin + 7
    c.setLineWidth(0.5)
    c.rect(inner, inner, PAGE_W - 2*inner, PAGE_H - 2*inner, fill=0, stroke=1)


def _draw_corner_ornament(c: rl_canvas.Canvas, ox: float, oy: float,
                          flip_x: bool, flip_y: bool) -> None:
    """Ornamento de esquina tipo fret/geométrico, similar al de la referencia."""
    sx = -1 if flip_x else 1
    sy = -1 if flip_y else 1
    size = 52

    c.saveState()
    c.translate(ox, oy)
    c.scale(sx, sy)

    c.setStrokeColor(TEAL)
    c.setFillColor(TEAL)

    # Marco exterior en L
    c.setLineWidth(2.5)
    c.line(0, 0, size, 0)
    c.line(0, 0, 0, size)

    # Línea interior en L (inset)
    pad = 9
    c.setLineWidth(1.0)
    c.line(pad, pad, size - 4, pad)
    c.line(pad, pad, pad, size - 4)

    # Cuadrado relleno en la esquina interior
    sq = 7
    c.setFillColor(TEAL)
    c.rect(pad, pad, sq, sq, fill=1, stroke=0)

    # Pequeños cuadrados decorativos a lo largo de los brazos
    dot = 4
    gap = 13
    for i in range(1, 4):
        xd = pad + sq + i * gap
        if xd + dot < size - 2:
            c.rect(xd, pad + (sq - dot) // 2, dot, dot, fill=1, stroke=0)
        yd = pad + sq + i * gap
        if yd + dot < size - 2:
            c.rect(pad + (sq - dot) // 2, yd, dot, dot, fill=1, stroke=0)

    c.restoreState()


def _draw_all_corners(c: rl_canvas.Canvas) -> None:
    m = 18
    _draw_corner_ornament(c, m, m, False, False)                           # bottom-left
    _draw_corner_ornament(c, PAGE_W - m, m, True, False)                   # bottom-right
    _draw_corner_ornament(c, m, PAGE_H - m, False, True)                   # top-left
    _draw_corner_ornament(c, PAGE_W - m, PAGE_H - m, True, True)           # top-right


# ── Logo ──────────────────────────────────────────────────────────────────────

def _draw_logo(c: rl_canvas.Canvas, marca: str) -> None:
    logo_path = STATIC_LOGOS / marca / "logo.png"
    if not logo_path.exists():
        return
    img = ImageReader(str(logo_path))
    iw, ih = img.getSize()
    max_w, max_h = 110.0, 80.0
    scale = min(max_w / iw, max_h / ih)
    dw, dh = iw * scale, ih * scale
    x = CX - dw / 2
    y = PAGE_H - 32 - dh        # ≈ 500 pt desde abajo
    c.drawImage(img, x, y, width=dw, height=dh, mask="auto")


# ── Sello ─────────────────────────────────────────────────────────────────────

def _draw_seal(c: rl_canvas.Canvas, marca: str) -> None:
    seal_path = STATIC_LOGOS / marca / "sello.png"
    if not seal_path.exists():
        return
    img = ImageReader(str(seal_path))
    size = 88
    x = PAGE_W - 50 - size       # esquina inferior derecha
    y = 38
    c.drawImage(img, x, y, width=size, height=size, mask="auto")


# ── Firmas ────────────────────────────────────────────────────────────────────

def _draw_signatures(c: rl_canvas.Canvas, instructor_name: str) -> None:
    """Dos bloques de firma apilados a la izquierda, igual que la referencia."""
    x1, x2 = 68, 295
    cx_sig = (x1 + x2) / 2

    # ── Firma 1: Instructor ──────────────────────────────────────────────────
    y1_line = 148
    _hline(c, x1, x2, y1_line, width=0.8, color=TEXT_GRAY)

    c.setFillColor(TEXT_DARK)
    c.setFont("Times-Bold", 10)
    c.drawCentredString(cx_sig, y1_line - 14, "Instructor Signature")

    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(cx_sig, y1_line - 26, instructor_name)

    # ── Firma 2: Director ────────────────────────────────────────────────────
    y2_line = 100
    _hline(c, x1, x2, y2_line, width=0.8, color=TEXT_GRAY)

    c.setFillColor(TEXT_DARK)
    c.setFont("Times-Bold", 10)
    c.drawCentredString(cx_sig, y2_line - 14, "Director Signature")

    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(cx_sig, y2_line - 26, "NGcourses")


# ── Cuerpo del certificado ───────────────────────────────────────────────────

def _draw_body(c: rl_canvas.Canvas, folio: str, student_name: str,
               course_title: str, issued_date: datetime) -> None:

    # ── Título ────────────────────────────────────────────────────────────────
    c.setFillColor(TEAL_DARK)
    c.setFont("Times-Bold", 30)
    _cx_text(c, "CERTIFICATE OF COMPLETION", 428)

    # Divisor decorativo delgado bajo el título
    _hline(c, CX - 130, CX + 130, 419, width=0.7)

    # ── "This is to certify that" ─────────────────────────────────────────────
    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica-Oblique", 12)
    _cx_text(c, "This is to certify that", 395)

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
    _cx_text(c, "has successfully completed the course in:", 318)

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
    date_str = (f"On this day of {issued_date.day} de "
                f"{months_es[issued_date.month]} de {issued_date.year}")
    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 11)
    _cx_text(c, date_str, 256)

    # ── Folio ─────────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_LIGHT)
    _cx_text(c, f"Certificate No. {folio}", 240)


# ── Función principal ─────────────────────────────────────────────────────────

def generate_certificate_pdf(
    *,
    folio: str,
    student_name: str,
    course_title: str,
    instructor_name: str,
    issued_date: datetime,
    marca: MarcaCurso | str,
    output_path: str,
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
    _draw_signatures(c, instructor_name)
    _draw_seal(c, marca_s)

    c.save()
    return output_path
