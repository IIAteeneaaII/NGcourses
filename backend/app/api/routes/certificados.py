"""
Endpoints de certificados de completado de cursos.
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app.api.deps import CurrentUser, SessionDep
from app.models.inscripcion import Certificado

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
