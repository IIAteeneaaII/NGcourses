"""
Endpoints de certificados de completado de cursos.
"""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import SQLModel, select

from app.api.deps import CurrentUser, SessionDep
from app.models.inscripcion import Certificado
from app.models._enums import RolUsuario

CERT_DIR = Path(__file__).parent.parent.parent / "media" / "certificados"

router = APIRouter(prefix="/certificados", tags=["certificados"])


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
        from pathlib import Path
        from app.models._enums import MarcaCurso
        from app.models import User
        from app.models.contenido import Curso as CursoModel
        from app.services.certificado_pdf import generate_certificate_pdf

        usuario = session.get(User, db_cert.usuario_id)
        curso = session.get(CursoModel, db_cert.curso_id)
        instructor = session.get(User, curso.instructor_id) if curso else None

        cert_dir = Path(__file__).parent.parent.parent / "media" / "certificados"
        cert_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(cert_dir / f"{folio.upper()}.pdf")

        generate_certificate_pdf(
            folio=folio.upper(),
            student_name=(usuario.full_name or usuario.email) if usuario else "Alumno",
            course_title=curso.titulo if curso else "",
            instructor_name=(instructor.full_name or instructor.email) if instructor else "Instructor",
            issued_date=db_cert.emitido_en,
            marca=curso.marca if curso else MarcaCurso.RAM,
            output_path=output_path,
        )

        db_cert.url_pdf = f"/media/certificados/{folio.upper()}.pdf"
        session.add(db_cert)
        session.commit()
        session.refresh(db_cert)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {exc}") from exc

    return CertificadoPublic.model_validate(db_cert, from_attributes=True)


@router.get("/me", response_model=CertificadosPublic)
def mis_certificados(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Lista los certificados del usuario actual."""
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

    if not db_cert.url_pdf:
        raise HTTPException(status_code=404, detail="El PDF de este certificado aún no está disponible")

    pdf_path = CERT_DIR / f"{folio.upper()}.pdf"
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
