"""
Servicio Bunny.net Stream API.
Documentación: https://docs.bunny.net/reference/manage-videos

Claves utilizadas:
  BUNNY_API_KEY   → AccessKey en el header REST API (operaciones CRUD de video)
  BUNNY_TOKEN_KEY → Firma SHA256 para autorizar uploads TUS (distinta a la API key)
  BUNNY_LIBRARY_ID → ID numérico de la librería de video
  BUNNY_CDN_HOSTNAME → Hostname del pull zone (e.g. vz-0bae202f-e4d.b-cdn.net)

Soporte para múltiples librerías:
  Usa las funciones con parámetro library_id/api_key explícito.
  Si no se pasan, se toman los valores por defecto del .env.
"""
import hashlib
import hmac
import time
import httpx
from typing import Any

from app.core.config import settings


BUNNY_STREAM_BASE = "https://video.bunnycdn.com/library"
BUNNY_TUS_URL = "https://video.bunnycdn.com/tusupload"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _api_key(override: str | None = None) -> str:
    return override or settings.BUNNY_API_KEY or ""

def _token_key(override: str | None = None) -> str:
    """Token key para firmar uploads TUS (BUNNY_TOKEN_KEY)."""
    return override or settings.BUNNY_TOKEN_KEY or settings.BUNNY_API_KEY or ""

def _lib(override: str | None = None) -> str:
    return override or settings.BUNNY_LIBRARY_ID or ""

def _cdn(override: str | None = None) -> str:
    return override or settings.BUNNY_CDN_HOSTNAME or ""

def _headers(api_key: str | None = None) -> dict[str, str]:
    return {
        "AccessKey": _api_key(api_key),
        "Content-Type": "application/json",
        "accept": "application/json",
    }


# ---------------------------------------------------------------------------
# Video CRUD
# ---------------------------------------------------------------------------

def create_collection(
    name: str,
    library_id: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Crea una colección en Bunny Stream. Retorna { guid, name, ... }"""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BUNNY_STREAM_BASE}/{_lib(library_id)}/collections",
            headers=_headers(api_key),
            json={"name": name},
        )
        resp.raise_for_status()
        return resp.json()


def create_video(
    title: str,
    collection_id: str | None = None,
    library_id: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Crea un video en Bunny Stream. Retorna el objeto con guid (videoId)."""
    payload: dict[str, Any] = {"title": title}
    if collection_id:
        payload["collectionId"] = collection_id

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BUNNY_STREAM_BASE}/{_lib(library_id)}/videos",
            headers=_headers(api_key),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def get_video(
    video_id: str,
    library_id: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Obtiene información y estado del video desde Bunny Stream."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{BUNNY_STREAM_BASE}/{_lib(library_id)}/videos/{video_id}",
            headers=_headers(api_key),
        )
        resp.raise_for_status()
        return resp.json()


def delete_video(
    video_id: str,
    library_id: str | None = None,
    api_key: str | None = None,
) -> None:
    """Elimina un video de Bunny Stream."""
    with httpx.Client(timeout=30) as client:
        resp = client.delete(
            f"{BUNNY_STREAM_BASE}/{_lib(library_id)}/videos/{video_id}",
            headers=_headers(api_key),
        )
        resp.raise_for_status()


def update_video_metadata(
    video_id: str,
    title: str,
    library_id: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Actualiza el título del video en Bunny."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BUNNY_STREAM_BASE}/{_lib(library_id)}/videos/{video_id}",
            headers=_headers(api_key),
            json={"title": title},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Upload TUS
# ---------------------------------------------------------------------------

def _upload_expiry() -> str:
    """Timestamp de expiración (1 hora desde ahora)."""
    return str(int(time.time()) + 3600)


def _sign_upload(
    video_id: str,
    library_id: str | None = None,
    token_key: str | None = None,
) -> tuple[str, str]:
    """
    Genera la firma SHA256 para autorizar upload TUS.
    Fórmula: SHA256(libraryId + tokenKey + expiry + videoId)
    Retorna (signature, expiry).
    """
    expiry = _upload_expiry()
    raw = f"{_lib(library_id)}{_token_key(token_key)}{expiry}{video_id}"
    signature = hashlib.sha256(raw.encode()).hexdigest()
    return signature, expiry


def get_tus_upload_url(video_id: str) -> str:
    return BUNNY_TUS_URL


def get_tus_headers(
    video_id: str,
    file_size: int = 0,
    library_id: str | None = None,
    token_key: str | None = None,
) -> dict[str, str]:
    """
    Headers necesarios que el frontend debe enviar al hacer el upload TUS.
    El frontend (VideoUploadButton) los inyecta en el XMLHttpRequest.
    """
    signature, expiry = _sign_upload(video_id, library_id, token_key)
    return {
        "AuthorizationSignature": signature,
        "AuthorizationExpire": expiry,
        "VideoId": video_id,
        "LibraryId": _lib(library_id),
    }


# ---------------------------------------------------------------------------
# URL builders
# ---------------------------------------------------------------------------

def build_embed_url(
    video_id: str,
    library_id: str | None = None,
    autoplay: bool = False,
) -> str:
    """URL iframe de Bunny.net para incrustar el reproductor."""
    autoplay_str = "true" if autoplay else "false"
    return (
        f"https://iframe.mediadelivery.net/embed/{_lib(library_id)}/{video_id}"
        f"?autoplay={autoplay_str}&loop=false&muted=false&preload=true&responsive=true"
    )


def build_hls_url(video_id: str, cdn_hostname: str | None = None) -> str:
    """URL HLS (.m3u8) para reproductores nativos."""
    return f"https://{_cdn(cdn_hostname)}/{video_id}/playlist.m3u8"


def build_thumbnail_url(video_id: str, cdn_hostname: str | None = None) -> str:
    """URL del thumbnail generado por Bunny tras el encoding."""
    return f"https://{_cdn(cdn_hostname)}/{video_id}/thumbnail.jpg"


# ---------------------------------------------------------------------------
# Webhook security
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload: bytes, received_signature: str) -> bool:
    """
    Valida la firma HMAC-SHA256 del webhook de Bunny.net.
    Si BUNNY_WEBHOOK_SECRET no está configurado, acepta todo (dev mode).
    """
    if not settings.BUNNY_WEBHOOK_SECRET:
        return True

    expected = hmac.new(
        settings.BUNNY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, received_signature)


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

VIDEO_STATUS = {
    0: "queued",
    1: "processing",
    2: "encoding",
    3: "finished",
    4: "resolution_finished",
    5: "failed",
    6: "upload_failed",
}


def is_video_ready(video_id: str, library_id: str | None = None) -> bool:
    """Verifica si el video terminó de codificarse en Bunny."""
    info = get_video(video_id, library_id=library_id)
    return info.get("status", 0) in (3, 4)
