from slowapi import Limiter
from starlette.requests import Request

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    """Only trusts X-Forwarded-For when the direct client is a configured trusted proxy."""
    client_host = request.client.host if request.client else None
    if client_host and settings.TRUSTED_PROXIES and client_host in settings.TRUSTED_PROXIES:
        xff = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if xff:
            return xff
    return client_host or "127.0.0.1"


limiter = Limiter(key_func=get_client_ip)
