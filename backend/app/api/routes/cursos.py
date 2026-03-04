import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models._enums import EstadoCurso, RolUsuario
from app.models.contenido import (
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
)
from app.models.schemas import Message

router = APIRouter(prefix="/cursos", tags=["cursos"])


def _require_instructor_or_admin(current_user: CurrentUser) -> None:
    """Raise 403 if user is not instructor or superuser."""
    allowed = {RolUsuario.INSTRUCTOR, RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL}
    if not current_user.is_superuser and current_user.rol not in allowed:
        raise HTTPException(status_code=403, detail="Se requiere rol de instructor o administrador")


def _require_curso_owner_or_admin(current_user: CurrentUser, instructor_id: uuid.UUID) -> None:
    """Raise 403 if user is not the course owner and not superuser."""
    if not current_user.is_superuser and current_user.id != instructor_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para modificar este curso")


# ── Cursos ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=CursosPublic)
def list_cursos(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    estado: EstadoCurso | None = None,
) -> Any:
    """
    Lista cursos. Usuarios normales solo ven PUBLICADOS.
    Instructores ven sus propios cursos en cualquier estado.
    Admins/superusers ven todos.
    """
    is_admin = current_user.is_superuser or current_user.rol in {
        RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL
    }

    if is_admin:
        cursos, count = crud.get_cursos(session=session, skip=skip, limit=limit, estado=estado)
    elif current_user.rol == RolUsuario.INSTRUCTOR:
        cursos, count = crud.get_cursos(
            session=session, skip=skip, limit=limit,
            estado=estado, instructor_id=current_user.id
        )
    else:
        # Estudiantes solo ven publicados
        cursos, count = crud.get_cursos(
            session=session, skip=skip, limit=limit,
            estado=EstadoCurso.PUBLICADO
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

    # Cargar módulos y lecciones
    modulos_db = crud.get_modulos(session=session, curso_id=curso_id)
    modulos = []
    for m in modulos_db:
        lecciones = crud.get_lecciones(session=session, modulo_id=m.id)
        modulo_data = ModuloPublic.model_validate(m, from_attributes=True)
        modulo_data.lecciones = [LeccionPublic.model_validate(l, from_attributes=True) for l in lecciones]
        modulos.append(modulo_data)

    curso_data = CursoDetalle.model_validate(db_curso, from_attributes=True)
    curso_data.modulos = modulos
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
