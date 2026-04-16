import logging
import os
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import func, select

logger = logging.getLogger(__name__)

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.core.config import settings
from app.models._enums import EstadoCurso, EstadoInscripcion, RolUsuario
from app.models.inscripcion import Inscripcion
from app.models.contenido import (
    BunnyVideoInitResponse,
    BunnyVideoStatusResponse,
    CursoCreate,
    CursoDetalle,
    CursoPublic,
    CursosPublic,
    CursoUpdate,
    LeccionCreate,
    LeccionPublic,
    LeccionUpdate,
    ModuloCreate,
    ModuloPublic,
    ModuloUpdate,
    RecursoLeccionCreate,
    RecursoLeccionPublic,
)
from app.models.schemas import Message
from app.services import bunny as bunny_svc

router = APIRouter(prefix="/cursos", tags=["cursos"])


def _require_instructor_or_admin(current_user: CurrentUser) -> None:
    """Raise 403 if user is not instructor or superuser."""
    allowed = {RolUsuario.INSTRUCTOR, RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL}
    if not current_user.is_superuser and current_user.rol not in allowed:
        raise HTTPException(status_code=403, detail="Se requiere rol de instructor o administrador")


def _require_curso_owner_or_admin(current_user: CurrentUser, instructor_id: uuid.UUID) -> None:
    """Raise 403 if user is not the course owner and not superuser/admin."""
    is_admin = current_user.is_superuser or current_user.rol == RolUsuario.ADMINISTRADOR
    if not is_admin and current_user.id != instructor_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para modificar este curso")


# ── Cursos ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=CursosPublic)
def list_cursos(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    estado: EstadoCurso | None = None,
    categoria_id: uuid.UUID | None = None,
    search: str | None = None,
) -> Any:
    """
    Lista cursos. Usuarios normales solo ven PUBLICADOS.
    Instructores ven sus propios cursos en cualquier estado.
    Admins/superusers ven todos.
    Soporta filtros: ?categoria_id=&search=&estado=
    """
    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }

    if is_admin:
        cursos, count = crud.get_cursos(
            session=session, skip=skip, limit=limit,
            estado=estado, categoria_id=categoria_id, search=search
        )
    elif current_user.rol == RolUsuario.INSTRUCTOR:
        cursos, count = crud.get_cursos(
            session=session, skip=skip, limit=limit,
            estado=estado, instructor_id=current_user.id,
            categoria_id=categoria_id, search=search
        )
    else:
        # Estudiantes/Supervisores: catálogo = marca NEXTGEN publicados +
        # cursos con LicenciaCurso ACTIVA para la org del usuario.
        cursos, count = crud.list_cursos_for_student(
            session=session, user_id=current_user.id,
            skip=skip, limit=limit, categoria_id=categoria_id, search=search,
        )

    return CursosPublic(data=cursos, count=count)


