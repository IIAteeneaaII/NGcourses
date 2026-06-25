import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

# ISO 25010 §6.5 Mantenibilidad: constantes nombradas en lugar de magic numbers
UMBRAL_COMPLETADO_PCT: int = 90  # Porcentaje mínimo para marcar una lección como completada
FOLIO_TOKEN_BYTES: int = 6      # Bytes para generar el folio del certificado (12 chars hex)
UMBRAL_APROBACION_QUIZ: float = 0.60  # Fracción mínima de aciertos para aprobar un quiz (≥60%)
MAX_INTENTOS_QUIZ: int = 3       # Intentos máximos por quiz antes de bloquear (admin reinicia)
INVITACION_EXPIRACION_DIAS: int = 7  # Días de validez de un enlace de invitación

from sqlalchemy.exc import IntegrityError
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
from app.models._enums import (
    EstadoCurso,
    EstadoInscripcion,
    EstadoCalificacion,
    EstadoLicencia,
    EstadoSolicitud,
    MarcaCurso,
    RolOrganizacion,
    RolUsuario,
)
from app.models.inscripcion import Certificado, Inscripcion, ProgresoLeccion
from app.models.calificacion import Calificacion, VotoResena
from app.models.quiz import QuizIntento, QuizRespuesta
from app.models.invitacion import InvitacionCurso
from app.models.organizacion import (
    ComentarioSolicitud,
    LicenciaCurso,
    Organizacion,
    SolicitudCurso,
    UsuarioOrganizacion,
)
from app.models.pago import Pago
from app.models._enums import EstadoPago


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj

def create_user_by_admin(
    *, session: Session, user_create: UserCreate
) -> tuple[User, str]:
    """Crea usuario desde el panel admin.
    Ignora la password del form, asigna una aleatoria, y genera reset_token.
    Retorna (user, reset_token) — el token se envía por email, nunca se expone."""
    import secrets
    from datetime import timedelta, timezone

    # Password aleatoria — el usuario nunca la usa directamente
    placeholder = secrets.token_urlsafe(16)
    db_obj = User.model_validate(
        user_create,
        update={"hashed_password": get_password_hash(placeholder)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)

    # Token de reset para que el usuario establezca su propia contraseña
    reset_token = secrets.token_urlsafe(32)
    db_obj.password_reset_token = reset_token
    db_obj.password_reset_expira = datetime.now(timezone.utc) + timedelta(hours=72)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)

    return db_obj, reset_token

def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    from app.models._enums import EstadoUsuario

    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    # Mantener is_active en sincronía con estado: el guardia de auth valida
    # is_active, así que al suspender (o reactivar) hay que reflejarlo ahí.
    if "estado" in user_data:
        extra_data["is_active"] = user_data["estado"] == EstadoUsuario.ACTIVO
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
    destacado: bool | None = None,
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
    if destacado is not None:
        filters.append(Curso.destacado == destacado)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    count = session.exec(count_query).one()
    cursos = session.exec(query.offset(skip).limit(limit)).all()
    return list(cursos), count


def get_curso(*, session: Session, curso_id: uuid.UUID) -> Curso | None:
    return session.get(Curso, curso_id)


_METADATA_FIELDS = ("nivel", "lo_que_aprenderas", "requisitos", "notas_revision")


def _sync_es_gratis_with_precio(data: dict) -> None:
    """Mantiene `es_gratis` sincronizado con `precio` para evitar incongruencias.
    precio null o 0 -> es_gratis True. precio > 0 -> es_gratis False.
    No toca licencias organizacionales (LicenciaCurso) — esa via sigue independiente."""
    if "precio" in data:
        precio = data["precio"]
        data["es_gratis"] = precio is None or precio == 0


def create_curso(*, session: Session, curso_in: CursoCreate, instructor_id: uuid.UUID) -> Curso:
    data = curso_in.model_dump(exclude_unset=True)
    _sync_es_gratis_with_precio(data)
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
    _sync_es_gratis_with_precio(data)
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


def _purgar_dependientes_leccion(*, session: Session, leccion_id: uuid.UUID) -> None:
    """Borra las filas que referencian la lección por `leccion_id` SIN ondelete
    CASCADE (intentos de quiz y progreso), para no violar el FK al eliminar la
    lección o su módulo. (Los recursos sí cascadean por su FK; los intentos solo
    cascadean al borrar la inscripción, no la lección.)"""
    for intento in session.exec(
        select(QuizIntento).where(QuizIntento.leccion_id == leccion_id)
    ).all():
        session.delete(intento)  # respuestas cascadean por la relación ORM
    for prog in session.exec(
        select(ProgresoLeccion).where(ProgresoLeccion.leccion_id == leccion_id)
    ).all():
        session.delete(prog)


