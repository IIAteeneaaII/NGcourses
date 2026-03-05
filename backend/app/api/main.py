from fastapi import APIRouter

from app.api.routes import (
    calificaciones,
    certificados,
    cursos,
    inscripciones,
    items,
    login,
    private,
    progreso,
    users,
    utils,
    webhooks,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(cursos.router)
api_router.include_router(inscripciones.router)
api_router.include_router(progreso.router)
api_router.include_router(calificaciones.router)
api_router.include_router(certificados.router)
api_router.include_router(webhooks.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
