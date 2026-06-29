"""
Panel de administración de solicitudes de curso (CP09).

El supervisor crea solicitudes vía `/supervisor/solicitudes`; aquí el admin las
ve TODAS (de cualquier organización) y las gestiona: aprobar / rechazar / poner
en revisión, con un comentario opcional para el supervisor.
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app import crud
from app.api.deps import AdminOrSuperuser, SessionDep
from app.models import User
from app.models._enums import EstadoSolicitud
from app.models.organizacion import Organizacion

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class SolicitudAdminPublic(SQLModel):
    id: uuid.UUID
    organizacion_id: uuid.UUID
    organizacion_nombre: str | None = None
    solicitante_nombre: str | None = None
    solicitante_email: str | None = None
    titulo_solicitud: str
    descripcion: str | None = None
    estado: str
    creado_en: datetime
    actualizado_en: datetime | None = None


class SolicitudesAdminPublic(SQLModel):
    data: list[SolicitudAdminPublic]
    count: int


class SolicitudUpdate(SQLModel):
    estado: EstadoSolicitud
    comentario: str | None = None
    # Al APROBAR, opcionalmente se licencia un curso a la organización solicitante
    # en el mismo paso → aparece de inmediato en sus "cursos de la organización".
    # Si se omite, la solicitud solo queda aprobada (se licencia después).
    curso_id: uuid.UUID | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=SolicitudesAdminPublic)
def listar_solicitudes_admin(
    *, session: SessionDep, current_user: AdminOrSuperuser,
) -> Any:
    """Lista todas las solicitudes de curso (cualquier organización)."""
    items = crud.list_all_solicitudes(session=session)

    # Enriquecer con org y solicitante en lote (evita N+1).
    org_ids = {s.organizacion_id for s in items}
    user_ids = {s.solicitante_id for s in items}
    orgs = {
        o.id: o for o in session.exec(
            select(Organizacion).where(Organizacion.id.in_(org_ids))
        ).all()
    } if org_ids else {}
    users = {
        u.id: u for u in session.exec(
            select(User).where(User.id.in_(user_ids))
        ).all()
    } if user_ids else {}

    data = []
    for s in items:
        org = orgs.get(s.organizacion_id)
        u = users.get(s.solicitante_id)
        data.append(SolicitudAdminPublic(
            id=s.id,
            organizacion_id=s.organizacion_id,
            organizacion_nombre=org.nombre if org else None,
            solicitante_nombre=(u.full_name or u.email) if u else None,
            solicitante_email=u.email if u else None,
            titulo_solicitud=s.titulo_solicitud,
            descripcion=s.descripcion,
            estado=s.estado.value if hasattr(s.estado, "value") else str(s.estado),
            creado_en=s.creado_en,
            actualizado_en=s.actualizado_en,
        ))
    return SolicitudesAdminPublic(data=data, count=len(data))


@router.patch("/{solicitud_id}", response_model=SolicitudAdminPublic)
def actualizar_solicitud_admin(
    *, solicitud_id: uuid.UUID, session: SessionDep,
    current_user: AdminOrSuperuser, body: SolicitudUpdate,
) -> Any:
    """Cambia el estado de una solicitud (aprobar/rechazar/revisión) con
    comentario opcional dirigido al supervisor."""
    solicitud = crud.get_solicitud(session=session, solicitud_id=solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if body.comentario and body.comentario.strip():
        crud.add_comentario_solicitud(
            session=session, solicitud_id=solicitud.id,
            autor_id=current_user.id, comentario=body.comentario.strip(),
        )

    # Cerrar el ciclo: aprobar + licenciar el curso elegido a la org solicitante,
    # para que aparezca en sus "cursos de la organización" sin un paso aparte.
    if body.estado == EstadoSolicitud.APROBADA and body.curso_id is not None:
        curso = crud.get_curso(session=session, curso_id=body.curso_id)
        if not curso:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        crud.assign_licencia(
            session=session,
            org_id=solicitud.organizacion_id,
            curso_id=body.curso_id,
        )

    solicitud = crud.set_solicitud_estado(
        session=session, solicitud=solicitud, estado=body.estado
    )

    org = session.get(Organizacion, solicitud.organizacion_id)
    u = session.get(User, solicitud.solicitante_id)
    return SolicitudAdminPublic(
        id=solicitud.id,
        organizacion_id=solicitud.organizacion_id,
        organizacion_nombre=org.nombre if org else None,
        solicitante_nombre=(u.full_name or u.email) if u else None,
        solicitante_email=u.email if u else None,
        titulo_solicitud=solicitud.titulo_solicitud,
        descripcion=solicitud.descripcion,
        estado=solicitud.estado.value if hasattr(solicitud.estado, "value") else str(solicitud.estado),
        creado_en=solicitud.creado_en,
        actualizado_en=solicitud.actualizado_en,
    )
