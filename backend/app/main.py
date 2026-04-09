import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings

MEDIA_DIR = "/app/app/media"


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

# Set all CORS enabled origins
if settings.all_cors_origins:
    # ISO 25010 §6.7 — Seguridad: métodos HTTP explícitos en lugar de "*"
    # allow_headers="*" se mantiene por compatibilidad con tus-js-client y otros clientes
    # En local se permite también dominios de túnel de desarrollo (loca.lt, ngrok)
    origin_regex = r"https://.*\.(loca\.lt|ngrok(-free)?\.app)$" if settings.ENVIRONMENT == "local" else None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_origin_regex=origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve uploaded media files (course covers, etc.)
# En producción AWS, servir /media con nginx o S3+CloudFront y
# setear SERVE_MEDIA=false para no desperdiciar workers de FastAPI.
os.makedirs(MEDIA_DIR, exist_ok=True)
if os.getenv("SERVE_MEDIA", "true").lower() != "false":
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
