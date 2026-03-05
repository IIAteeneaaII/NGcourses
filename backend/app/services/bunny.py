"""
Servicio Bunny.net Stream API.
Documentación: https://docs.bunny.net/reference/manage-videos
"""
import hashlib
import hmac
import httpx
from typing import Any

from app.core.config import settings


BUNNY_STREAM_BASE = "https://video.bunnycdn.com/library"


def _headers() -> dict[str, str]:
    return {
        "AccessKey": settings.BUNNY_API_KEY or "",
        "Content-Type": "application/json",
        "accept": "application/json",
    }


def _lib() -> str:
    return settings.BUNNY_LIBRARY_ID or ""


# ---------------------------------------------------------------------------
# Video CRUD en Bunny.net
# ---------------------------------------------------------------------------

def create_video(title: str, collection_id: str | None = None) -> dict[str, Any]:
    """Crea un video en Bunny Stream. Retorna el objeto video con videoId."""
    payload: dict[str, Any] = {"title": title}
    if collection_id:
        payload["collectionId"] = collection_id

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BUNNY_STREAM_BASE}/{_lib()}/videos",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def get_video(video_id: str) -> dict[str, Any]:
    """Obtiene información del video desde Bunny Stream."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{BUNNY_STREAM_BASE}/{_lib()}/videos/{video_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


def delete_video(video_id: str) -> None:
    """Elimina un video de Bunny Stream."""
    with httpx.Client(timeout=30) as client:
        resp = client.delete(
            f"{BUNNY_STREAM_BASE}/{_lib()}/videos/{video_id}",
            headers=_headers(),
        )
        resp.raise_for_status()


def update_video_metadata(video_id: str, title: str) -> dict[str, Any]:
    """Actualiza el título del video en Bunny."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BUNNY_STREAM_BASE}/{_lib()}/videos/{video_id}",
            headers=_headers(),
            json={"title": title},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Upload directo vía TUS
# ---------------------------------------------------------------------------

def get_tus_upload_url(video_id: str) -> str:
    """
    Retorna la URL TUS para upload directo desde el browser.
    El frontend usará tus-js-client apuntando a esta URL.
    """
    return f"https://video.bunnycdn.com/tusupload"


def get_tus_headers(video_id: str, file_size: int) -> dict[str, str]:
    """
    Headers necesarios para iniciar un upload TUS desde el backend/frontend.
    Ver: https://docs.bunny.net/reference/video_createvideo (TUS section)
    """
    return {
        "AuthorizationSignature": _sign_upload(video_id),
        "AuthorizationExpire": _upload_expiry(),
        "VideoId": video_id,
        "LibraryId": _lib(),
    }


def _upload_expiry() -> str:
    import time
    return str(int(time.time()) + 3600)  # 1 hora de validez


def _sign_upload(video_id: str) -> str:
    """Genera firma SHA256 para autorizar upload TUS."""
    expiry = _upload_expiry()
    raw = f"{_lib()}{settings.BUNNY_API_KEY}{expiry}{video_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# URL builders
# ---------------------------------------------------------------------------

def build_embed_url(video_id: str, autoplay: bool = False) -> str:
    """URL embed iframe de Bunny.net para reproducir video."""
    autoplay_str = "true" if autoplay else "false"
    return (
        f"https://iframe.mediadelivery.net/embed/{_lib()}/{video_id}"
        f"?autoplay={autoplay_str}&loop=false&muted=false&preload=true&responsive=true"
    )


def build_hls_url(video_id: str) -> str:
    """URL HLS (.m3u8) del video para reproductores nativos."""
    hostname = settings.BUNNY_CDN_HOSTNAME or ""
    return f"https://{hostname}/{video_id}/playlist.m3u8"


def build_thumbnail_url(video_id: str) -> str:
    """URL del thumbnail generado por Bunny.net."""
    hostname = settings.BUNNY_CDN_HOSTNAME or ""
    return f"https://{hostname}/{video_id}/thumbnail.jpg"


# ---------------------------------------------------------------------------
# Webhook security
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload: bytes, received_signature: str) -> bool:
    """
    Valida la firma HMAC-SHA256 del webhook de Bunny.net.
    Bunny envía el header 'BunnycdnVideoId-Signature' con la firma.
    """
    if not settings.BUNNY_WEBHOOK_SECRET:
        return True  # Si no hay secret configurado, aceptar (dev mode)

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


def is_video_ready(video_id: str) -> bool:
    """Verifica si el video terminó de codificarse."""
    info = get_video(video_id)
    status = info.get("status", 0)
    return status in (3, 4)  # finished o resolution_finished
