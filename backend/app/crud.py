import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

# ISO 25010 §6.5 Mantenibilidad: constantes nombradas en lugar de magic numbers
UMBRAL_COMPLETADO_PCT: int = 90  # Porcentaje mínimo para marcar una lección como completada
FOLIO_TOKEN_BYTES: int = 6      # Bytes para generar el folio del certificado (12 chars hex)
INVITACION_EXPIRACION_DIAS: int = 7  # Días de validez de un enlace de invitación

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
from app.models._enums import EstadoCurso, EstadoInscripcion, EstadoCalificacion, RolUsuario
from app.models.inscripcion import Certificado, Inscripcion, ProgresoLeccion
from app.models.calificacion import Calificacion, VotoResena
from app.models.quiz import QuizIntento, QuizRespuesta
from app.models.invitacion import InvitacionCurso


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
    import re
    slug = categoria_in.slug or re.sub(r"[^a-z0-9]+", "-", categoria_in.nombre.lower()).strip("-")
    db_obj = Categoria.model_validate(categoria_in, update={"slug": slug})
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


_METADATA_FIELDS = ("nivel", "lo_que_aprenderas", "requisitos")


def create_curso(*, session: Session, curso_in: CursoCreate, instructor_id: uuid.UUID) -> Curso:
    data = curso_in.model_dump(exclude_unset=True)
    meta: dict = {}
    for key in _METADATA_FIELDS:
        val = data.pop(key, None)
        if val is not None and val != [] and val != "":
            meta[key] = val
    update_extra: dict = {"instructor_id": instructor_id}
    if meta:
        update_extra["metadata_"] = meta
    db_curso = Curso.model_validate(data, update=update_extra)
    session.add(db_curso)
    session.commit()
    session.refresh(db_curso)
    return db_curso


def update_curso(*, session: Session, db_curso: Curso, curso_in: CursoUpdate) -> Curso:
    data = curso_in.model_dump(exclude_unset=True)
    if "estado" in data and data["estado"] == EstadoCurso.PUBLICADO and db_curso.publicado_en is None:
        data["publicado_en"] = datetime.utcnow()
    data["actualizado_en"] = datetime.utcnow()
    meta_update: dict = {k: data.pop(k) for k in _METADATA_FIELDS if k in data}
    if meta_update:
        current_meta = dict(db_curso.metadata_ or {})
        current_meta.update(meta_update)
        data["metadata_"] = current_meta
    db_curso.sqlmodel_update(data)
    session.add(db_curso)
    session.commit()
    session.refresh(db_curso)
    return db_curso


def delete_curso(*, session: Session, curso_id: uuid.UUID) -> None:
    db_curso = session.get(Curso, curso_id)
    if not db_curso:
        return

    # 1. Eliminar progreso de lecciones vinculado a inscripciones del curso
    inscripciones = session.exec(
        select(Inscripcion).where(Inscripcion.curso_id == curso_id)
    ).all()
    for insc in inscripciones:
        progresos = session.exec(
            select(ProgresoLeccion).where(ProgresoLeccion.inscripcion_id == insc.id)
        ).all()
        for p in progresos:
            session.delete(p)
        # Certificado vinculado a la inscripción
        cert = session.exec(
            select(Certificado).where(Certificado.inscripcion_id == insc.id)
        ).first()
        if cert:
            session.delete(cert)
        session.delete(insc)

    # 2. Eliminar calificaciones y votos del curso
    calificaciones = session.exec(
        select(Calificacion).where(Calificacion.curso_id == curso_id)
    ).all()
    for cal in calificaciones:
        votos = session.exec(
            select(VotoResena).where(VotoResena.calificacion_id == cal.id)
        ).all()
        for v in votos:
            session.delete(v)
        session.delete(cal)

    session.flush()

    # 3. Eliminar el curso (cascade a módulos → lecciones → recursos vía SQLAlchemy)
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


def get_lecciones_for_modulos(
    *, session: Session, modulo_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[Leccion]]:
    """ISO 25010 §6.4 Fiabilidad: carga todas las lecciones en una sola query (evita N+1)."""
    if not modulo_ids:
        return {}
    statement = (
        select(Leccion)
        .where(Leccion.modulo_id.in_(modulo_ids))  # type: ignore[arg-type]
        .order_by(Leccion.orden)
    )
    result: dict[uuid.UUID, list[Leccion]] = {}
    for leccion in session.exec(statement).all():
        result.setdefault(leccion.modulo_id, []).append(leccion)
    return result


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