def delete_modulo(*, session: Session, modulo_id: uuid.UUID) -> None:
    db_modulo = session.get(Modulo, modulo_id)
    if db_modulo:
        for leccion in session.exec(
            select(Leccion).where(Leccion.modulo_id == modulo_id)
        ).all():
            _purgar_dependientes_leccion(session=session, leccion_id=leccion.id)
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
        _purgar_dependientes_leccion(session=session, leccion_id=leccion_id)
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


def curso_completado(*, session: Session, inscripcion: Inscripcion) -> bool:
    """True si el alumno completó TODAS las lecciones actuales del curso.

    CP20: se recalcula contra las lecciones vigentes, así que si se agregan
    módulos/lecciones después de finalizar, el curso deja de estar completo
    hasta que el alumno también los complete.
    """
    statement = (
        select(Leccion)
        .join(Modulo, Leccion.modulo_id == Modulo.id)
        .where(Modulo.curso_id == inscripcion.curso_id)
    )
    todas_lecciones = list(session.exec(statement).all())
    if not todas_lecciones:
        return False

    completadas = get_progreso_curso(session=session, inscripcion_id=inscripcion.id)
    completadas_ids = {p.leccion_id for p in completadas if p.completado}
    total_ids = {l.id for l in todas_lecciones}
    return total_ids.issubset(completadas_ids)


def nombre_certificado_valido(usuario: User | None) -> bool:
    """CP20: el certificado solo puede emitirse con un nombre real en el perfil.

    Rechaza el nombre vacío y el caso reportado de tener el correo metido en el
    campo de nombre (cualquier '@' lo delata).
    """
    if usuario is None or not usuario.full_name:
        return False
    nombre = usuario.full_name.strip()
    return bool(nombre) and "@" not in nombre


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

    completo = curso_completado(session=session, inscripcion=inscripcion)

    # CP20: si el curso cambió (módulos/lecciones nuevos) y ya no está completo,
    # revertir una finalización previa: el certificado deja de ser válido hasta
    # completar el contenido nuevo.
    if not completo:
        if inscripcion.estado == EstadoInscripcion.FINALIZADA:
            inscripcion.estado = EstadoInscripcion.ACTIVA
            session.add(inscripcion)
            session.commit()
        return None

    # Completo → marcar FINALIZADA (idempotente).
    if inscripcion.estado != EstadoInscripcion.FINALIZADA:
        inscripcion.estado = EstadoInscripcion.FINALIZADA
        session.add(inscripcion)
        session.commit()

    # Ya existe certificado?
    existing = session.exec(
        select(Certificado).where(Certificado.inscripcion_id == inscripcion_id)
    ).first()
    if existing:
        return existing

    # CP20: validar que el perfil tenga un nombre real antes de emitir. Si no,
    # NO se emite; se reintenta al consultar sus certificados (GET /me) una vez
    # que el alumno corrija su nombre en el perfil.
    usuario = session.get(User, inscripcion.usuario_id)
    if not nombre_certificado_valido(usuario):
        return None

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

    # FND-009: si dos requests concurrentes pasan el check, el unique constraint
    # en inscripcion_id rechaza el segundo — devolver el existente en ese caso.
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return session.exec(
            select(Certificado).where(Certificado.inscripcion_id == inscripcion_id)
        ).first()

    session.refresh(certificado)

    # Generar PDF del certificado (no-fatal: el registro ya está guardado)
    try:
        from pathlib import Path
        from app.models._enums import MarcaCurso
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
            instructor_id=str(curso.instructor_id) if curso else None,
            issued_date=certificado.emitido_en,
            marca=marca,
            output_path=output_path,
        )

        certificado.url_pdf = f"/media/certificados/{folio}.pdf"
        session.add(certificado)
        session.commit()
        session.refresh(certificado)
    except Exception as exc:  # noqa: BLE001
        # No-fatal: el registro ya existe y la descarga regenera el PDF on-demand.
        # Se registra como error con traza porque suele ser un problema de escritura
        # (permisos del dir media/certificados) que de otro modo pasa inadvertido.
        import logging
        logging.getLogger(__name__).error(
            "PDF generation failed for %s: %s", folio, exc, exc_info=True
        )

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
    - aprobado = True si los aciertos son ≥60% del total (UMBRAL_APROBACION_QUIZ).
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

    # Aprueba con ≥60% de aciertos (antes exigía el 100%).
    aprobado = total > 0 and (correctas_count / total) >= UMBRAL_APROBACION_QUIZ
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


