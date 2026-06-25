"""
Endpoints de feature flags: interruptores de funcionalidad controlados por admin.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from sqlmodel import SQLModel

from app import crud
from app.api.deps import AdminOrSuperuser, CurrentUser, SessionDep

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


class FeatureFlagPublic(SQLModel):
    nombre: str
    habilitado: bool
    actualizado_en: datetime


class FeatureFlagUpdate(SQLModel):
    habilitado: bool


@router.get("", response_model=list[FeatureFlagPublic])
def listar_feature_flags(session: SessionDep, current_user: CurrentUser) -> Any:
    """Lista los feature flags. Cualquier usuario autenticado puede leerlos:
    el frontend los usa para mostrar/ocultar funcionalidad."""
    return crud.get_feature_flags(session=session)


@router.patch("/{nombre}", response_model=FeatureFlagPublic)
def actualizar_feature_flag(
    nombre: str,
    body: FeatureFlagUpdate,
    session: SessionDep,
    current_user: AdminOrSuperuser,
) -> Any:
    """Prende/apaga un feature flag. Solo admin."""
    return crud.set_feature_flag(
        session=session, nombre=nombre, habilitado=body.habilitado
    )
