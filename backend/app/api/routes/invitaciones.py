import hashlib
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel

from app import crud
from app.api.deps import AdminOrSuperuser, SessionDep
from app.core.config import settings
from app.models._enums import EstadoInscripcion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invitaciones", tags=["invitaciones"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class InvitacionCreate(SQLModel):
    curso_id: uuid.UUID
    emails: list[str]


class InvitacionPublic(SQLModel):
    id: uuid.UUID
    curso_id: uuid.UUID
    email: str
    expira_en: datetime
    usado_en: datetime | None
    creado_en: datetime
    estado: str  # "pendiente" | "usada" | "expirada"


class InvitacionesPublic(SQLModel):
    data: list[InvitacionPublic]
    count: int


class InvitacionEnvioResultado(SQLModel):
    email: str
    estado: str  # "enviada" | "ya_inscrito" | "error"
    detalle: str | None = None


class CanjearRequest(SQLModel):
    token: str


class CanjearResponse(SQLModel):
    inscripcion_id: uuid.UUID
    curso_id: uuid.UUID
    curso_titulo: str
    email: str
    usuario_creado: bool
    password_temporal: str | None = None  # Solo si la cuenta fue creada en este momento


# ── Helpers ────────────────────────────────────────────────────────────────────


def _estado_invitacion(inv: Any) -> str:
    if inv.usado_en is not None:
        return "usada"
    if inv.expira_en < datetime.utcnow():
        return "expirada"
    return "pendiente"