def contar_intentos_quiz(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
) -> int:
    """Número de intentos que el alumno ya hizo en esta lección de quiz."""
    return len(session.exec(
        select(QuizIntento).where(
            QuizIntento.inscripcion_id == inscripcion_id,
            QuizIntento.leccion_id == leccion_id,
        )
    ).all())


def tiene_intento_aprobado_quiz(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
) -> bool:
    """True si el alumno ya aprobó esta lección de quiz en algún intento."""
    return session.exec(
        select(QuizIntento).where(
            QuizIntento.inscripcion_id == inscripcion_id,
            QuizIntento.leccion_id == leccion_id,
            QuizIntento.aprobado == True,  # noqa: E712
        )
    ).first() is not None


def reiniciar_intentos_quiz(
    *,
    session: Session,
    inscripcion_id: uuid.UUID,
    leccion_id: uuid.UUID,
) -> int:
    """Borra los intentos del alumno en esta lección (admin/instructor) para
    desbloquearlo. Devuelve cuántos intentos se eliminaron. Las respuestas se
    borran en cascada (`cascade_delete=True` en QuizIntento.respuestas).

    Además "descompleta" la lección: borra su progreso (si la había aprobado
    quedaba al 100/completado y aparecería en verde con el quiz vacío) y, si el
    curso estaba finalizado, lo regresa a ACTIVA (falta re-aprobar este quiz)."""
    intentos = list(session.exec(
        select(QuizIntento).where(
            QuizIntento.inscripcion_id == inscripcion_id,
            QuizIntento.leccion_id == leccion_id,
        )
    ).all())
    for intento in intentos:
        session.delete(intento)

    prog = session.exec(
        select(ProgresoLeccion).where(
            ProgresoLeccion.inscripcion_id == inscripcion_id,
            ProgresoLeccion.leccion_id == leccion_id,
        )
    ).first()
    if prog:
        session.delete(prog)

    inscripcion = session.get(Inscripcion, inscripcion_id)
    if inscripcion and inscripcion.estado == EstadoInscripcion.FINALIZADA:
        inscripcion.estado = EstadoInscripcion.ACTIVA
        session.add(inscripcion)

    session.commit()
    return len(intentos)


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


def reenviar_invitacion(
    *, session: Session, invitacion_id: uuid.UUID
) -> tuple[Any, str]:
    """Genera un nuevo token y reinicia la expiración de una invitación existente.
    Retorna (invitacion, raw_token)."""
    import hashlib
    import secrets

    inv = get_invitacion_by_id(session=session, invitacion_id=invitacion_id)
    raw_token = secrets.token_urlsafe(32)
    inv.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    inv.expira_en = datetime.utcnow() + timedelta(days=INVITACION_EXPIRACION_DIAS)
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return inv, raw_token


def get_or_create_user_by_email(
    *, session: Session, email: str, organizacion_id: uuid.UUID | None = None
) -> tuple[User, bool, str | None]:
    """Retorna (usuario, creado, token_activacion).

    El token de activación tiene valor cuando se crea una cuenta nueva, o cuando
    el usuario ya existe pero sigue PENDIENTE_ACTIVACION (se regenera para poder
    reenviar el correo). Es de un solo uso y se canjea en /activar. Nunca se
    expone ninguna contraseña."""
    from datetime import timezone

    from app.models._enums import EstadoUsuario

    user = get_user_by_email(session=session, email=email)
    if user:
        if organizacion_id is not None:
            _ensure_user_in_org(session=session, user_id=user.id, organizacion_id=organizacion_id)
        # Usuario invitado antes que nunca activó: regenerar token y devolverlo
        # para que el llamador reenvíe el correo de activación.
        if user.estado == EstadoUsuario.PENDIENTE_ACTIVACION:
            token = secrets.token_urlsafe(32)
            user.token_activacion = token
            user.token_activacion_expira = datetime.now(timezone.utc) + timedelta(hours=72)
            session.add(user)
            session.commit()
            session.refresh(user)
            return user, False, token
        return user, False, None

    # Contraseña placeholder aleatoria: el usuario la reemplaza al activar.
    temp_password = secrets.token_urlsafe(16)
    user_create = UserCreate(email=email, password=temp_password, rol=RolUsuario.ESTUDIANTE)
    new_user = create_user(session=session, user_create=user_create)

    # Cuenta sin verificar: NO puede iniciar sesión hasta activarla por el enlace
    # del correo (/activar). Ver activar_cuenta en routes/users.py.
    new_user.is_active = False
    new_user.estado = EstadoUsuario.PENDIENTE_ACTIVACION

    token = secrets.token_urlsafe(32)
    new_user.token_activacion = token
    new_user.token_activacion_expira = datetime.now(timezone.utc) + timedelta(hours=72)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    if organizacion_id is not None:
        _ensure_user_in_org(
            session=session, user_id=new_user.id, organizacion_id=organizacion_id
        )
    return new_user, True, token

