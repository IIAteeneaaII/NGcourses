import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select, func

from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate
from app.models.contenido import (
    Curso, CursoCreate, CursoUpdate,
    Modulo, ModuloCreate, ModuloUpdate,
    Leccion, LeccionCreate, LeccionUpdate,
)
from app.models._enums import EstadoCurso


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# ── Cursos ────────────────────────────────────────────────────────────────────

def get_cursos(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    estado: EstadoCurso | None = None,
    instructor_id: uuid.UUID | None = None,
) -> tuple[list[Curso], int]:
    query = select(Curso)
    count_query = select(func.count()).select_from(Curso)
    if estado:
        query = query.where(Curso.estado == estado)
        count_query = count_query.where(Curso.estado == estado)
    if instructor_id:
        query = query.where(Curso.instructor_id == instructor_id)
        count_query = count_query.where(Curso.instructor_id == instructor_id)
    count = session.exec(count_query).one()
    cursos = session.exec(query.offset(skip).limit(limit)).all()
    return list(cursos), count


def get_curso(*, session: Session, curso_id: uuid.UUID) -> Curso | None:
    return session.get(Curso, curso_id)


def create_curso(*, session: Session, curso_in: CursoCreate, instructor_id: uuid.UUID) -> Curso:
    db_curso = Curso.model_validate(curso_in, update={"instructor_id": instructor_id})
    session.add(db_curso)
    session.commit()
    session.refresh(db_curso)
    return db_curso


def update_curso(*, session: Session, db_curso: Curso, curso_in: CursoUpdate) -> Curso:
    data = curso_in.model_dump(exclude_unset=True)
    if "estado" in data and data["estado"] == EstadoCurso.PUBLICADO and db_curso.publicado_en is None:
        data["publicado_en"] = datetime.utcnow()
    data["actualizado_en"] = datetime.utcnow()
    db_curso.sqlmodel_update(data)
    session.add(db_curso)
    session.commit()
    session.refresh(db_curso)
    return db_curso


def delete_curso(*, session: Session, curso_id: uuid.UUID) -> None:
    db_curso = session.get(Curso, curso_id)
    if db_curso:
        session.delete(db_curso)
        session.commit()


# ── Módulos ───────────────────────────────────────────────────────────────────

def get_modulos(*, session: Session, curso_id: uuid.UUID) -> list[Modulo]:
    statement = select(Modulo).where(Modulo.curso_id == curso_id).order_by(Modulo.orden)
    return list(session.exec(statement).all())


def create_modulo(*, session: Session, modulo_in: ModuloCreate, curso_id: uuid.UUID) -> Modulo:
    db_modulo = Modulo.model_validate(modulo_in, update={"curso_id": curso_id})
    session.add(db_modulo)
    session.commit()
    session.refresh(db_modulo)
    return db_modulo


def update_modulo(*, session: Session, db_modulo: Modulo, modulo_in: ModuloUpdate) -> Modulo:
    data = modulo_in.model_dump(exclude_unset=True)
    db_modulo.sqlmodel_update(data)
    session.add(db_modulo)
    session.commit()
    session.refresh(db_modulo)
    return db_modulo


def delete_modulo(*, session: Session, modulo_id: uuid.UUID) -> None:
    db_modulo = session.get(Modulo, modulo_id)
    if db_modulo:
        session.delete(db_modulo)
        session.commit()


# ── Lecciones ─────────────────────────────────────────────────────────────────

def get_lecciones(*, session: Session, modulo_id: uuid.UUID) -> list[Leccion]:
    statement = select(Leccion).where(Leccion.modulo_id == modulo_id).order_by(Leccion.orden)
    return list(session.exec(statement).all())


def create_leccion(*, session: Session, leccion_in: LeccionCreate, modulo_id: uuid.UUID) -> Leccion:
    db_leccion = Leccion.model_validate(leccion_in, update={"modulo_id": modulo_id})
    session.add(db_leccion)
    session.commit()
    session.refresh(db_leccion)
    return db_leccion


def update_leccion(*, session: Session, db_leccion: Leccion, leccion_in: LeccionUpdate) -> Leccion:
    data = leccion_in.model_dump(exclude_unset=True)
    data["actualizado_en"] = datetime.utcnow()
    db_leccion.sqlmodel_update(data)
    session.add(db_leccion)
    session.commit()
    session.refresh(db_leccion)
    return db_leccion


def delete_leccion(*, session: Session, leccion_id: uuid.UUID) -> None:
    db_leccion = session.get(Leccion, leccion_id)
    if db_leccion:
        session.delete(db_leccion)
        session.commit()
