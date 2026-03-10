import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select, func

from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate
from app.models.contenido import (
    Categoria, CategoriaCreate, CategoriaUpdate,
    CursoEtiqueta,
    Etiqueta, EtiquetaCreate, EtiquetaUpdate,
    Curso, CursoCreate, CursoUpdate,
    Modulo, ModuloCreate, ModuloUpdate,
    Leccion, LeccionCreate, LeccionUpdate,
    RecursoLeccion, RecursoLeccionCreate,
)
from app.models._enums import EstadoCurso, EstadoInscripcion, EstadoCalificacion
from app.models.inscripcion import Certificado, Inscripcion, ProgresoLeccion
from app.models.calificacion import Calificacion, VotoResena


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


# ── Categorías ────────────────────────────────────────────────────────────────

def get_categorias(*, session: Session) -> list[Categoria]:
    return list(session.exec(select(Categoria).order_by(Categoria.orden)).all())


def get_categoria(*, session: Session, categoria_id: uuid.UUID) -> Categoria | None:
    return session.get(Categoria, categoria_id)


def create_categoria(*, session: Session, categoria_in: CategoriaCreate) -> Categoria:
    db_obj = Categoria.model_validate(categoria_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_categoria(
    *, session: Session, db_categoria: Categoria, categoria_in: CategoriaUpdate
) -> Categoria:
    data = categoria_in.model_dump(exclude_unset=True)
    db_categoria.sqlmodel_update(data)
    session.add(db_categoria)
    session.commit()
    session.refresh(db_categoria)
    return db_categoria


def delete_categoria(*, session: Session, categoria_id: uuid.UUID) -> None:
    db = session.get(Categoria, categoria_id)
    if db:
        session.delete(db)
        session.commit()


# ── Etiquetas ─────────────────────────────────────────────────────────────────

def get_etiquetas(*, session: Session) -> list[Etiqueta]:
    return list(session.exec(select(Etiqueta).order_by(Etiqueta.nombre)).all())


def get_etiqueta(*, session: Session, etiqueta_id: uuid.UUID) -> Etiqueta | None:
    return session.get(Etiqueta, etiqueta_id)


def create_etiqueta(*, session: Session, etiqueta_in: EtiquetaCreate) -> Etiqueta:
    db_obj = Etiqueta.model_validate(etiqueta_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_etiqueta(
    *, session: Session, db_etiqueta: Etiqueta, etiqueta_in: EtiquetaUpdate
) -> Etiqueta:
    data = etiqueta_in.model_dump(exclude_unset=True)
    db_etiqueta.sqlmodel_update(data)
    session.add(db_etiqueta)
    session.commit()
    session.refresh(db_etiqueta)
    return db_etiqueta


def delete_etiqueta(*, session: Session, etiqueta_id: uuid.UUID) -> None:
    db = session.get(Etiqueta, etiqueta_id)
    if db:
        session.delete(db)
        session.commit()


def assign_etiqueta_curso(
    *, session: Session, curso_id: uuid.UUID, etiqueta_id: uuid.UUID
) -> None:
    existing = session.exec(
        select(CursoEtiqueta).where(
            CursoEtiqueta.curso_id == curso_id,
            CursoEtiqueta.etiqueta_id == etiqueta_id,
        )
    ).first()
    if not existing:
        db_obj = CursoEtiqueta(curso_id=curso_id, etiqueta_id=etiqueta_id)
        session.add(db_obj)
        session.commit()


def remove_etiqueta_curso(
    *, session: Session, curso_id: uuid.UUID, etiqueta_id: uuid.UUID
) -> None:
    db_obj = session.exec(
        select(CursoEtiqueta).where(
            CursoEtiqueta.curso_id == curso_id,
            CursoEtiqueta.etiqueta_id == etiqueta_id,
        )
    ).first()
    if db_obj:
        session.delete(db_obj)
        session.commit()


# ── Cursos ────────────────────────────────────────────────────────────────────

def get_cursos(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    estado: EstadoCurso | None = None,
    instructor_id: uuid.UUID | None = None,
    categoria_id: uuid.UUID | None = None,
    search: str | None = None,
) -> tuple[list[Curso], int]:
    query = select(Curso)
    count_query = select(func.count()).select_from(Curso)

    filters = []
    if estado:
        filters.append(Curso.estado == estado)
    if instructor_id:
        filters.append(Curso.instructor_id == instructor_id)
    if categoria_id:
        filters.append(Curso.categoria_id == categoria_id)
    if search:
        filters.append(Curso.titulo.ilike(f"%{search}%"))

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

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


# ── Recursos de Lección ───────────────────────────────────────────────────────

def get_recursos_leccion(*, session: Session, leccion_id: uuid.UUID) -> list[RecursoLeccion]:
    statement = select(RecursoLeccion).where(RecursoLeccion.leccion_id == leccion_id)
    return list(session.exec(statement).all())


def create_recurso_leccion(
    *, session: Session, recurso_in: RecursoLeccionCreate, leccion_id: uuid.UUID
) -> RecursoLeccion:
    db_obj = RecursoLeccion.model_validate(recurso_in, update={"leccion_id": leccion_id})
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_recurso_leccion(*, session: Session, recurso_id: uuid.UUID) -> None:
    db = session.get(RecursoLeccion, recurso_id)
    if db:
        session.delete(db)
        session.commit()


# ── Inscripciones ─────────────────────────────────────────────────────────────

def get_inscripcion(*, session: Session, inscripcion_id: uuid.UUID) -> Inscripcion | None:
    return session.get(Inscripcion, inscripcion_id)


def get_inscripcion_by_usuario_curso(
    *, session: Session, usuario_id: uuid.UUID, curso_id: uuid.UUID
) -> Inscripcion | None:
    statement = select(Inscripcion).where(
        Inscripcion.usuario_id == usuario_id,
        Inscripcion.curso_id == curso_id,
    )
    return session.exec(statement).first()


def get_inscripciones_usuario(
    *, session: Session, usuario_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> tuple[list[Inscripcion], int]:
    q = select(Inscripcion).where(Inscripcion.usuario_id == usuario_id)
    count = session.exec(select(func.count()).select_from(Inscripcion).where(Inscripcion.usuario_id == usuario_id)).one()
    items = session.exec(q.offset(skip).limit(limit)).all()
    return list(items), count


def create_inscripcion(
    *, session: Session, usuario_id: uuid.UUID, curso_id: uuid.UUID
) -> Inscripcion:
    db_obj = Inscripcion(usuario_id=usuario_id, curso_id=curso_id)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_inscripciones_curso(
    *, session: Session, curso_id: uuid.UUID, skip: int = 0, limit: int = 200
) -> tuple[list[Inscripcion], int]:
    q = select(Inscripcion).where(Inscripcion.curso_id == curso_id)
    count = session.exec(
        select(func.count()).select_from(Inscripcion).where(Inscripcion.curso_id == curso_id)
    ).one()
    items = session.exec(q.offset(skip).limit(limit)).all()
    return list(items), count


def update_ultimo_acceso(*, session: Session, inscripcion: Inscripcion) -> None:
    inscripcion.ultimo_acceso_en = datetime.utcnow()
    session.add(inscripcion)
    session.commit()


# ── Progreso ──────────────────────────────────────────────────────────────────

def get_progreso(
    *, session: Session, inscripcion_id: uuid.UUID, leccion_id: uuid.UUID
) -> ProgresoLeccion | None:
    statement = select(ProgresoLeccion).where(
        ProgresoLeccion.inscripcion_id == inscripcion_id,
        ProgresoLeccion.leccion_id == leccion_id,
    )
    return session.exec(statement).first()


def get_progreso_curso(
    *, session: Session, inscripcion_id: uuid.UUID
) -> list[ProgresoLeccion]:
    statement = select(ProgresoLeccion).where(
        ProgresoLeccion.inscripcion_id == inscripcion_id
    )
    return list(session.exec(statement).all())


def upsert_progreso(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
    visto_seg: int,
    progreso_pct: int,
    umbral_completado_pct: int = 90,
) -> ProgresoLeccion:
    db_prog = get_progreso(session=session, inscripcion_id=inscripcion_id, leccion_id=leccion_id)
    now = datetime.utcnow()

    if db_prog is None:
        db_prog = ProgresoLeccion(
            inscripcion_id=inscripcion_id,
            leccion_id=leccion_id,
            visto_seg=visto_seg,
            progreso_pct=progreso_pct,
            actualizado_en=now,
        )
    else:
        db_prog.visto_seg = max(db_prog.visto_seg, visto_seg)
        db_prog.progreso_pct = max(db_prog.progreso_pct, progreso_pct)
        db_prog.actualizado_en = now

    # Marcar como completado si supera el umbral
    if not db_prog.completado and db_prog.progreso_pct >= umbral_completado_pct:
        db_prog.completado = True
        db_prog.completado_en = now

    session.add(db_prog)
    session.commit()
    session.refresh(db_prog)
    return db_prog


def check_and_emit_certificate(
    *, session: Session, inscripcion_id: uuid.UUID
) -> Certificado | None:
    """
    Verifica si todas las lecciones del curso están completadas.
    Si es así y no hay certificado aún, lo genera automáticamente.
    """
    inscripcion = session.get(Inscripcion, inscripcion_id)
    if not inscripcion:
        return None

    # Obtener todas las lecciones del curso
    statement = (
        select(Leccion)
        .join(Modulo, Leccion.modulo_id == Modulo.id)
        .where(Modulo.curso_id == inscripcion.curso_id)
    )
    todas_lecciones = list(session.exec(statement).all())
    if not todas_lecciones:
        return None

    # Verificar progreso completado en todas
    completadas = get_progreso_curso(session=session, inscripcion_id=inscripcion_id)
    completadas_ids = {p.leccion_id for p in completadas if p.completado}
    total_ids = {l.id for l in todas_lecciones}

    if not total_ids.issubset(completadas_ids):
        return None

    # Ya existe certificado?
    existing = session.exec(
        select(Certificado).where(Certificado.inscripcion_id == inscripcion_id)
    ).first()
    if existing:
        return existing

    # Generar folio único
    folio = f"NG-{secrets.token_hex(6).upper()}"
    hash_ver = hashlib.sha256(f"{inscripcion_id}{folio}".encode()).hexdigest()

    certificado = Certificado(
        inscripcion_id=inscripcion_id,
        usuario_id=inscripcion.usuario_id,
        curso_id=inscripcion.curso_id,
        folio=folio,
        hash_verificacion=hash_ver,
    )
    session.add(certificado)

    # Actualizar inscripción a FINALIZADA
    inscripcion.estado = EstadoInscripcion.FINALIZADA
    session.add(inscripcion)

    session.commit()
    session.refresh(certificado)
    return certificado


# ── Calificaciones ────────────────────────────────────────────────────────────

def get_calificacion(
    *, session: Session, calificacion_id: uuid.UUID
) -> Calificacion | None:
    return session.get(Calificacion, calificacion_id)


def get_calificacion_by_usuario_curso(
    *, session: Session, usuario_id: uuid.UUID, curso_id: uuid.UUID
) -> Calificacion | None:
    statement = select(Calificacion).where(
        Calificacion.usuario_id == usuario_id,
        Calificacion.curso_id == curso_id,
    )
    return session.exec(statement).first()


def get_calificaciones_curso(
    *, session: Session, curso_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> tuple[list[Calificacion], int]:
    q = select(Calificacion).where(
        Calificacion.curso_id == curso_id,
        Calificacion.estado == EstadoCalificacion.PUBLICA,
    )
    count = session.exec(
        select(func.count()).select_from(Calificacion).where(
            Calificacion.curso_id == curso_id,
            Calificacion.estado == EstadoCalificacion.PUBLICA,
        )
    ).one()
    items = session.exec(q.offset(skip).limit(limit)).all()
    return list(items), count


def create_calificacion(
    *,
    session: Session,
    usuario_id: uuid.UUID,
    curso_id: uuid.UUID,
    estrellas: int,
    titulo: str | None = None,
    comentario: str | None = None,
) -> Calificacion:
    db_obj = Calificacion(
        usuario_id=usuario_id,
        curso_id=curso_id,
        estrellas=estrellas,
        titulo=titulo,
        comentario=comentario,
        estado=EstadoCalificacion.PENDIENTE,
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_calificacion(
    *,
    session: Session,
    db_cal: Calificacion,
    estrellas: int | None = None,
    titulo: str | None = None,
    comentario: str | None = None,
) -> Calificacion:
    if estrellas is not None:
        db_cal.estrellas = estrellas
    if titulo is not None:
        db_cal.titulo = titulo
    if comentario is not None:
        db_cal.comentario = comentario
    db_cal.actualizado_en = datetime.utcnow()
    session.add(db_cal)
    session.commit()
    session.refresh(db_cal)
    return db_cal


def upsert_voto_resena(
    *, session: Session, calificacion_id: uuid.UUID, usuario_id: uuid.UUID, voto: int
) -> VotoResena:
    statement = select(VotoResena).where(
        VotoResena.calificacion_id == calificacion_id,
        VotoResena.usuario_id == usuario_id,
    )
    db_voto = session.exec(statement).first()
    if db_voto:
        db_voto.voto = voto
    else:
        db_voto = VotoResena(
            calificacion_id=calificacion_id,
            usuario_id=usuario_id,
            voto=voto,
        )
    session.add(db_voto)
    session.commit()
    session.refresh(db_voto)
    return db_voto