def _ensure_user_in_org(
    *, session: Session, user_id: uuid.UUID, organizacion_id: uuid.UUID,
    rol_org: RolOrganizacion = RolOrganizacion.MIEMBRO,
) -> None:
    """Asegura que el usuario esté vinculado a la organización. Idempotente."""
    existing = session.exec(
        select(UsuarioOrganizacion).where(
            UsuarioOrganizacion.organizacion_id == organizacion_id,
            UsuarioOrganizacion.usuario_id == user_id,
        )
    ).first()
    if existing:
        return
    link = UsuarioOrganizacion(
        organizacion_id=organizacion_id, usuario_id=user_id, rol_org=rol_org
    )
    session.add(link)
    session.commit()


# ── Organizaciones ────────────────────────────────────────────────────────────


def create_organizacion(
    *, session: Session, nombre: str, email_contacto: str | None = None,
    telefono_contacto: str | None = None, plan_de_cursos: str | None = None,
    fecha_compra: datetime | None = None, rfc: str | None = None,
    dominio_corporativo: str | None = None,
) -> Organizacion:
    org = Organizacion(
        nombre=nombre,
        email_contacto=email_contacto,
        telefono_contacto=telefono_contacto,
        plan_de_cursos=plan_de_cursos,
        fecha_compra=fecha_compra,
        rfc=rfc,
        dominio_corporativo=dominio_corporativo,
    )
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


def get_organizacion(*, session: Session, org_id: uuid.UUID) -> Organizacion | None:
    return session.get(Organizacion, org_id)


def list_organizaciones(
    *, session: Session, skip: int = 0, limit: int = 100, search: str | None = None
) -> tuple[list[Organizacion], int]:
    stmt = select(Organizacion)
    count_stmt = select(func.count()).select_from(Organizacion)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Organizacion.nombre.ilike(like))  # type: ignore[attr-defined]
        count_stmt = count_stmt.where(Organizacion.nombre.ilike(like))  # type: ignore[attr-defined]
    stmt = stmt.order_by(Organizacion.creado_en.desc()).offset(skip).limit(limit)  # type: ignore[arg-type]
    items = list(session.exec(stmt).all())
    count = session.exec(count_stmt).one()
    return items, count


def update_organizacion(
    *, session: Session, org: Organizacion, data: dict
) -> Organizacion:
    for k, v in data.items():
        if hasattr(org, k) and v is not None:
            setattr(org, k, v)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


def delete_organizacion(*, session: Session, org_id: uuid.UUID) -> None:
    org = session.get(Organizacion, org_id)
    if org:
        session.delete(org)
        session.commit()


def get_organizacion_of_user(
    *, session: Session, user_id: uuid.UUID
) -> tuple[Organizacion, RolOrganizacion] | None:
    """Retorna (org, rol_org) del usuario, o None si no pertenece a ninguna."""
    row = session.exec(
        select(UsuarioOrganizacion).where(UsuarioOrganizacion.usuario_id == user_id)
    ).first()
    if not row:
        return None
    org = session.get(Organizacion, row.organizacion_id)
    if not org:
        return None
    return org, row.rol_org


def list_org_users(
    *, session: Session, org_id: uuid.UUID
) -> list[tuple[User, RolOrganizacion]]:
    rows = session.exec(
        select(UsuarioOrganizacion).where(UsuarioOrganizacion.organizacion_id == org_id)
    ).all()
    result: list[tuple[User, RolOrganizacion]] = []
    for r in rows:
        u = session.get(User, r.usuario_id)
        if u:
            result.append((u, r.rol_org))
    return result


