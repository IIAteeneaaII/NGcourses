import hashlib
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app import crud
from app.api.deps import SessionDep, SupervisorOrAbove
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import User, UserCreate
from app.models._enums import EstadoInscripcion, EstadoLicencia, RolOrganizacion, RolUsuario
from app.models.inscripcion import Inscripcion, ProgresoLeccion
from app.models.organizacion import LicenciaCurso, SolicitudCurso, UsuarioOrganizacion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/supervisor", tags=["supervisor"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class MiOrganizacionPublic(SQLModel):
    id: uuid.UUID
    nombre: str
    email_contacto: str | None = None
    telefono_contacto: str | None = None
    plan_de_cursos: str | None = None
    fecha_compra: datetime | None = None
    estado: str


class UsuarioOrgPublic(SQLModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    telefono: str | None
    is_active: bool
    rol_org: str
    progreso_promedio: float
    cursos_inscritos: int


class CrearUsuarioBody(SQLModel):
    email: str
    password: str
    full_name: str | None = None
    telefono: str | None = None


class CursoOrgPublic(SQLModel):
    id: uuid.UUID
    titulo: str
    descripcion: str | None
    portada_url: str | None
    marca: str


class InvitarBody(SQLModel):
    curso_id: uuid.UUID
    emails: list[str]


class InvitacionEnvioResultado(SQLModel):
    email: str
    estado: str
    detalle: str | None = None


class InvitacionSupervisorPublic(SQLModel):
    id: uuid.UUID
    curso_id: uuid.UUID
    curso_titulo: str
    email: str
    expira_en: datetime
    usado_en: datetime | None
    creado_en: datetime
    estado: str


class StatsPublic(SQLModel):
    usuarios_totales: int
    usuarios_activos: int
    progreso_promedio: float
    cursos_disponibles: int
    inscripciones_totales: int


class SolicitudCreate(SQLModel):
    titulo_solicitud: str
    descripcion: str | None = None


class SolicitudPublic(SQLModel):
    id: uuid.UUID
    titulo_solicitud: str
    descripcion: str | None
    estado: str
    creado_en: datetime


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_user_org(session, user_id: uuid.UUID):
    info = crud.get_organizacion_of_user(session=session, user_id=user_id)
    if not info:
        raise HTTPException(
            status_code=404,
            detail="No perteneces a ninguna organización",
        )
    return info  # (org, rol_org)


def _estado_invitacion(inv: Any) -> str:
    if inv.usado_en is not None:
        return "usada"
    if inv.expira_en < datetime.utcnow():
        return "expirada"
    return "pendiente"


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/mi-organizacion", response_model=MiOrganizacionPublic)
def mi_organizacion(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    return MiOrganizacionPublic(
        id=org.id,
        nombre=org.nombre,
        email_contacto=org.email_contacto,
        telefono_contacto=org.telefono_contacto,
        plan_de_cursos=org.plan_de_cursos,
        fecha_compra=org.fecha_compra,
        estado=org.estado.value if hasattr(org.estado, "value") else str(org.estado),
    )


@router.get("/cursos", response_model=list[CursoOrgPublic])
def cursos_de_mi_org(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    licencias = crud.list_licencias_by_org(session=session, org_id=org.id)
    result: list[CursoOrgPublic] = []
    for lic in licencias:
        if lic.estado != EstadoLicencia.ACTIVA:
            continue
        curso = crud.get_curso(session=session, curso_id=lic.curso_id)
        if not curso:
            continue
        result.append(CursoOrgPublic(
            id=curso.id, titulo=curso.titulo,
            descripcion=curso.descripcion, portada_url=curso.portada_url,
            marca=curso.marca.value if hasattr(curso.marca, "value") else str(curso.marca),
        ))
    return result


@router.get("/usuarios", response_model=list[UsuarioOrgPublic])
def usuarios_de_mi_org(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    rows = crud.list_org_users(session=session, org_id=org.id)
    result: list[UsuarioOrgPublic] = []
    for (u, r) in rows:
        # Progreso promedio del usuario
        progresos = list(session.exec(
            select(ProgresoLeccion.progreso_pct).where(
                ProgresoLeccion.usuario_id == u.id
            )
        ).all())
        prom = round(float(sum(progresos) / len(progresos)), 2) if progresos else 0.0
        inscripciones = list(session.exec(
            select(Inscripcion).where(
                Inscripcion.usuario_id == u.id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA,
            )
        ).all())
        result.append(UsuarioOrgPublic(
            id=u.id, email=u.email, full_name=u.full_name, telefono=u.telefono,
            is_active=u.is_active,
            rol_org=r.value if hasattr(r, "value") else str(r),
            progreso_promedio=prom, cursos_inscritos=len(inscripciones),
        ))
    return result


@router.post("/usuarios", response_model=UsuarioOrgPublic, status_code=201)
def crear_usuario(
    *, session: SessionDep, current_user: SupervisorOrAbove, body: CrearUsuarioBody,
) -> Any:
    """Alta directa de un usuario miembro de la organización del supervisor."""
    org, _rol = _get_user_org(session, current_user.id)

    existing = crud.get_user_by_email(session=session, email=body.email)
    if existing:
        # Si existe y no es de esta org, lo agregamos. Si ya pertenece a otra, error.
        actual = crud.get_organizacion_of_user(session=session, user_id=existing.id)
        if actual and actual[0].id != org.id:
            raise HTTPException(
                status_code=409,
                detail="El usuario ya pertenece a otra organización",
            )
        user = existing
    else:
        user_in = UserCreate(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            rol=RolUsuario.ESTUDIANTE,
            telefono=body.telefono,
        )
        user = crud.create_user(session=session, user_create=user_in)

    crud.add_user_to_organizacion(
        session=session, org_id=org.id, user_id=user.id,
        rol_org=RolOrganizacion.MIEMBRO,
    )
    return UsuarioOrgPublic(
        id=user.id, email=user.email, full_name=user.full_name, telefono=user.telefono,
        is_active=user.is_active, rol_org=RolOrganizacion.MIEMBRO.value,
        progreso_promedio=0.0, cursos_inscritos=0,
    )


@router.delete("/usuarios/{user_id}", status_code=204)
def quitar_usuario(
    *, user_id: uuid.UUID, session: SessionDep, current_user: SupervisorOrAbove,
) -> None:
    org, _rol = _get_user_org(session, current_user.id)
    crud.remove_user_from_organizacion(
        session=session, org_id=org.id, user_id=user_id
    )


@router.post("/invitaciones", response_model=list[InvitacionEnvioResultado], status_code=201)
def invitar(
    *, session: SessionDep, current_user: SupervisorOrAbove, body: InvitarBody,
) -> Any:
    """Envía invitaciones a un curso de la organización. El usuario que canjee
    quedará automáticamente vinculado a la organización del supervisor."""
    org, _rol = _get_user_org(session, current_user.id)

    # Validar que el curso pertenezca a la org (vía licencia) o sea NEXTGEN.
    curso = crud.get_curso(session=session, curso_id=body.curso_id)
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    licencia = session.exec(
        select(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org.id,
            LicenciaCurso.curso_id == body.curso_id,
            LicenciaCurso.estado == EstadoLicencia.ACTIVA,
        )
    ).first()
    if not licencia and str(getattr(curso.marca, "value", curso.marca)) != "nextgen":
        raise HTTPException(
            status_code=403,
            detail="Tu organización no tiene licencia activa para este curso",
        )

    resultados: list[InvitacionEnvioResultado] = []
    for email in body.emails:
        email = email.strip().lower()
        if not email:
            continue
        try:
            existing_user = crud.get_user_by_email(session=session, email=email)
            if existing_user:
                insc = crud.get_inscripcion_by_usuario_curso(
                    session=session, usuario_id=existing_user.id, curso_id=body.curso_id,
                )
                if insc and insc.estado == EstadoInscripcion.ACTIVA:
                    resultados.append(InvitacionEnvioResultado(
                        email=email, estado="ya_inscrito",
                        detalle="El usuario ya está inscrito en este curso",
                    ))
                    continue

            db_inv, raw_token = crud.create_invitacion(
                session=session, curso_id=body.curso_id, email=email,
                creado_por_id=current_user.id,
            )

            if settings.emails_enabled:
                from app.utils import generate_invitation_email, send_email
                email_data = generate_invitation_email(
                    email_to=email, curso_titulo=curso.titulo,
                    token=raw_token, password_temporal=None,
                )
                send_email(
                    email_to=email, subject=email_data.subject,
                    html_content=email_data.html_content,
                )

            resultados.append(InvitacionEnvioResultado(email=email, estado="enviada"))
        except Exception as exc:
            logger.error("Error al invitar %s: %s", email, exc)
            resultados.append(InvitacionEnvioResultado(
                email=email, estado="error", detalle=str(exc)
            ))
    return resultados


@router.get("/invitaciones", response_model=list[InvitacionSupervisorPublic])
def listar_invitaciones(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    """Lista invitaciones enviadas por este supervisor."""
    org, _rol = _get_user_org(session, current_user.id)
    from app.models.invitacion import InvitacionCurso
    invs = list(session.exec(
        select(InvitacionCurso).where(
            InvitacionCurso.creado_por == current_user.id
        ).order_by(InvitacionCurso.creado_en.desc())  # type: ignore[arg-type]
    ).all())
    result: list[InvitacionSupervisorPublic] = []
    for inv in invs:
        curso = crud.get_curso(session=session, curso_id=inv.curso_id)
        result.append(InvitacionSupervisorPublic(
            id=inv.id, curso_id=inv.curso_id,
            curso_titulo=curso.titulo if curso else "",
            email=inv.email, expira_en=inv.expira_en, usado_en=inv.usado_en,
            creado_en=inv.creado_en, estado=_estado_invitacion(inv),
        ))
    return result


@router.get("/stats", response_model=StatsPublic)
def stats(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    data = crud.get_org_stats(session=session, org_id=org.id)
    return StatsPublic(**data)


@router.post("/solicitudes", response_model=SolicitudPublic, status_code=201)
def crear_solicitud(
    *, session: SessionDep, current_user: SupervisorOrAbove, body: SolicitudCreate,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    s = crud.create_solicitud_curso(
        session=session, org_id=org.id, solicitante_id=current_user.id,
        titulo=body.titulo_solicitud, descripcion=body.descripcion,
    )
    return SolicitudPublic(
        id=s.id, titulo_solicitud=s.titulo_solicitud, descripcion=s.descripcion,
        estado=s.estado.value if hasattr(s.estado, "value") else str(s.estado),
        creado_en=s.creado_en,
    )


@router.get("/solicitudes", response_model=list[SolicitudPublic])
def listar_solicitudes(
    *, session: SessionDep, current_user: SupervisorOrAbove,
) -> Any:
    org, _rol = _get_user_org(session, current_user.id)
    items = crud.list_solicitudes_by_org(session=session, org_id=org.id)
    return [
        SolicitudPublic(
            id=s.id, titulo_solicitud=s.titulo_solicitud, descripcion=s.descripcion,
            estado=s.estado.value if hasattr(s.estado, "value") else str(s.estado),
            creado_en=s.creado_en,
        ) for s in items
    ]
