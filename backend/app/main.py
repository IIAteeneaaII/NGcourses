import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.limiter import limiter

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

# Rate limiting (FND-002)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Security headers middleware (FND-008)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.ENABLE_HTTPS:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Set all CORS enabled origins
if settings.all_cors_origins:
    # ISO 25010 §6.7 — Seguridad: métodos HTTP explícitos y headers explícitos (FND-012)
    origin_regex = r"https://.*\.(loca\.lt|ngrok(-free)?\.app)$" if settings.ENVIRONMENT == "local" else None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_origin_regex=origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "Tus-Resumable",
            "Upload-Length",
            "Upload-Offset",
            "Upload-Metadata",
            "Upload-Concat",
            "Upload-Defer-Length",
        ],
        expose_headers=["X-Total-Count"],
        max_age=3600,
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve uploaded media files (course covers, etc.)
os.makedirs(MEDIA_DIR, exist_ok=True)
if os.getenv("SERVE_MEDIA", "true").lower() != "false":
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