def list_supervisores_sin_organizacion(*, session: Session) -> list[User]:
    """Supervisores (rol SUPERVISOR) que no pertenecen a ninguna organización.
    Son datos legacy: su panel falla con 404 hasta que un admin les asigne una."""
    subq = select(UsuarioOrganizacion.usuario_id)
    return list(session.exec(
        select(User).where(
            User.rol == RolUsuario.SUPERVISOR,
            User.id.not_in(subq),  # type: ignore[union-attr]
        ).order_by(User.email)  # type: ignore[arg-type]
    ).all())


def org_tiene_supervisor(
    *, session: Session, org_id: uuid.UUID, excluir_user_id: uuid.UUID | None = None
) -> bool:
    """True si la organización ya tiene un supervisor (ADMIN_ORG). `excluir_user_id`
    permite ignorar a un usuario (p.ej. al reasignarse a sí mismo)."""
    stmt = select(UsuarioOrganizacion).where(
        UsuarioOrganizacion.organizacion_id == org_id,
        UsuarioOrganizacion.rol_org == RolOrganizacion.ADMIN_ORG,
    )
    if excluir_user_id is not None:
        stmt = stmt.where(UsuarioOrganizacion.usuario_id != excluir_user_id)
    return session.exec(stmt).first() is not None


def list_organizaciones_sin_supervisor(*, session: Session) -> list[Organizacion]:
    """Organizaciones que no tienen un supervisor (ADMIN_ORG) asignado."""
    con_supervisor = select(UsuarioOrganizacion.organizacion_id).where(
        UsuarioOrganizacion.rol_org == RolOrganizacion.ADMIN_ORG
    )
    return list(session.exec(
        select(Organizacion).where(
            Organizacion.id.not_in(con_supervisor)  # type: ignore[union-attr]
        ).order_by(Organizacion.nombre)  # type: ignore[arg-type]
    ).all())


