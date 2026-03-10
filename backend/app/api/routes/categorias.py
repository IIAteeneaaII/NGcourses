"""CRUD de categorías de cursos."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models.contenido import CategoriaCreate, CategoriaPublic, CategoriaUpdate
from app.models.schemas import Message

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("/", response_model=list[CategoriaPublic])
def list_categorias(session: SessionDep, current_user: CurrentUser) -> Any:
    """Lista todas las categorías."""
    return crud.get_categorias(session=session)


@router.get("/{categoria_id}", response_model=CategoriaPublic)
def get_categoria(
    categoria_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    db = crud.get_categoria(session=session, categoria_id=categoria_id)
    if not db:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return db


@router.post(
    "/",
    response_model=CategoriaPublic,
    status_code=201,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_categoria(*, session: SessionDep, categoria_in: CategoriaCreate) -> Any:
    """Crea una categoría. Solo admins."""
    return crud.create_categoria(session=session, categoria_in=categoria_in)


@router.patch(
    "/{categoria_id}",
    response_model=CategoriaPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_categoria(
    *, categoria_id: uuid.UUID, session: SessionDep, categoria_in: CategoriaUpdate
) -> Any:
    db = crud.get_categoria(session=session, categoria_id=categoria_id)
    if not db:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return crud.update_categoria(session=session, db_categoria=db, categoria_in=categoria_in)


@router.delete(
    "/{categoria_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_categoria(*, categoria_id: uuid.UUID, session: SessionDep) -> Any:
    db = crud.get_categoria(session=session, categoria_id=categoria_id)
    if not db:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    crud.delete_categoria(session=session, categoria_id=categoria_id)
    return Message(message="Categoría eliminada exitosamente")
