"""
Endpoints de certificados de completado de cursos.
"""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, SQLModel, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models.inscripcion import Certificado, Inscripcion
from app.models._enums import EstadoInscripcion, RolUsuario

CERT_DIR = Path(__file__).parent.parent.parent / "media" / "certificados"

router = APIRouter(prefix="/certificados", tags=["certificados"])


def _generar_pdf_certificado(*, session: Session, db_cert: Certificado) -> None:
    """Genera (o regenera) el PDF de un certificado y fija su url_pdf.

    Centraliza la generación para que el alta automática, el regenerado manual
    y la descarga (auto-recuperación) usen exactamente la misma lógica.
    """
    from app.models._enums import MarcaCurso
    from app.models import User
    from app.models.contenido import Curso as CursoModel
    from app.services.certificado_pdf import generate_certificate_pdf

    folio = db_cert.folio.upper()
    usuario = session.get(User, db_cert.usuario_id)
    curso = session.get(CursoModel, db_cert.curso_id)
    instructor = session.get(User, curso.instructor_id) if curso else None

    CERT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = str(CERT_DIR / f"{folio}.pdf")

    generate_certificate_pdf(
        folio=folio,
        student_name=(usuario.full_name or usuario.email) if usuario else "Alumno",
        course_title=curso.titulo if curso else "",
        instructor_name=(instructor.full_name or instructor.email) if instructor else "Instructor",
        issued_date=db_cert.emitido_en,
        marca=curso.marca if curso else MarcaCurso.RAM,
        output_path=output_path,
    )

    db_cert.url_pdf = f"/media/certificados/{folio}.pdf"
    session.add(db_cert)
    session.commit()
    session.refresh(db_cert)


# ── Schemas ────────────────────────────────────────────────────────────────────

class CertificadoPublic(SQLModel):
    id: uuid.UUID
    inscripcion_id: uuid.UUID
    usuario_id: uuid.UUID
    curso_id: uuid.UUID
    folio: str
    url_pdf: str | None = None
    hash_verificacion: str | None = None
    emitido_en: datetime


class CertificadosPublic(SQLModel):
    data: list[CertificadoPublic]
    count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/regenerar/{folio}", response_model=CertificadoPublic)
def regenerar_pdf_certificado(
    folio: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Regenera el PDF de un certificado existente. Solo admin."""
    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin:
        raise HTTPException(status_code=403, detail="Sin permiso")

    statement = select(Certificado).where(Certificado.folio == folio.upper())
    db_cert = session.exec(statement).first()
    if not db_cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    try:
        _generar_pdf_certificado(session=session, db_cert=db_cert)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {exc}") from exc

    return CertificadoPublic.model_validate(db_cert, from_attributes=True)


@router.get("/me", response_model=CertificadosPublic)
def mis_certificados(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Lista los certificados del usuario actual."""
    # CP20: re-emisión perezosa. Si el alumno completó un curso pero el
    # certificado no se emitió (p.ej. su perfil no tenía nombre y ya lo
    # corrigió), se intenta emitir ahora antes de listar.
    inscripciones = session.exec(
        select(Inscripcion).where(Inscripcion.usuario_id == current_user.id)
    ).all()
    for insc in inscripciones:
        ya_tiene = session.exec(
            select(Certificado).where(Certificado.inscripcion_id == insc.id)
        ).first()
        if not ya_tiene:
            crud.check_and_emit_certificate(session=session, inscripcion_id=insc.id)

    statement = select(Certificado).where(Certificado.usuario_id == current_user.id)
    items = list(session.exec(statement).all())
    return CertificadosPublic(
        data=[CertificadoPublic.model_validate(c, from_attributes=True) for c in items],
        count=len(items),
    )


@router.get("/descargar/{folio}")
def descargar_certificado(
    folio: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> FileResponse:
    """Descarga el PDF del certificado. Solo el propietario o admin."""
    statement = select(Certificado).where(Certificado.folio == folio.upper())
    db_cert = session.exec(statement).first()
    if not db_cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin and db_cert.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este certificado")

    # CP20: re-validar que el curso siga completo. Si se agregó contenido nuevo
    # después de finalizar y el alumno aún no lo completa, el certificado no está
    # disponible y la inscripción vuelve a ACTIVA.
    inscripcion = session.get(Inscripcion, db_cert.inscripcion_id)
    if inscripcion and not crud.curso_completado(session=session, inscripcion=inscripcion):
        if inscripcion.estado == EstadoInscripcion.FINALIZADA:
            inscripcion.estado = EstadoInscripcion.ACTIVA
            session.add(inscripcion)
            session.commit()
        raise HTTPException(
            status_code=409,
            detail="Tienes contenido pendiente en el curso. Complétalo para descargar tu certificado.",
        )

    pdf_path = CERT_DIR / f"{folio.upper()}.pdf"
    # Auto-recuperación: si el PDF nunca se generó (url_pdf nulo por una falla
    # previa no-fatal) o el archivo se perdió, se regenera al vuelo. Así la
    # descarga SIEMPRE funciona para un certificado válido, sin depender de la
    # carrera del auto-generado.
    if not db_cert.url_pdf or not pdf_path.exists():
        try:
            _generar_pdf_certificado(session=session, db_cert=db_cert)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"No se pudo generar el PDF: {exc}") from exc

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado en el servidor")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"certificado-{folio.upper()}.pdf",
    )


@router.get("/verificar/{folio}", response_model=CertificadoPublic)
def verificar_certificado(
    folio: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Verifica un certificado por su folio único.
    Endpoint público (solo requiere autenticación mínima).
    """
    statement = select(Certificado).where(Certificado.folio == folio.upper())
    db_cert = session.exec(statement).first()
    if not db_cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    return CertificadoPublic.model_validate(db_cert, from_attributes=True)
