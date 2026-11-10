"""La reseña de un curso se pide solo cuando el alumno ya lo terminó."""
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.main import app
from app.models._enums import EstadoCurso, MarcaCurso
from app.models.calificacion import Calificacion
from app.models.contenido import Curso, CursoCreate, Leccion, Modulo
from app.models.inscripcion import Inscripcion, ProgresoLeccion
from app.models.user import UserCreate
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR


def _curso_con_leccion(db: Session, instructor_id: uuid.UUID) -> tuple[Curso, Leccion]:
    curso = crud.create_curso(
        session=db,
        curso_in=CursoCreate(
            titulo="Curso reseñas",
            slug=f"curso-resenas-{uuid.uuid4().hex[:8]}",
            descripcion="test",
            estado=EstadoCurso.PUBLICADO,
            marca=MarcaCurso.NEXTGEN,
            es_gratis=True,
        ),
        instructor_id=instructor_id,
    )
    curso.estado = EstadoCurso.PUBLICADO
    db.add(curso)
    db.commit()
    modulo = Modulo(curso_id=curso.id, titulo="Módulo 1")
    db.add(modulo)
    db.commit()
    leccion = Leccion(modulo_id=modulo.id, titulo="Lección 1")
    db.add(leccion)
    db.commit()
    db.refresh(curso)
    db.refresh(leccion)
    return curso, leccion


def test_resena_solo_al_completar_el_curso(db: Session) -> None:
    # Cliente propio: la sesión viaja en cookie (login/access-token).
    client = TestClient(app)
    email, password = random_email(), random_lower_string()
    usuario = crud.create_user(session=db, user_create=UserCreate(email=email, password=password))
    r = client.post(f"{API}/login/access-token", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    headers: dict[str, str] = {}
    usuario_id = usuario.id

    curso, leccion = _curso_con_leccion(db, usuario_id)
    inscripcion = Inscripcion(usuario_id=usuario_id, curso_id=curso.id)
    db.add(inscripcion)
    db.commit()
    db.refresh(inscripcion)

    try:
        # Inscrito pero sin terminar: no puede calificar.
        r = client.post(
            f"{API}/calificaciones/cursos/{curso.id}",
            headers=headers,
            json={"estrellas": 5, "comentario": "Muy bueno"},
        )
        assert r.status_code == 403
        assert "completes" in r.json()["detail"]

        # Con todas las lecciones completadas ya puede.
        db.add(ProgresoLeccion(
            inscripcion_id=inscripcion.id, leccion_id=leccion.id, progreso_pct=100, completado=True,
        ))
        db.commit()
        r = client.post(
            f"{API}/calificaciones/cursos/{curso.id}",
            headers=headers,
            json={"estrellas": 5, "comentario": "Muy bueno"},
        )
        assert r.status_code == 201, r.text
        assert r.json()["estrellas"] == 5
    finally:
        for cal in db.exec(select(Calificacion).where(Calificacion.curso_id == curso.id)).all():
            db.delete(cal)
        for p in db.exec(select(ProgresoLeccion).where(ProgresoLeccion.inscripcion_id == inscripcion.id)).all():
            db.delete(p)
        db.delete(inscripcion)
        db.commit()
        db.delete(db.get(Curso, curso.id))
        db.commit()