def cancelar_inscripcion(*, session: Session, inscripcion: Inscripcion) -> Inscripcion:
    """Cambia el estado de una inscripción a CANCELADO."""
    from app.models._enums import EstadoInscripcion
    inscripcion.estado = EstadoInscripcion.CANCELADO
    session.add(inscripcion)
    session.commit()
    session.refresh(inscripcion)
    return inscripcion


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
    umbral_completado_pct: int = UMBRAL_COMPLETADO_PCT,
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
    folio = f"NG-{secrets.token_hex(FOLIO_TOKEN_BYTES).upper()}"
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

    # Generar PDF del certificado (no-fatal: el registro ya está guardado)
    try:
        from pathlib import Path
        from app.models._enums import MarcaCurso
        from app.models import User
        from app.services.certificado_pdf import generate_certificate_pdf

        usuario = session.get(User, inscripcion.usuario_id)
        curso = session.get(Curso, inscripcion.curso_id)
        instructor = session.get(User, curso.instructor_id) if curso else None

        student_name = (usuario.full_name or usuario.email) if usuario else "Alumno"
        course_title = curso.titulo if curso else ""
        instructor_name = (instructor.full_name or instructor.email) if instructor else "Instructor"
        marca = curso.marca if curso else MarcaCurso.RAM

        cert_dir = Path(__file__).parent / "media" / "certificados"
        cert_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(cert_dir / f"{folio}.pdf")

        generate_certificate_pdf(
            folio=folio,
            student_name=student_name,
            course_title=course_title,
            instructor_name=instructor_name,
            issued_date=certificado.emitido_en,
            marca=marca,
            output_path=output_path,
        )

        certificado.url_pdf = f"/media/certificados/{folio}.pdf"
        session.add(certificado)
        session.commit()
        session.refresh(certificado)
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).warning("PDF generation failed for %s: %s", folio, exc)

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


# ── Quiz ──────────────────────────────────────────────────────────────────────

def crear_intento_quiz(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
    respuestas_in: list[dict],  # [{pregunta_id, opcion_id}]
    quiz_data: dict,            # QuizData parsed from leccion.contenido
) -> QuizIntento:
    """
    Califica un intento de quiz.
    - aprobado = True solo si TODAS las preguntas son correctas.
    - Guarda el intento y las respuestas individuales.
    - Si aprobado: marca la lección como completada (progreso 100%).
    - Retorna el intento con respuestas (sin revelar cuál era la correcta).
    """
    preguntas = quiz_data.get("preguntas", [])

    # Construir mapa pregunta_id -> opcion_id correcta
    correctas_map: dict[str, str] = {}
    for p in preguntas:
        for o in p.get("opciones", []):
            if o.get("esCorrecta"):
                correctas_map[p["id"]] = o["id"]
                break

    total = len(preguntas)
    correctas_count = 0
    respuestas_db: list[QuizRespuesta] = []

    # Crear intento primero (necesitamos el id)
    intento = QuizIntento(
        inscripcion_id=inscripcion_id,
        leccion_id=leccion_id,
        total_preguntas=total,
        correctas=0,
        aprobado=False,
    )
    session.add(intento)
    session.flush()  # genera el id sin commit

    for r in respuestas_in:
        pregunta_id = r["pregunta_id"]
        opcion_id = r["opcion_id"]
        es_correcta = correctas_map.get(pregunta_id) == opcion_id
        if es_correcta:
            correctas_count += 1
        resp = QuizRespuesta(
            intento_id=intento.id,
            pregunta_id=pregunta_id,
            opcion_id=opcion_id,
            es_correcta=es_correcta,
        )
        respuestas_db.append(resp)
        session.add(resp)

    aprobado = (correctas_count == total) and total > 0
    intento.correctas = correctas_count
    intento.aprobado = aprobado
    session.add(intento)

    session.commit()
    session.refresh(intento)
    return intento


