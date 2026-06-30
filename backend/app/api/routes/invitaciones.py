import hashlib
import logging
import secrets  # ← AGREGAR
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import SQLModel

from app import crud
from app.api.deps import AdminOrSuperuser, SessionDep
from app.core.config import settings
from app.core.limiter import limiter
from app.models._enums import EstadoCurso, EstadoInscripcion, RolUsuario
from app.utils import email_formato_valido, generate_activacion_email, send_email

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
    # True cuando la cuenta debe activarse (nueva o pendiente): el front muestra
    # "revisa tu correo" en lugar de "inicia sesión". Nunca se expone contraseña.
    requiere_activacion: bool = False


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
@limiter.limit("10/minute")
def canjear_invitacion(
    *,
    request: Request,
    session: SessionDep,
    body: CanjearRequest,
) -> Any:
    """Endpoint público. Canjea un token de invitación, crea la cuenta si es
    nuevo usuario, y envía email con link para establecer contraseña."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    inv = crud.get_invitacion_by_token_hash(session=session, token_hash=token_hash)

    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no válida")
    if inv.usado_en is not None:
        raise HTTPException(status_code=409, detail="Esta invitación ya fue utilizada")
    if inv.expira_en < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Esta invitación ha expirado")

    # Defensa: el curso debe seguir PUBLICADO al canjear. crear_invitaciones ya
    # impide invitar a no-publicados, pero un curso pudo despublicarse DESPUÉS de
    # enviar la invitación. Se valida antes de crear/activar la cuenta para no
    # dejar cuentas ni inscripciones colgando de un curso no disponible.
    db_curso = crud.get_curso(session=session, curso_id=inv.curso_id)
    if not db_curso or db_curso.estado != EstadoCurso.PUBLICADO:
        raise HTTPException(
            status_code=409,
            detail="Este curso ya no está disponible para inscripción.",
        )
    curso_titulo = db_curso.titulo

    org_info = crud.get_organizacion_of_user(
        session=session, user_id=inv.creado_por
    )
    creador_org_id = org_info[0].id if org_info else None

    # crud retorna un token de activación cuando la cuenta es nueva o sigue
    # pendiente de activar (para reenviar el correo). Nunca se expone contraseña.
    user, usuario_creado, activacion_token = crud.get_or_create_user_by_email(
        session=session, email=inv.email, organizacion_id=creador_org_id,
    )
    requiere_activacion = bool(activacion_token)

    # Las invitaciones a cursos son SOLO para alumnos. Las cuentas nuevas nacen
    # ESTUDIANTE (no se bloquean); esto frena que una cuenta EXISTENTE con otro
    # rol (instructor/supervisor/admin) quede inscrita al canjear y aparezca en
    # las estadísticas de alumnos. Los no-alumnos previsualizan vía ?from=admin.
    if user.rol != RolUsuario.ESTUDIANTE:
        raise HTTPException(
            status_code=403,
            detail="Esta invitación es solo para alumnos. La cuenta de este correo tiene otro rol.",
        )

    # Cuenta nueva o pendiente: enviar email con link a /activar para que el
    # usuario establezca su contraseña. La contraseña NUNCA se envía ni se muestra.
    if activacion_token and settings.emails_enabled:
        email_data = generate_activacion_email(
            email_to=user.email,
            token=activacion_token,
        )
        send_email(
            email_to=user.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )

    # Si ya está inscrito: marcar usado y retornar
    existing = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=user.id, curso_id=inv.curso_id
    )
    if existing:
        # Retorno de un alumno dado de baja: una nueva invitación reactiva su
        # inscripción cancelada. Activa/finalizada se dejan como están.
        if existing.estado == EstadoInscripcion.CANCELADO:
            existing.estado = EstadoInscripcion.ACTIVA
            session.add(existing)
        inv.usado_en = datetime.utcnow()
        session.add(inv)
        session.commit()
        session.refresh(existing)
        return CanjearResponse(
            inscripcion_id=existing.id,
            curso_id=inv.curso_id,
            curso_titulo=curso_titulo,
            email=inv.email,
            usuario_creado=usuario_creado,
            requiere_activacion=requiere_activacion,
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
        requiere_activacion=requiere_activacion,
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

    # Solo se puede invitar a cursos PUBLICADOS. Un curso en borrador/revisión/
    # archivado/rechazado no tiene contenido entregable ni acceso válido para el
    # alumno; invitarlo crearía inscripciones a un curso no disponible.
    if db_curso.estado != EstadoCurso.PUBLICADO:
        raise HTTPException(
            status_code=409,
            detail="Solo puedes enviar invitaciones de cursos publicados.",
        )

    resultados: list[InvitacionEnvioResultado] = []

    for email in body.emails:
        email = email.strip().lower()
        if not email:
            continue

        # CP29: validar formato del correo antes de crear/enviar la invitación.
        if not email_formato_valido(email):
            resultados.append(InvitacionEnvioResultado(
                email=email, estado="invalido",
                detalle="Correo con formato inválido",
            ))
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
                # Bloquea invitar a quien ya tiene el curso (cursando o completado).
                # CANCELADO sí se permite: es el reingreso de un alumno dado de baja.
                if inscripcion_existente and inscripcion_existente.estado in (
                    EstadoInscripcion.ACTIVA, EstadoInscripcion.FINALIZADA
                ):
                    resultados.append(InvitacionEnvioResultado(
                        email=email,
                        estado="ya_inscrito",
                        detalle=(
                            "El alumno ya completó este curso"
                            if inscripcion_existente.estado == EstadoInscripcion.FINALIZADA
                            else "El alumno ya está inscrito en este curso"
                        ),
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
