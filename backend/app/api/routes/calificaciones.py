"""
Endpoints de calificaciones y reseñas de cursos.
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models._enums import EstadoCalificacion, EstadoInscripcion

router = APIRouter(prefix="/calificaciones", tags=["calificaciones"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CalificacionCreate(SQLModel):
    estrellas: int
    titulo: str | None = None
    comentario: str | None = None


class CalificacionUpdate(SQLModel):
    estrellas: int | None = None
    titulo: str | None = None
    comentario: str | None = None


class CalificacionPublic(SQLModel):
    id: uuid.UUID
    usuario_id: uuid.UUID
    curso_id: uuid.UUID
    estrellas: int
    titulo: str | None = None
    comentario: str | None = None
    estado: EstadoCalificacion
    creado_en: datetime
    actualizado_en: datetime | None = None


class CalificacionesPublic(SQLModel):
    data: list[CalificacionPublic]
    count: int


class VotoCreate(SQLModel):
    voto: int  # -1, 0 o 1


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/cursos/{curso_id}", response_model=CalificacionPublic, status_code=201)
def crear_calificacion(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    cal_in: CalificacionCreate,
) -> Any:
    """
    Crea una reseña para un curso.
    El usuario debe estar inscrito (inscripción activa o finalizada).
    """
    if not 1 <= cal_in.estrellas <= 5:
        raise HTTPException(status_code=422, detail="Las estrellas deben ser entre 1 y 5")

    # Verificar inscripción
    inscripcion = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=current_user.id, curso_id=curso_id
    )
    if not inscripcion or inscripcion.estado == EstadoInscripcion.CANCELADO:
        raise HTTPException(status_code=403, detail="Debes estar inscrito en el curso para calificarlo")

    # Verificar si ya calificó
    existing = crud.get_calificacion_by_usuario_curso(
        session=session, usuario_id=current_user.id, curso_id=curso_id
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya calificaste este curso")

    db_cal = crud.create_calificacion(
        session=session,
        usuario_id=current_user.id,
        curso_id=curso_id,
        estrellas=cal_in.estrellas,
        titulo=cal_in.titulo,
        comentario=cal_in.comentario,
    )
    return CalificacionPublic.model_validate(db_cal, from_attributes=True)


@router.get("/cursos/{curso_id}", response_model=CalificacionesPublic)
def listar_calificaciones(
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Lista las reseñas públicas de un curso."""
    items, count = crud.get_calificaciones_curso(
        session=session, curso_id=curso_id, skip=skip, limit=limit
    )
    return CalificacionesPublic(
        data=[CalificacionPublic.model_validate(c, from_attributes=True) for c in items],
        count=count,
    )


@router.patch("/{calificacion_id}", response_model=CalificacionPublic)
def actualizar_calificacion(
    *,
    calificacion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    cal_in: CalificacionUpdate,
) -> Any:
    """Actualiza la propia calificación."""
    db_cal = crud.get_calificacion(session=session, calificacion_id=calificacion_id)
    if not db_cal:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")
    if db_cal.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta calificación")

    db_cal = crud.update_calificacion(
        session=session,
        db_cal=db_cal,
        estrellas=cal_in.estrellas,
        titulo=cal_in.titulo,
        comentario=cal_in.comentario,
    )
    return CalificacionPublic.model_validate(db_cal, from_attributes=True)


@router.post("/{calificacion_id}/votar", status_code=200)
def votar_resena(
    *,
    calificacion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    voto_in: VotoCreate,
) -> Any:
    """Vota si una reseña fue útil (1), no útil (-1) o neutral (0)."""
    if voto_in.voto not in (-1, 0, 1):
        raise HTTPException(status_code=422, detail="El voto debe ser -1, 0 o 1")

    db_cal = crud.get_calificacion(session=session, calificacion_id=calificacion_id)
    if not db_cal:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")

    # No votar la propia reseña
    if db_cal.usuario_id == current_user.id:
        raise HTTPException(status_code=403, detail="No puedes votar tu propia reseña")

    crud.upsert_voto_resena(
        session=session,
        calificacion_id=calificacion_id,
        usuario_id=current_user.id,
        voto=voto_in.voto,
    )
    return {"ok": True, "voto": voto_in.voto}
