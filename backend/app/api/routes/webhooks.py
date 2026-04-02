"""
Webhook de Bunny.net para recibir notificaciones de encoding completado.
Bunny envía una petición POST cuando un video termina de procesarse.
Docs: https://docs.bunny.net/reference/video-webhooks
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from sqlmodel import select

from app.api.deps import SessionDep
from app.core.config import settings
from app.models.contenido import Leccion, Modulo, Curso
from app.services import bunny as bunny_svc

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/bunny", status_code=200)
async def bunny_webhook(
    request: Request,
    session: SessionDep,
    bunnycdn_signature: str | None = Header(default=None, alias="BunnycdnVideoId-Signature"),
) -> Any:
    """
    Recibe notificaciones de Bunny.net cuando un video termina de codificarse.
    Bunny envía: VideoLibraryId, VideoGuid, Status, Bitrate, etc.

    Payload esperado:
    {
        "VideoLibraryId": 123456,
        "VideoGuid": "uuid-del-video",
        "Status": 3,  # 3=finished, 4=resolution_finished, 5=failed
        ...
    }
    """
    payload_bytes = await request.body()

    # ISO 25010 §6.7 — Seguridad: validar firma siempre que haya secret configurado.
    # Si no hay firma en el header O la validación falla → rechazar (fail-closed).
    if settings.BUNNY_WEBHOOK_SECRET:
        if not bunnycdn_signature or not bunny_svc.verify_webhook_signature(
            payload_bytes, bunnycdn_signature
        ):
            raise HTTPException(status_code=401, detail="Firma de webhook inválida o ausente")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload JSON inválido")

    video_guid = data.get("VideoGuid") or data.get("videoGuid")
    status = data.get("Status") or data.get("status", 0)
    video_library_id = str(data.get("VideoLibraryId") or data.get("videoLibraryId") or "")

    if not video_guid:
        return {"ok": True, "message": "Sin VideoGuid, ignorado"}

    # Buscar la lección que tiene este bunny_video_id
    statement = select(Leccion).where(Leccion.bunny_video_id == str(video_guid))
    db_leccion = session.exec(statement).first()

    if not db_leccion:
        return {"ok": True, "message": "Lección no encontrada para este video"}

    # Validar que el VideoLibraryId coincide con el curso o el default del .env
    if video_library_id:
        db_modulo = session.get(Modulo, db_leccion.modulo_id)
        db_curso = session.get(Curso, db_modulo.curso_id) if db_modulo else None
        curso_lib = db_curso.bunny_library_id if db_curso else None
        default_lib = settings.BUNNY_LIBRARY_ID or ""
        expected = curso_lib or default_lib
        if expected and video_library_id != str(expected):
            return {"ok": True, "message": "VideoLibraryId no coincide, ignorado"}

    # Status 3=finished, 4=resolution_finished → actualizar URLs
    if status in (3, 4):
        db_leccion.hls_url = bunny_svc.build_hls_url(str(video_guid))
        db_leccion.thumbnail_url = bunny_svc.build_thumbnail_url(str(video_guid))

        # Actualizar duración si Bunny la provee
        duration = data.get("Duration") or data.get("duration")
        if duration:
            db_leccion.duracion_seg = int(float(duration))

        db_leccion.actualizado_en = datetime.utcnow()
        session.add(db_leccion)
        session.commit()

        return {
            "ok": True,
            "message": f"Lección {db_leccion.id} actualizada con video listo",
            "hls_url": db_leccion.hls_url,
        }

    elif status in (5, 6):
        # Encoding fallido — limpiar bunny_video_id para permitir reintento
        db_leccion.bunny_video_id = None
        db_leccion.hls_url = None
        db_leccion.thumbnail_url = None
        db_leccion.actualizado_en = datetime.utcnow()
        session.add(db_leccion)
        session.commit()

        return {"ok": True, "message": f"Video fallido, bunny_video_id limpiado en lección {db_leccion.id}"}

    return {"ok": True, "message": f"Status {status} recibido, sin acción"}
