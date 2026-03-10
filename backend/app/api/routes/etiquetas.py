"""CRUD de etiquetas y asignación a cursos."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import SQLModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models._enums import RolUsuario
from app.models.contenido import EtiquetaCreate, EtiquetaPublic, EtiquetaUpdate
from app.models.schemas import Message

router = APIRouter(tags=["etiquetas"])


# ── Etiquetas CRUD ─────────────────────────────────────────────────────────────

@router.get("/etiquetas/", response_model=list[EtiquetaPublic])
def list_etiquetas(session: SessionDep, current_user: CurrentUser) -> Any:
    """Lista todas las etiquetas."""
    return crud.get_etiquetas(session=session)


@router.post(
    "/etiquetas/",
    response_model=EtiquetaPublic,
    status_code=201,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_etiqueta(*, session: SessionDep, etiqueta_in: EtiquetaCreate) -> Any:
    """Crea una etiqueta. Solo admins."""
    return crud.create_etiqueta(session=session, etiqueta_in=etiqueta_in)


@router.patch(
    "/etiquetas/{etiqueta_id}",
    response_model=EtiquetaPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_etiqueta(
    *, etiqueta_id: uuid.UUID, session: SessionDep, etiqueta_in: EtiquetaUpdate
) -> Any:
    db = crud.get_etiqueta(session=session, etiqueta_id=etiqueta_id)
    if not db:
        raise HTTPException(status_code=404, detail="Etiqueta no encontrada")
    return crud.update_etiqueta(session=session, db_etiqueta=db, etiqueta_in=etiqueta_in)


@router.delete(
    "/etiquetas/{etiqueta_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_etiqueta(*, etiqueta_id: uuid.UUID, session: SessionDep) -> Any:
    db = crud.get_etiqueta(session=session, etiqueta_id=etiqueta_id)
    if not db:
        raise HTTPException(status_code=404, detail="Etiqueta no encontrada")
    crud.delete_etiqueta(session=session, etiqueta_id=etiqueta_id)
    return Message(message="Etiqueta eliminada exitosamente")


# ── Asignación etiquetas ↔ cursos ──────────────────────────────────────────────

class EtiquetaAsignarBody(SQLModel):
    etiqueta_id: uuid.UUID


@router.post("/cursos/{curso_id}/etiquetas", response_model=Message, status_code=201)
def asignar_etiqueta(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: EtiquetaAsignarBody,
) -> Any:
    """Asigna una etiqueta a un curso."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin and current_user.id != db_curso.instructor_id:
        raise HTTPException(status_code=403, detail="Sin permiso")

    db_etiqueta = crud.get_etiqueta(session=session, etiqueta_id=body.etiqueta_id)
    if not db_etiqueta:
        raise HTTPException(status_code=404, detail="Etiqueta no encontrada")

    crud.assign_etiqueta_curso(session=session, curso_id=curso_id, etiqueta_id=body.etiqueta_id)
    return Message(message="Etiqueta asignada exitosamente")


@router.delete("/cursos/{curso_id}/etiquetas/{etiqueta_id}", response_model=Message)
def remover_etiqueta(
    *,
    curso_id: uuid.UUID,
    etiqueta_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Remueve una etiqueta de un curso."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin and current_user.id != db_curso.instructor_id:
        raise HTTPException(status_code=403, detail="Sin permiso")

    crud.remove_etiqueta_curso(session=session, curso_id=curso_id, etiqueta_id=etiqueta_id)
    return Message(message="Etiqueta removida exitosamente")