def _to_public(inv: Any) -> InvitacionPublic:
    return InvitacionPublic(
        id=inv.id,
        curso_id=inv.curso_id,
        email=inv.email,
        expira_en=inv.expira_en,
        usado_en=inv.usado_en,
        creado_en=inv.creado_en,
        estado=_estado_invitacion(inv),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/canjear", response_model=CanjearResponse, status_code=201)
def canjear_invitacion(
    *,
    session: SessionDep,
    body: CanjearRequest,
) -> Any:
    """Endpoint público. Canjea un token de invitación, crea la cuenta si es
    nuevo usuario, y retorna la contraseña temporal para mostrarla en pantalla."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    inv = crud.get_invitacion_by_token_hash(session=session, token_hash=token_hash)

    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no válida")
    if inv.usado_en is not None:
        raise HTTPException(status_code=409, detail="Esta invitación ya fue utilizada")
    if inv.expira_en < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Esta invitación ha expirado")

    # Si el creador de la invitación pertenece a una organización (supervisor),
    # el usuario canjeado queda automáticamente vinculado a esa organización.
    org_info = crud.get_organizacion_of_user(
        session=session, user_id=inv.creado_por
    )
    creador_org_id = org_info[0].id if org_info else None

    # Crear cuenta si no existe — la contraseña se retorna solo en este momento
    user, usuario_creado, password_temporal = crud.get_or_create_user_by_email(
        session=session, email=inv.email, organizacion_id=creador_org_id,
    )

    db_curso = crud.get_curso(session=session, curso_id=inv.curso_id)
    curso_titulo = db_curso.titulo if db_curso else ""

    # Si ya está inscrito: marcar usado y retornar
    existing = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=user.id, curso_id=inv.curso_id
    )
    if existing:
        inv.usado_en = datetime.utcnow()
        session.add(inv)
        session.commit()
        return CanjearResponse(
            inscripcion_id=existing.id,
            curso_id=inv.curso_id,
            curso_titulo=curso_titulo,
            email=inv.email,
            usuario_creado=usuario_creado,
            password_temporal=password_temporal,
        )

    inscripcion = crud.canjear_invitacion(
        session=session, invitacion=inv, usuario_id=user.id
    )
    return CanjearResponse(
        inscripcion_id=inscripcion.id,
        curso_id=inv.curso_id,
        curso_titulo=curso_titulo,
        email=inv.email,
        usuario_creado=usuario_creado,
        password_temporal=password_temporal,
    )


@router.post("/", response_model=list[InvitacionEnvioResultado], status_code=201)
def crear_invitaciones(
    *,
    session: SessionDep,
    current_user: AdminOrSuperuser,
    body: InvitacionCreate,
) -> Any:
    """Envía invitaciones por email. NO crea la cuenta del alumno aquí;
    la cuenta se crea cuando el alumno acepta el enlace."""
    db_curso = crud.get_curso(session=session, curso_id=body.curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    resultados: list[InvitacionEnvioResultado] = []

    for email in body.emails:
        email = email.strip().lower()
        if not email:
            continue

        try:
            # Avisar si el alumno ya está inscrito (sin crear cuenta ni invitación)
            existing_user = crud.get_user_by_email(session=session, email=email)
            if existing_user:
                inscripcion_existente = crud.get_inscripcion_by_usuario_curso(
                    session=session,
                    usuario_id=existing_user.id,
                    curso_id=body.curso_id,
                )
                if inscripcion_existente and inscripcion_existente.estado == EstadoInscripcion.ACTIVA:
                    resultados.append(InvitacionEnvioResultado(
                        email=email,
                        estado="ya_inscrito",
                        detalle="El alumno ya está inscrito en este curso",
                    ))
                    continue

            # Crear invitación (sin crear cuenta de usuario)
            db_inv, raw_token = crud.create_invitacion(
                session=session,
                curso_id=body.curso_id,
                email=email,
                creado_por_id=current_user.id,
            )

            # Enviar email con el enlace (sin contraseña — se generará al aceptar)
            if settings.emails_enabled:
                from app.utils import generate_invitation_email, send_email
                email_data = generate_invitation_email(
                    email_to=email,
                    curso_titulo=db_curso.titulo,
                    token=raw_token,
                    password_temporal=None,
                )
                send_email(
                    email_to=email,
                    subject=email_data.subject,
                    html_content=email_data.html_content,
                )

            resultados.append(InvitacionEnvioResultado(email=email, estado="enviada"))

        except Exception as exc:
            logger.error("Error al invitar %s: %s", email, exc)
            resultados.append(InvitacionEnvioResultado(
                email=email, estado="error", detalle=str(exc)
            ))

    return resultados


@router.get("/curso/{curso_id}", response_model=InvitacionesPublic)
def listar_invitaciones_curso(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: AdminOrSuperuser,
) -> Any:
    """Lista todas las invitaciones de un curso con su estado derivado."""
    invs = crud.get_invitaciones_por_curso(session=session, curso_id=curso_id)
    return InvitacionesPublic(
        data=[_to_public(i) for i in invs],
        count=len(invs),
    )


@router.post("/{invitacion_id}/reenviar", response_model=InvitacionEnvioResultado)
def reenviar_invitacion(
    *,
    invitacion_id: uuid.UUID,
    session: SessionDep,
    current_user: AdminOrSuperuser,
) -> Any:
    """Reenvía el email de invitación generando un nuevo token. Funciona para
    invitaciones pendientes o expiradas. No permite reenviar invitaciones ya usadas."""
    inv = crud.get_invitacion_by_id(session=session, invitacion_id=invitacion_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.usado_en is not None:
        raise HTTPException(
            status_code=409, detail="No se puede reenviar una invitación ya utilizada"
        )

    db_curso = crud.get_curso(session=session, curso_id=inv.curso_id)
    curso_titulo = db_curso.titulo if db_curso else ""

    inv, raw_token = crud.reenviar_invitacion(session=session, invitacion_id=invitacion_id)

    if settings.emails_enabled:
        from app.utils import generate_invitation_email, send_email
        email_data = generate_invitation_email(
            email_to=inv.email,
            curso_titulo=curso_titulo,
            token=raw_token,
            password_temporal=None,
        )
        send_email(
            email_to=inv.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )

    return InvitacionEnvioResultado(email=inv.email, estado="enviada")


@router.delete("/{invitacion_id}", status_code=204)
def revocar_invitacion(
    *,
    invitacion_id: uuid.UUID,
    session: SessionDep,
    current_user: AdminOrSuperuser,
) -> None:
    """Revoca (elimina) una invitación pendiente. No se puede revocar si ya fue usada."""
    inv = crud.get_invitacion_by_id(session=session, invitacion_id=invitacion_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.usado_en is not None:
        raise HTTPException(
            status_code=409, detail="No se puede revocar una invitación ya utilizada"
        )
    crud.delete_invitacion(session=session, invitacion_id=invitacion_id)
