"""
Endpoints de inscripciones de usuarios a cursos.
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import User
from app.models._enums import EstadoCurso, EstadoInscripcion, MarcaCurso, RolUsuario
from app.models.inscripcion import Certificado, Inscripcion

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class InscripcionCreate(SQLModel):
    curso_id: uuid.UUID


class InscripcionPublic(SQLModel):
    id: uuid.UUID
    usuario_id: uuid.UUID
    curso_id: uuid.UUID
    estado: EstadoInscripcion
    inscrito_en: datetime
    ultimo_acceso_en: datetime | None = None
    # Identidad del alumno (poblada en el listado por curso para instructor/admin).
    usuario_nombre: str | None = None
    usuario_email: str | None = None


class InscripcionesPublic(SQLModel):
    data: list[InscripcionPublic]
    count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=InscripcionPublic, status_code=201)
def inscribirse(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    inscripcion_in: InscripcionCreate,
) -> Any:
    """Inscribe al usuario actual en un curso."""
    # Verificar que el curso existe y está publicado (salvo admins)
    db_curso = crud.get_curso(session=session, curso_id=inscripcion_in.curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin and db_curso.estado != EstadoCurso.PUBLICADO:
        raise HTTPException(status_code=404, detail="Curso no disponible")

    # Verificar que no esté ya inscrito
    existing = crud.get_inscripcion_by_usuario_curso(
        session=session,
        usuario_id=current_user.id,
        curso_id=inscripcion_in.curso_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya estás inscrito en este curso")

    # Bloqueo: cursos NEXTGEN no gratuitos requieren LicenciaCurso activa de la org
    if (
        not is_admin
        and db_curso.marca == MarcaCurso.NEXTGEN
        and not db_curso.es_gratis
    ):
        org_ids = crud.get_org_ids_of_user(
            session=session, user_id=current_user.id
        )
        if db_curso.id not in crud.cursos_con_licencia_activa_orgs(
            session=session, org_ids=org_ids
        ):
            raise HTTPException(
                status_code=403,
                detail="Tu organización no ha adquirido este curso.",
            )

    db_inscripcion = crud.create_inscripcion(
        session=session,
        usuario_id=current_user.id,
        curso_id=inscripcion_in.curso_id,
    )
    return InscripcionPublic.model_validate(db_inscripcion, from_attributes=True)


@router.get("/me", response_model=InscripcionesPublic)
def mis_inscripciones(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Lista las inscripciones del usuario actual (sin las dadas de baja)."""
    items, _ = crud.get_inscripciones_usuario(
        session=session, usuario_id=current_user.id, skip=skip, limit=limit
    )
    # El alumno no debe ver en "mis cursos" los cursos de los que fue dado de baja.
    items = [i for i in items if i.estado != EstadoInscripcion.CANCELADO]
    return InscripcionesPublic(
        data=[InscripcionPublic.model_validate(i, from_attributes=True) for i in items],
        count=len(items),
    )


@router.get("/usuario/{usuario_id}", response_model=InscripcionesPublic)
def inscripciones_por_usuario(
    usuario_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
) -> Any:
    """Lista inscripciones de un alumno específico. Solo admin."""
    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin:
        raise HTTPException(status_code=403, detail="Sin permiso")
    items, count = crud.get_inscripciones_usuario(
        session=session, usuario_id=usuario_id, skip=skip, limit=limit
    )
    return InscripcionesPublic(
        data=[InscripcionPublic.model_validate(i, from_attributes=True) for i in items],
        count=count,
    )


@router.get("/{inscripcion_id}", response_model=InscripcionPublic)
def get_inscripcion(
    inscripcion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Obtiene el detalle de una inscripción."""
    db = crud.get_inscripcion(session=session, inscripcion_id=inscripcion_id)
    if not db:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }
    if not is_admin and db.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta inscripción")

    return InscripcionPublic.model_validate(db, from_attributes=True)


@router.patch("/{inscripcion_id}/cancelar", response_model=InscripcionPublic)
def cancelar_inscripcion(
    inscripcion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Da de baja a un alumno de un curso. Solo admin o instructor propietario."""
    db = crud.get_inscripcion(session=session, inscripcion_id=inscripcion_id)
    if not db:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    if db.estado == EstadoInscripcion.CANCELADO:
        raise HTTPException(status_code=409, detail="La inscripción ya está cancelada")

    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }

    if not is_admin:
        db_curso = crud.get_curso(session=session, curso_id=db.curso_id)
        if not db_curso or current_user.id != db_curso.instructor_id:
            raise HTTPException(status_code=403, detail="Sin permiso")

    updated = crud.cancelar_inscripcion(session=session, inscripcion=db)
    return InscripcionPublic.model_validate(updated, from_attributes=True)


@router.get("/curso/{curso_id}", response_model=InscripcionesPublic)
def inscripciones_por_curso(
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
) -> Any:
    """Lista inscripciones de un curso. Solo el instructor propietario o admin."""
    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }

    db_curso = crud.get_curso(session=session, curso_id=curso_id)
    if not db_curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    if not is_admin and current_user.id != db_curso.instructor_id:
        raise HTTPException(status_code=403, detail="Sin permiso")

    items, count = crud.get_inscripciones_curso(
        session=session, curso_id=curso_id, skip=skip, limit=limit
    )
    # Cargar la identidad de los alumnos en una sola consulta (evita N+1).
    user_ids = [i.usuario_id for i in items]
    user_map: dict[uuid.UUID, User] = {}
    if user_ids:
        user_map = {
            u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids))).all()
        }
    data = []
    for i in items:
        u = user_map.get(i.usuario_id)
        data.append(InscripcionPublic(
            id=i.id, usuario_id=i.usuario_id, curso_id=i.curso_id,
            estado=i.estado, inscrito_en=i.inscrito_en, ultimo_acceso_en=i.ultimo_acceso_en,
            usuario_nombre=u.full_name if u else None,
            usuario_email=u.email if u else None,
        ))
    return InscripcionesPublic(data=data, count=count)