def get_ultimo_intento(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
) -> QuizIntento | None:
    """Devuelve el intento más reciente del alumno en esta lección."""
    return session.exec(
        select(QuizIntento)
        .where(
            QuizIntento.inscripcion_id == inscripcion_id,
            QuizIntento.leccion_id == leccion_id,
        )
        .order_by(QuizIntento.creado_en.desc())  # type: ignore[arg-type]
    ).first()


def get_intentos_curso(
    *,
    session: Session,
    curso_id: uuid.UUID,
) -> list[tuple]:
    """
    Para instructor/admin: devuelve todos los últimos intentos de cada alumno
    por lección de quiz en un curso.
    Retorna tuplas (QuizIntento, User, Leccion).
    """
    from app.models.contenido import Modulo
    stmt = (
        select(QuizIntento, User, Leccion)
        .join(Inscripcion, QuizIntento.inscripcion_id == Inscripcion.id)
        .join(User, Inscripcion.usuario_id == User.id)
        .join(Leccion, QuizIntento.leccion_id == Leccion.id)
        .join(Modulo, Leccion.modulo_id == Modulo.id)
        .where(Modulo.curso_id == curso_id)
        .order_by(QuizIntento.creado_en.desc())  # type: ignore[arg-type]
    )
    return list(session.exec(stmt).all())


# ── Invitaciones ─────────────────────────────────────────────────────────────


def create_invitacion(
    *,
    session: Session,
    curso_id: uuid.UUID,
    email: str,
    creado_por_id: uuid.UUID,
) -> tuple["InvitacionCurso", str]:
    """Genera un token de un solo uso para invitar un alumno al curso.
    Devuelve (InvitacionCurso, raw_token). El raw_token solo se retorna aquí,
    nunca se persiste."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    db_inv = InvitacionCurso(
        curso_id=curso_id,
        email=email,
        token_hash=token_hash,
        expira_en=datetime.utcnow() + timedelta(days=INVITACION_EXPIRACION_DIAS),
        creado_por=creado_por_id,
    )
    session.add(db_inv)
    session.commit()
    session.refresh(db_inv)
    return db_inv, raw_token


def get_invitaciones_por_curso(
    *, session: Session, curso_id: uuid.UUID
) -> list["InvitacionCurso"]:
    stmt = (
        select(InvitacionCurso)
        .where(InvitacionCurso.curso_id == curso_id)
        .order_by(InvitacionCurso.creado_en.desc())  # type: ignore[arg-type]
    )
    return list(session.exec(stmt).all())


def get_invitacion_by_id(
    *, session: Session, invitacion_id: uuid.UUID
) -> "InvitacionCurso | None":
    return session.get(InvitacionCurso, invitacion_id)


def get_invitacion_by_token_hash(
    *, session: Session, token_hash: str
) -> "InvitacionCurso | None":
    return session.exec(
        select(InvitacionCurso).where(InvitacionCurso.token_hash == token_hash)
    ).first()


def canjear_invitacion(
    *,
    session: Session,
    invitacion: "InvitacionCurso",
    usuario_id: uuid.UUID,
) -> Inscripcion:
    """Marca la invitación como usada y crea la inscripción."""
    invitacion.usado_en = datetime.utcnow()
    session.add(invitacion)
    inscripcion = create_inscripcion(
        session=session, usuario_id=usuario_id, curso_id=invitacion.curso_id
    )
    return inscripcion


def delete_invitacion(*, session: Session, invitacion_id: uuid.UUID) -> None:
    db_inv = session.get(InvitacionCurso, invitacion_id)
    if db_inv:
        session.delete(db_inv)
        session.commit()


def get_or_create_user_by_email(
    *, session: Session, email: str
) -> tuple[User, bool, str | None]:
    """Retorna (usuario, creado, contraseña_temporal).
    contraseña_temporal solo tiene valor cuando creado=True; de lo contrario None."""
    user = get_user_by_email(session=session, email=email)
    if user:
        return user, False, None
    temp_password = email  # La contraseña inicial es el propio email del usuario
    user_create = UserCreate(email=email, password=temp_password, rol=RolUsuario.ESTUDIANTE)
    new_user = create_user(session=session, user_create=user_create)
    return new_user, True, temp_password