@router.get("/{curso_id}", response_model=CursoDetalle)
def get_curso(
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Obtiene un curso con sus módulos y lecciones."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    is_owner = current_user.id == db_curso.instructor_id

    # Estudiantes solo pueden ver cursos publicados
    if not is_admin and not is_owner and db_curso.estado != EstadoCurso.PUBLICADO:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    # Cargar módulos y lecciones en 2 queries (evita N+1) — ISO 25010 §6.4
    modulos_db = crud.get_modulos(session=session, curso_id=curso_id)
    lecciones_map = crud.get_lecciones_for_modulos(
        session=session, modulo_ids=[m.id for m in modulos_db]
    )
    modulos = []
    for m in modulos_db:
        modulo_data = ModuloPublic.model_validate(m, from_attributes=True)
        modulo_data.lecciones = [
            LeccionPublic.model_validate(l, from_attributes=True)
            for l in lecciones_map.get(m.id, [])
        ]
        modulos.append(modulo_data)

    curso_data = CursoDetalle.model_validate(db_curso, from_attributes=True)
    curso_data.modulos = modulos
    meta = db_curso.metadata_ or {}
    curso_data.nivel = meta.get("nivel")
    curso_data.lo_que_aprenderas = meta.get("lo_que_aprenderas", [])
    curso_data.requisitos = meta.get("requisitos")
    curso_data.instructor_nombre = db_curso.instructor.full_name if db_curso.instructor else None
    return curso_data


@router.post("/", response_model=CursoPublic, status_code=201)
def create_curso(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    curso_in: CursoCreate,
) -> Any:
    """Crea un nuevo curso. Solo instructores y admins."""
    _require_instructor_or_admin(current_user)

    db_curso = crud.create_curso(
        session=session, curso_in=curso_in, instructor_id=current_user.id
    )

    # Crear colección en Bunny.net con el nombre del curso y guardar library_id
    if settings.bunny_enabled:
        try:
            collection = bunny_svc.create_collection(name=db_curso.titulo)
            db_curso.bunny_collection_id = collection.get("guid")
            db_curso.bunny_library_id = settings.BUNNY_LIBRARY_ID or db_curso.bunny_library_id
            session.add(db_curso)
            session.commit()
            session.refresh(db_curso)
        except Exception as exc:
            # ISO 25010 §6.4 — Fiabilidad: se loggea para diagnóstico, no falla el curso
            logger.warning("No se pudo crear colección en Bunny.net: %s", exc)

    return db_curso


@router.patch("/{curso_id}", response_model=CursoPublic)
def update_curso(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    curso_in: CursoUpdate,
) -> Any:
    """Actualiza un curso. Solo el instructor propietario o admin."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    db_curso = crud.update_curso(session=session, db_curso=db_curso, curso_in=curso_in)
    return db_curso


@router.delete("/{curso_id}", response_model=Message)
def delete_curso(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Elimina un curso (cascade: módulos y lecciones). Solo admin o propietario."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    crud.delete_curso(session=session, curso_id=curso_id)
    return Message(message="Curso eliminado exitosamente")


# ── Portada ───────────────────────────────────────────────────────────────────

COVERS_DIR = "/app/app/media/covers"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/{curso_id}/cover", response_model=CursoPublic)
async def upload_cover(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """Sube la imagen de portada del curso. Guarda en disco y actualiza portada_url."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use JPEG, PNG o WEBP.")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen excede el tamaño máximo de 5MB.")

    ext = (file.filename or "cover.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "jpg"

    os.makedirs(COVERS_DIR, exist_ok=True)
    filename = f"{curso_id}.{ext}"
    filepath = os.path.join(COVERS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    portada_url = f"/media/covers/{filename}"
    db_curso.portada_url = portada_url
    session.add(db_curso)
    session.commit()
    session.refresh(db_curso)

    return db_curso


# ── Módulos ───────────────────────────────────────────────────────────────────

@router.get("/{curso_id}/modulos", response_model=list[ModuloPublic])
def list_modulos(
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Lista los módulos de un curso."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    modulos_db = crud.get_modulos(session=session, curso_id=curso_id)
    result = []
    for m in modulos_db:
        lecciones = crud.get_lecciones(session=session, modulo_id=m.id)
        modulo_data = ModuloPublic.model_validate(m, from_attributes=True)
        modulo_data.lecciones = [LeccionPublic.model_validate(l, from_attributes=True) for l in lecciones]
        result.append(modulo_data)
    return result


@router.post("/{curso_id}/modulos", response_model=ModuloPublic, status_code=201)
def create_modulo(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    modulo_in: ModuloCreate,
) -> Any:
    """Crea un módulo en el curso."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    db_modulo = crud.create_modulo(session=session, modulo_in=modulo_in, curso_id=curso_id)
    modulo_data = ModuloPublic.model_validate(db_modulo, from_attributes=True)
    modulo_data.lecciones = []
    return modulo_data


@router.patch("/{curso_id}/modulos/{modulo_id}", response_model=ModuloPublic)
def update_modulo(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    modulo_in: ModuloUpdate,
) -> Any:
    """Actualiza un módulo."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    from app.models.contenido import Modulo
    db_modulo = session.get(Modulo, modulo_id)
    if not db_modulo or db_modulo.curso_id != curso_id:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    db_modulo = crud.update_modulo(session=session, db_modulo=db_modulo, modulo_in=modulo_in)
    modulo_data = ModuloPublic.model_validate(db_modulo, from_attributes=True)
    lecciones = crud.get_lecciones(session=session, modulo_id=modulo_id)
    modulo_data.lecciones = [LeccionPublic.model_validate(l, from_attributes=True) for l in lecciones]
    return modulo_data


@router.delete("/{curso_id}/modulos/{modulo_id}", response_model=Message)
def delete_modulo(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Elimina un módulo (cascade: lecciones)."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    from app.models.contenido import Modulo
    db_modulo = session.get(Modulo, modulo_id)
    if not db_modulo or db_modulo.curso_id != curso_id:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    crud.delete_modulo(session=session, modulo_id=modulo_id)
    return Message(message="Módulo eliminado exitosamente")


# ── Lecciones ─────────────────────────────────────────────────────────────────

@router.get("/{curso_id}/modulos/{modulo_id}/lecciones", response_model=list[LeccionPublic])
def list_lecciones(
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Lista las lecciones de un módulo."""
    from app.models.contenido import Modulo
    db_modulo = session.get(Modulo, modulo_id)
    if not db_modulo or db_modulo.curso_id != curso_id:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    lecciones = crud.get_lecciones(session=session, modulo_id=modulo_id)
    return [LeccionPublic.model_validate(l, from_attributes=True) for l in lecciones]


@router.post("/{curso_id}/modulos/{modulo_id}/lecciones", response_model=LeccionPublic, status_code=201)
def create_leccion(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    leccion_in: LeccionCreate,
) -> Any:
    """Crea una lección en el módulo."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    from app.models.contenido import Modulo
    db_modulo = session.get(Modulo, modulo_id)
    if not db_modulo or db_modulo.curso_id != curso_id:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    db_leccion = crud.create_leccion(session=session, leccion_in=leccion_in, modulo_id=modulo_id)
    return LeccionPublic.model_validate(db_leccion, from_attributes=True)


@router.patch("/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}", response_model=LeccionPublic)
def update_leccion(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    leccion_in: LeccionUpdate,
) -> Any:
    """Actualiza una lección."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    from app.models.contenido import Leccion
    db_leccion = session.get(Leccion, leccion_id)
    if not db_leccion or db_leccion.modulo_id != modulo_id:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    db_leccion = crud.update_leccion(session=session, db_leccion=db_leccion, leccion_in=leccion_in)
    return LeccionPublic.model_validate(db_leccion, from_attributes=True)


@router.delete("/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}", response_model=Message)
def delete_leccion(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Elimina una lección."""
    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    from app.models.contenido import Leccion
    db_leccion = session.get(Leccion, leccion_id)
    if not db_leccion or db_leccion.modulo_id != modulo_id:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    crud.delete_leccion(session=session, leccion_id=leccion_id)
    return Message(message="Lección eliminada exitosamente")


# ── Video Bunny.net ────────────────────────────────────────────────────────────

def _get_leccion_with_access(
    session: SessionDep,
    current_user: CurrentUser,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
):
    """Helper: valida acceso y retorna (db_curso, db_leccion)."""
    from app.models.contenido import Leccion, Modulo

    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    _require_curso_owner_or_admin(current_user, db_curso.instructor_id)

    db_modulo = session.get(Modulo, modulo_id)
    if not db_modulo or db_modulo.curso_id != curso_id:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    db_leccion = session.get(Leccion, leccion_id)
    if not db_leccion or db_leccion.modulo_id != modulo_id:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    return db_curso, db_leccion


@router.post(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/video-init",
    response_model=BunnyVideoInitResponse,
    status_code=201,
)
def init_video_upload(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Inicia el proceso de upload de video a Bunny.net para una lección.
    1. Crea el video en Bunny Stream.
    2. Guarda el bunny_video_id en la lección.
    3. Retorna la URL TUS y headers para que el frontend suba directamente.
    """
    if not settings.bunny_enabled:
        raise HTTPException(status_code=503, detail="Bunny.net no configurado")

    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )

    lib_id = db_curso.bunny_library_id  # None → usará el default del .env

    # Si ya tiene video en Bunny, eliminarlo primero
    if db_leccion.bunny_video_id:
        try:
            bunny_svc.delete_video(db_leccion.bunny_video_id, library_id=lib_id)
        except httpx.HTTPError:
            pass  # Si falla la eliminación, continuar igual

    # Crear video en Bunny.net
    try:
        bunny_resp = bunny_svc.create_video(
            title=db_leccion.titulo,
            collection_id=db_curso.bunny_collection_id,
            library_id=lib_id,
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error al crear video en Bunny.net: {e}")

    video_id = bunny_resp["guid"]

    # Guardar en BD
    from app.models.contenido import Leccion
    from datetime import datetime
    db_leccion.bunny_video_id = video_id
    db_leccion.hls_url = None
    db_leccion.thumbnail_url = None
    db_leccion.actualizado_en = datetime.utcnow()
    session.add(db_leccion)
    session.commit()
    session.refresh(db_leccion)

    # Preparar respuesta con datos para TUS upload
    tus_headers = bunny_svc.get_tus_headers(video_id=video_id, library_id=lib_id)
    embed_url = bunny_svc.build_embed_url(video_id, library_id=lib_id)

    return BunnyVideoInitResponse(
        bunny_video_id=video_id,
        tus_upload_url=bunny_svc.get_tus_upload_url(video_id),
        tus_headers=tus_headers,
        embed_url=embed_url,
    )


@router.get(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/video-status",
    response_model=BunnyVideoStatusResponse,
)
def get_video_status(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Consulta el estado de encoding del video en Bunny.net."""
    if not settings.bunny_enabled:
        raise HTTPException(status_code=503, detail="Bunny.net no configurado")

    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )

    if not db_leccion.bunny_video_id:
        raise HTTPException(status_code=404, detail="Esta lección no tiene video subido")

    lib_id = db_curso.bunny_library_id

    try:
        info = bunny_svc.get_video(db_leccion.bunny_video_id, library_id=lib_id)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error consultando Bunny.net: {e}")

    raw_status = info.get("status", 0)
    status_str = bunny_svc.VIDEO_STATUS.get(raw_status, "unknown")
    is_ready = raw_status in (3, 4)

    return BunnyVideoStatusResponse(
        bunny_video_id=db_leccion.bunny_video_id,
        status=status_str,
        is_ready=is_ready,
        hls_url=db_leccion.hls_url,
        thumbnail_url=db_leccion.thumbnail_url,
        embed_url=bunny_svc.build_embed_url(db_leccion.bunny_video_id, library_id=lib_id) if is_ready else None,
    )


@router.delete(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/video",
    response_model=Message,
)
def delete_video(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Elimina el video de Bunny.net y limpia los campos de la lección."""
    if not settings.bunny_enabled:
        raise HTTPException(status_code=503, detail="Bunny.net no configurado")

    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )

    if not db_leccion.bunny_video_id:
        raise HTTPException(status_code=404, detail="Esta lección no tiene video")

    try:
        bunny_svc.delete_video(db_leccion.bunny_video_id, library_id=db_curso.bunny_library_id)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error eliminando video de Bunny.net: {e}")

    from datetime import datetime
    db_leccion.bunny_video_id = None
    db_leccion.hls_url = None
    db_leccion.thumbnail_url = None
    db_leccion.duracion_seg = 0
    db_leccion.actualizado_en = datetime.utcnow()
    session.add(db_leccion)
    session.commit()

    return Message(message="Video eliminado exitosamente")


# ── Recursos de Lección ────────────────────────────────────────────────────────

@router.get(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/recursos",
    response_model=list[RecursoLeccionPublic],
)
def list_recursos(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Lista los recursos de una lección."""
    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )
    recursos = crud.get_recursos_leccion(session=session, leccion_id=leccion_id)
    return [RecursoLeccionPublic.model_validate(r, from_attributes=True) for r in recursos]


@router.post(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/recursos",
    response_model=RecursoLeccionPublic,
    status_code=201,
)
def create_recurso(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    recurso_in: RecursoLeccionCreate,
) -> Any:
    """Crea un recurso en una lección."""
    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )
    db_recurso = crud.create_recurso_leccion(
        session=session, recurso_in=recurso_in, leccion_id=leccion_id
    )
    return RecursoLeccionPublic.model_validate(db_recurso, from_attributes=True)


RECURSOS_DIR = "/app/app/media/recursos"
_EXT_TO_TIPO = {
    "pdf": "pdf",
    "docx": "docx", "doc": "docx",
    "xlsx": "xlsx", "xls": "xlsx",
    "pptx": "pptx", "ppt": "pptx",
}
MAX_RECURSO_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/recursos/upload",
    response_model=RecursoLeccionPublic,
    status_code=201,
)
async def upload_recurso(
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    titulo: str = Form(default=""),
) -> Any:
    """Sube un archivo como recurso de una lección. Soporta PDF, DOCX, XLSX, PPTX."""
    _get_leccion_with_access(session, current_user, curso_id, modulo_id, leccion_id)

    contents = await file.read()
    if len(contents) > MAX_RECURSO_SIZE:
        raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo de 20MB.")

    ext = (file.filename or "archivo").rsplit(".", 1)[-1].lower()
    tipo = _EXT_TO_TIPO.get(ext, "archivo")

    os.makedirs(RECURSOS_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    with open(os.path.join(RECURSOS_DIR, filename), "wb") as f:
        f.write(contents)

    nombre = titulo.strip() or (file.filename or "recurso").rsplit(".", 1)[0]
    recurso_in = RecursoLeccionCreate(
        tipo=tipo,
        titulo=nombre,
        url=f"/media/recursos/{filename}",
    )
    db_recurso = crud.create_recurso_leccion(session=session, recurso_in=recurso_in, leccion_id=leccion_id)
    return RecursoLeccionPublic.model_validate(db_recurso, from_attributes=True)


@router.delete(
    "/{curso_id}/modulos/{modulo_id}/lecciones/{leccion_id}/recursos/{recurso_id}",
    response_model=Message,
)
def delete_recurso(
    *,
    curso_id: uuid.UUID,
    modulo_id: uuid.UUID,
    leccion_id: uuid.UUID,
    recurso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Elimina un recurso de una lección."""
    db_curso, db_leccion = _get_leccion_with_access(
        session, current_user, curso_id, modulo_id, leccion_id
    )
    from app.models.contenido import RecursoLeccion
    db_recurso = session.get(RecursoLeccion, recurso_id)
    if not db_recurso or db_recurso.leccion_id != leccion_id:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")

    crud.delete_recurso_leccion(session=session, recurso_id=recurso_id)
    return Message(message="Recurso eliminado exitosamente")
