import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel

from app import crud
from app.api.deps import AdminOrSuperuser, SessionDep
from app.core.security import get_password_hash
from app.models import User, UserCreate
from app.models._enums import RolOrganizacion, RolUsuario

router = APIRouter(prefix="/organizaciones", tags=["organizaciones"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class OrganizacionCreate(SQLModel):
    nombre: str
    email_contacto: str | None = None
    telefono_contacto: str | None = None
    plan_de_cursos: str | None = None
    fecha_compra: datetime | None = None
    rfc: str | None = None
    dominio_corporativo: str | None = None


class OrganizacionUpdate(SQLModel):
    nombre: str | None = None
    email_contacto: str | None = None
    telefono_contacto: str | None = None
    plan_de_cursos: str | None = None
    fecha_compra: datetime | None = None
    rfc: str | None = None
    dominio_corporativo: str | None = None


class OrganizacionPublic(SQLModel):
    id: uuid.UUID
    nombre: str
    email_contacto: str | None = None
    telefono_contacto: str | None = None
    plan_de_cursos: str | None = None
    fecha_compra: datetime | None = None
    rfc: str | None = None
    dominio_corporativo: str | None = None
    estado: str
    creado_en: datetime


class OrganizacionesPublic(SQLModel):
    data: list[OrganizacionPublic]
    count: int


class MiembroPublic(SQLModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None
    rol: str
    rol_org: str


class AsignarMiembro(SQLModel):
    user_id: uuid.UUID
    rol_org: RolOrganizacion = RolOrganizacion.MIEMBRO


class CrearSupervisor(SQLModel):
    email: str
    full_name: str
    password: str
    telefono: str | None = None


class AsignarLicencia(SQLModel):
    curso_id: uuid.UUID


class LicenciaPublic(SQLModel):
    id: uuid.UUID
    curso_id: uuid.UUID
    curso_titulo: str
    estado: str
    creado_en: datetime


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/", response_model=OrganizacionesPublic)
def list_organizaciones(
    session: SessionDep,
    current_user: AdminOrSuperuser,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
) -> Any:
    items, count = crud.list_organizaciones(
        session=session, skip=skip, limit=limit, search=search
    )
    return OrganizacionesPublic(data=[_to_public(o) for o in items], count=count)


@router.post("/", response_model=OrganizacionPublic, status_code=201)
def create_organizacion(
    *, session: SessionDep, current_user: AdminOrSuperuser, body: OrganizacionCreate,
) -> Any:
    org = crud.create_organizacion(
        session=session,
        nombre=body.nombre,
        email_contacto=body.email_contacto,
        telefono_contacto=body.telefono_contacto,
        plan_de_cursos=body.plan_de_cursos,
        fecha_compra=body.fecha_compra,
        rfc=body.rfc,
        dominio_corporativo=body.dominio_corporativo,
    )
    return _to_public(org)


@router.get("/{org_id}", response_model=OrganizacionPublic)
def get_organizacion(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
) -> Any:
    org = crud.get_organizacion(session=session, org_id=org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return _to_public(org)


@router.patch("/{org_id}", response_model=OrganizacionPublic)
def update_organizacion(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
    body: OrganizacionUpdate,
) -> Any:
    org = crud.get_organizacion(session=session, org_id=org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    org = crud.update_organizacion(
        session=session, org=org, data=body.model_dump(exclude_unset=True)
    )
    return _to_public(org)


@router.delete("/{org_id}", status_code=204)
def delete_organizacion(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
) -> None:
    crud.delete_organizacion(session=session, org_id=org_id)


# ── Miembros ─────────────────────────────────────────────────────────────────


@router.get("/{org_id}/miembros", response_model=list[MiembroPublic])
def list_miembros(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
) -> Any:
    rows = crud.list_org_users(session=session, org_id=org_id)
    return [
        MiembroPublic(
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            rol=u.rol.value if hasattr(u.rol, "value") else str(u.rol),
            rol_org=r.value if hasattr(r, "value") else str(r),
        )
        for (u, r) in rows
    ]


@router.post("/{org_id}/miembros", response_model=MiembroPublic, status_code=201)
def asignar_miembro(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
    body: AsignarMiembro,
) -> Any:
    org = crud.get_organizacion(session=session, org_id=org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    user = session.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    crud.add_user_to_organizacion(
        session=session, org_id=org_id, user_id=body.user_id, rol_org=body.rol_org
    )
    return MiembroPublic(
        user_id=user.id, email=user.email, full_name=user.full_name,
        rol=user.rol.value if hasattr(user.rol, "value") else str(user.rol),
        rol_org=body.rol_org.value,
    )


@router.delete("/{org_id}/miembros/{user_id}", status_code=204)
def quitar_miembro(
    *, org_id: uuid.UUID, user_id: uuid.UUID, session: SessionDep,
    current_user: AdminOrSuperuser,
) -> None:
    crud.remove_user_from_organizacion(session=session, org_id=org_id, user_id=user_id)


@router.post("/{org_id}/supervisor", response_model=MiembroPublic, status_code=201)
def crear_supervisor(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
    body: CrearSupervisor,
) -> Any:
    """Crea un usuario con rol SUPERVISOR vinculado a la organización como ADMIN_ORG."""
    org = crud.get_organizacion(session=session, org_id=org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    existing = crud.get_user_by_email(session=session, email=body.email)
    if existing:
        # Promover usuario existente a supervisor y asignarlo a la org
        existing.rol = RolUsuario.SUPERVISOR
        existing.hashed_password = get_password_hash(body.password)
        if body.full_name:
            existing.full_name = body.full_name
        if body.telefono:
            existing.telefono = body.telefono
        session.add(existing)
        session.commit()
        session.refresh(existing)
        user = existing
    else:
        user_in = UserCreate(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            rol=RolUsuario.SUPERVISOR,
            telefono=body.telefono,
        )
        user = crud.create_user(session=session, user_create=user_in)

    crud.add_user_to_organizacion(
        session=session, org_id=org_id, user_id=user.id,
        rol_org=RolOrganizacion.ADMIN_ORG,
    )
    return MiembroPublic(
        user_id=user.id, email=user.email, full_name=user.full_name,
        rol=user.rol.value if hasattr(user.rol, "value") else str(user.rol),
        rol_org=RolOrganizacion.ADMIN_ORG.value,
    )


# ── Licencias ────────────────────────────────────────────────────────────────


@router.get("/{org_id}/licencias", response_model=list[LicenciaPublic])
def list_licencias(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
) -> Any:
    licencias = crud.list_licencias_by_org(session=session, org_id=org_id)
    result: list[LicenciaPublic] = []
    for lic in licencias:
        curso = crud.get_curso(session=session, curso_id=lic.curso_id)
        result.append(LicenciaPublic(
            id=lic.id, curso_id=lic.curso_id,
            curso_titulo=curso.titulo if curso else "",
            estado=lic.estado.value if hasattr(lic.estado, "value") else str(lic.estado),
            creado_en=lic.creado_en,
        ))
    return result


@router.post("/{org_id}/licencias", response_model=LicenciaPublic, status_code=201)
def asignar_licencia(
    *, org_id: uuid.UUID, session: SessionDep, current_user: AdminOrSuperuser,
    body: AsignarLicencia,
) -> Any:
    org = crud.get_organizacion(session=session, org_id=org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    curso = crud.get_curso(session=session, curso_id=body.curso_id)
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    lic = crud.assign_licencia(session=session, org_id=org_id, curso_id=body.curso_id)
    return LicenciaPublic(
        id=lic.id, curso_id=lic.curso_id, curso_titulo=curso.titulo,
        estado=lic.estado.value if hasattr(lic.estado, "value") else str(lic.estado),
        creado_en=lic.creado_en,
    )


@router.delete("/{org_id}/licencias/{curso_id}", status_code=204)
def quitar_licencia(
    *, org_id: uuid.UUID, curso_id: uuid.UUID, session: SessionDep,
    current_user: AdminOrSuperuser,
) -> None:
    crud.unassign_licencia(session=session, org_id=org_id, curso_id=curso_id)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _to_public(o: Any) -> OrganizacionPublic:
    return OrganizacionPublic(
        id=o.id,
        nombre=o.nombre,
        email_contacto=o.email_contacto,
        telefono_contacto=o.telefono_contacto,
        plan_de_cursos=o.plan_de_cursos,
        fecha_compra=o.fecha_compra,
        rfc=o.rfc,
        dominio_corporativo=o.dominio_corporativo,
        estado=o.estado.value if hasattr(o.estado, "value") else str(o.estado),
        creado_en=o.creado_en,
    )