def add_user_to_organizacion(
    *, session: Session, org_id: uuid.UUID, user_id: uuid.UUID,
    rol_org: RolOrganizacion = RolOrganizacion.MIEMBRO,
) -> UsuarioOrganizacion:
    existing = session.exec(
        select(UsuarioOrganizacion).where(
            UsuarioOrganizacion.organizacion_id == org_id,
            UsuarioOrganizacion.usuario_id == user_id,
        )
    ).first()
    if existing:
        if existing.rol_org != rol_org:
            existing.rol_org = rol_org
            session.add(existing)
            session.commit()
            session.refresh(existing)
        return existing
    link = UsuarioOrganizacion(
        organizacion_id=org_id, usuario_id=user_id, rol_org=rol_org
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def create_supervisor_pendiente(
    *, session: Session, org_id: uuid.UUID, email: str,
    full_name: str | None = None, telefono: str | None = None,
) -> tuple[User, str]:
    """Crea un usuario SUPERVISOR en estado pendiente_activacion y lo vincula a la
    organización como ADMIN_ORG. Retorna (user, raw_token) para enviar el correo de
    activación. No establece/expone contraseña real: usa un placeholder aleatorio que
    el supervisor reemplaza al activar (mismo flujo que el resto de la plataforma)."""
    from datetime import timezone

    from app.models._enums import EstadoUsuario

    token = secrets.token_urlsafe(32)
    placeholder_password = secrets.token_urlsafe(16)

    user = User(
        email=email,
        full_name=full_name,
        telefono=telefono,
        hashed_password=get_password_hash(placeholder_password),
        rol=RolUsuario.SUPERVISOR,
        estado=EstadoUsuario.PENDIENTE_ACTIVACION,
        is_active=False,
        token_activacion=token,
        token_activacion_expira=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    session.add(user)
    session.flush()  # INSERT del usuario antes de la membresía para satisfacer el FK

    link = UsuarioOrganizacion(
        organizacion_id=org_id, usuario_id=user.id,
        rol_org=RolOrganizacion.ADMIN_ORG,
    )
    session.add(link)
    session.commit()
    session.refresh(user)
    return user, token


def remove_user_from_organizacion(
    *, session: Session, org_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    row = session.exec(
        select(UsuarioOrganizacion).where(
            UsuarioOrganizacion.organizacion_id == org_id,
            UsuarioOrganizacion.usuario_id == user_id,
        )
    ).first()
    if row:
        session.delete(row)
        session.commit()


# ── Licencias (org ↔ curso) ──────────────────────────────────────────────────


def assign_licencia(
    *, session: Session, org_id: uuid.UUID, curso_id: uuid.UUID
) -> LicenciaCurso:
    """Asigna un curso a una organización con cupos ilimitados (cupos_total=0 representa
    ilimitado en esta configuración)."""
    existing = session.exec(
        select(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org_id,
            LicenciaCurso.curso_id == curso_id,
        )
    ).first()
    if existing:
        if existing.estado != EstadoLicencia.ACTIVA:
            existing.estado = EstadoLicencia.ACTIVA
            session.add(existing)
            session.commit()
            session.refresh(existing)
        return existing
    lic = LicenciaCurso(
        organizacion_id=org_id,
        curso_id=curso_id,
        cupos_total=0,  # 0 = ilimitados
        cupos_usados=0,
        estado=EstadoLicencia.ACTIVA,
    )
    session.add(lic)
    session.commit()
    session.refresh(lic)
    return lic


def unassign_licencia(
    *, session: Session, org_id: uuid.UUID, curso_id: uuid.UUID
) -> None:
    row = session.exec(
        select(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org_id,
            LicenciaCurso.curso_id == curso_id,
        )
    ).first()
    if row:
        session.delete(row)
        session.commit()


def list_licencias_by_org(
    *, session: Session, org_id: uuid.UUID
) -> list[LicenciaCurso]:
    return list(session.exec(
        select(LicenciaCurso).where(LicenciaCurso.organizacion_id == org_id)
    ).all())


def tiene_licencia_activa(
    *, session: Session, org_id: uuid.UUID, curso_id: uuid.UUID
) -> bool:
    """True si la org tiene LicenciaCurso ACTIVA, vigente y con cupos para el curso.

    cupos_total=0 representa cupos ilimitados.
    """
    lic = session.exec(
        select(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org_id,
            LicenciaCurso.curso_id == curso_id,
            LicenciaCurso.estado == EstadoLicencia.ACTIVA,
        )
    ).first()
    if not lic:
        return False
    now = datetime.utcnow()
    if lic.inicia_en and lic.inicia_en > now:
        return False
    if lic.termina_en and lic.termina_en < now:
        return False
    if lic.cupos_total and lic.cupos_usados >= lic.cupos_total:
        return False
    return True


def cursos_con_licencia_activa(
    *, session: Session, org_id: uuid.UUID
) -> set[uuid.UUID]:
    """Set de curso_id con licencia ACTIVA y vigente para la org. Útil para batch lookup."""
    now = datetime.utcnow()
    rows = session.exec(
        select(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org_id,
            LicenciaCurso.estado == EstadoLicencia.ACTIVA,
        )
    ).all()
    out: set[uuid.UUID] = set()
    for lic in rows:
        if lic.inicia_en and lic.inicia_en > now:
            continue
        if lic.termina_en and lic.termina_en < now:
            continue
        if lic.cupos_total and lic.cupos_usados >= lic.cupos_total:
            continue
        out.add(lic.curso_id)
    return out


def list_cursos_for_student(
    *, session: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 100,
    categoria_id: uuid.UUID | None = None, search: str | None = None,
    destacado: bool | None = None,
) -> tuple[list[Curso], int]:
    """Retorna cursos publicados donde:
       - marca = NEXTGEN (visible para todos), OR
       - existe LicenciaCurso ACTIVA para la organización del usuario
    """
    org_info = get_organizacion_of_user(session=session, user_id=user_id)
    org_id = org_info[0].id if org_info else None

    from sqlalchemy import or_

    # Cursos en los que el alumno está inscrito (no dados de baja): SIEMPRE visibles
    # en su dashboard, sin importar la marca. Cubre los cursos a los que llegó por
    # invitación (típicamente marca RAM), que antes solo se veían en "Mis cursos".
    insc_subq = select(Inscripcion.curso_id).where(
        Inscripcion.usuario_id == user_id,
        Inscripcion.estado != EstadoInscripcion.CANCELADO,
    )

    stmt = select(Curso).where(Curso.estado == EstadoCurso.PUBLICADO)

    # Un curso es visible para el alumno si: es NEXTGEN, o está inscrito en él, o
    # su organización tiene una licencia activa que lo cubre.
    visibles = [
        Curso.marca == MarcaCurso.NEXTGEN,
        Curso.id.in_(insc_subq),  # type: ignore[attr-defined]
    ]
    if org_id is not None:
        lic_subq = select(LicenciaCurso.curso_id).where(
            LicenciaCurso.estado == EstadoLicencia.ACTIVA,
            LicenciaCurso.organizacion_id == org_id,
        )
        visibles.append(Curso.id.in_(lic_subq))  # type: ignore[attr-defined]
    stmt = stmt.where(or_(*visibles))

    if categoria_id:
        stmt = stmt.where(Curso.categoria_id == categoria_id)
    if search:
        stmt = stmt.where(Curso.titulo.ilike(f"%{search}%"))  # type: ignore[attr-defined]
    if destacado is not None:
        stmt = stmt.where(Curso.destacado == destacado)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    count = session.exec(count_stmt).one()
    items = list(session.exec(stmt.offset(skip).limit(limit)).all())
    return items, count


# ── Stats de organización ────────────────────────────────────────────────────


def get_org_stats(*, session: Session, org_id: uuid.UUID) -> dict:
    """Retorna estadísticas básicas de una organización."""
    user_ids = [
        r.usuario_id for r in session.exec(
            select(UsuarioOrganizacion).where(
                UsuarioOrganizacion.organizacion_id == org_id
            )
        ).all()
    ]
    total_usuarios = len(user_ids)
    if not user_ids:
        return {
            "usuarios_totales": 0,
            "usuarios_activos": 0,
            "progreso_promedio": 0.0,
            "cursos_disponibles": 0,
            "inscripciones_totales": 0,
        }

    active_count = session.exec(
        select(func.count()).select_from(User).where(
            User.id.in_(user_ids),  # type: ignore[attr-defined]
            User.is_active == True,  # noqa: E712
        )
    ).one()

    inscripciones = list(session.exec(
        select(Inscripcion).where(Inscripcion.usuario_id.in_(user_ids))  # type: ignore[attr-defined]
    ).all())
    total_insc = len(inscripciones)

    # Progreso promedio: sobre ProgresoLeccion de los usuarios de la org.
    insc_ids = [i.id for i in inscripciones]
    if insc_ids:
        progreso_vals = list(session.exec(
            select(ProgresoLeccion.progreso_pct).where(
                ProgresoLeccion.inscripcion_id.in_(insc_ids)  # type: ignore[attr-defined]
            )
        ).all())
    else:
        progreso_vals = []
    progreso_prom = (sum(progreso_vals) / len(progreso_vals)) if progreso_vals else 0.0

    cursos_disp = session.exec(
        select(func.count()).select_from(LicenciaCurso).where(
            LicenciaCurso.organizacion_id == org_id,
            LicenciaCurso.estado == EstadoLicencia.ACTIVA,
        )
    ).one()

    return {
        "usuarios_totales": total_usuarios,
        "usuarios_activos": int(active_count),
        "progreso_promedio": round(float(progreso_prom), 2),
        "cursos_disponibles": int(cursos_disp),
        "inscripciones_totales": total_insc,
    }


# ── Solicitudes de curso ─────────────────────────────────────────────────────


def create_solicitud_curso(
    *, session: Session, org_id: uuid.UUID, solicitante_id: uuid.UUID,
    titulo: str, descripcion: str | None,
) -> SolicitudCurso:
    s = SolicitudCurso(
        organizacion_id=org_id,
        solicitante_id=solicitante_id,
        titulo_solicitud=titulo,
        descripcion=descripcion,
    )
    session.add(s)
    session.commit()
    session.refresh(s)
    return s


def list_solicitudes_by_org(
    *, session: Session, org_id: uuid.UUID
) -> list[SolicitudCurso]:
    return list(session.exec(
        select(SolicitudCurso).where(SolicitudCurso.organizacion_id == org_id)
        .order_by(SolicitudCurso.creado_en.desc())  # type: ignore[arg-type]
    ).all())


def list_all_solicitudes(*, session: Session) -> list[SolicitudCurso]:
    """Todas las solicitudes de curso (panel de admin)."""
    return list(session.exec(
        select(SolicitudCurso).order_by(SolicitudCurso.creado_en.desc())  # type: ignore[arg-type]
    ).all())


def get_solicitud(
    *, session: Session, solicitud_id: uuid.UUID
) -> SolicitudCurso | None:
    return session.get(SolicitudCurso, solicitud_id)


def set_solicitud_estado(
    *, session: Session, solicitud: SolicitudCurso, estado: EstadoSolicitud
) -> SolicitudCurso:
    solicitud.estado = estado
    solicitud.actualizado_en = datetime.utcnow()
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)
    return solicitud


def add_comentario_solicitud(
    *, session: Session, solicitud_id: uuid.UUID, autor_id: uuid.UUID, comentario: str
) -> ComentarioSolicitud:
    c = ComentarioSolicitud(
        solicitud_id=solicitud_id, autor_id=autor_id, comentario=comentario
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


# ── Pagos (RF10/RF08) ──────────────────────────────────────────────────────


def create_pago_pendiente(
    *,
    session: Session,
    usuario_id: uuid.UUID,
    curso_id: uuid.UUID,
    monto: Any,
    moneda: str,
    referencia_paypal: str | None = None,
    status: EstadoPago = EstadoPago.PENDIENTE,
) -> Pago:
    """Crea un registro de pago en estado PENDIENTE (o el que se indique).
    Se usa al iniciar la orden PayPal y como base para cortesias."""
    pago = Pago(
        usuario_id=usuario_id,
        curso_id=curso_id,
        monto=monto,
        moneda=moneda,
        referencia_paypal=referencia_paypal,
        status=status,
    )
    session.add(pago)
    session.commit()
    session.refresh(pago)
    return pago


def get_pago_by_id(*, session: Session, pago_id: uuid.UUID) -> Pago | None:
    return session.get(Pago, pago_id)


def update_pago_status(
    *,
    session: Session,
    pago: Pago,
    status: EstadoPago,
    referencia_paypal: str | None = None,
) -> Pago:
    pago.status = status
    if referencia_paypal:
        pago.referencia_paypal = referencia_paypal
    pago.updated_at = datetime.utcnow()
    session.add(pago)
    session.commit()
    session.refresh(pago)
    return pago


def get_pagos_usuario(
    *, session: Session, usuario_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> tuple[list[Pago], int]:
    base = select(Pago).where(Pago.usuario_id == usuario_id)
    count = session.exec(
        select(func.count()).select_from(Pago).where(Pago.usuario_id == usuario_id)
    ).one()
    items = session.exec(
        base.order_by(Pago.created_at.desc())  # type: ignore[arg-type]
        .offset(skip).limit(limit)
    ).all()
    return list(items), count


def usuario_tiene_pago_completado(
    *, session: Session, usuario_id: uuid.UUID, curso_id: uuid.UUID
) -> bool:
    """Indica si el usuario tiene un Pago COMPLETADO o CORTESIA para el curso."""
    stmt = select(Pago).where(
        Pago.usuario_id == usuario_id,
        Pago.curso_id == curso_id,
        Pago.status.in_([EstadoPago.COMPLETADO, EstadoPago.CORTESIA]),  # type: ignore[attr-defined]
    )
    return session.exec(stmt).first() is not None


def cursos_con_pago_del_usuario(
    *, session: Session, usuario_id: uuid.UUID
) -> set[uuid.UUID]:
    """Set de curso_ids donde el usuario tiene Pago COMPLETADO o CORTESIA.
    Se usa para no marcar 'bloqueado_por_licencia' en cursos que el alumno ya compro."""
    stmt = select(Pago.curso_id).where(
        Pago.usuario_id == usuario_id,
        Pago.status.in_([EstadoPago.COMPLETADO, EstadoPago.CORTESIA]),  # type: ignore[attr-defined]
    )
    return {row for row in session.exec(stmt).all()}



def reenviar_invitacion(*, session: Session, invitacion_id: uuid.UUID) -> tuple[Any, str]:
    inv = get_invitacion_by_id(session=session, invitacion_id=invitacion_id)
    if not inv:  # ← AGREGAR ESTO
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    raw_token = secrets.token_urlsafe(32)
    inv.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    inv.expira_en = datetime.utcnow() + timedelta(days=INVITACION_EXPIRACION_DIAS)
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return inv, raw_token


# ── Feature Flags ─────────────────────────────────────────────────────────────


def get_feature_flags(*, session: Session) -> list:
    """Devuelve todos los feature flags."""
    from app.models.sistema import FeatureFlag
    return list(session.exec(select(FeatureFlag)).all())


def feature_habilitada(*, session: Session, nombre: str, default: bool = False) -> bool:
    """True si el feature `nombre` está habilitado. Si no existe el registro,
    devuelve `default` (apagado por defecto)."""
    from app.models.sistema import FeatureFlag
    flag = session.get(FeatureFlag, nombre)
    return flag.habilitado if flag else default


def set_feature_flag(*, session: Session, nombre: str, habilitado: bool):
    """Prende/apaga un feature flag (lo crea si no existe)."""
    from app.models.sistema import FeatureFlag
    flag = session.get(FeatureFlag, nombre)
    if flag is None:
        flag = FeatureFlag(nombre=nombre, habilitado=habilitado)
    else:
        flag.habilitado = habilitado
    flag.actualizado_en = datetime.utcnow()
    session.add(flag)
    session.commit()
    session.refresh(flag)
    return flag
