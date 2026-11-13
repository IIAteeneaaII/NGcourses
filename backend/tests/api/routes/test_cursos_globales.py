"""Cursos globales: un curso que agrupa cursos existentes como subcursos.

Lo más importante que se prueba aquí es que los cursos que no pertenecen a
ningún curso global se comportan exactamente igual que antes.
"""
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models import UserCreate
from app.models._enums import EstadoCurso, MarcaCurso, TipoCurso, TipoLeccion
from app.models.contenido import Curso, CursoCreate, LeccionCreate, ModuloCreate
from app.models.inscripcion import Inscripcion
from app.models.organizacion import LicenciaCurso, Organizacion, UsuarioOrganizacion
from app.models.user import User
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR

_cursos: list[uuid.UUID] = []
_orgs: list[uuid.UUID] = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(db: Session):
    yield
    for cid in _cursos:
        for ins in db.exec(select(Inscripcion).where(Inscripcion.curso_id == cid)).all():
            db.delete(ins)
        for lic in db.exec(select(LicenciaCurso).where(LicenciaCurso.curso_id == cid)).all():
            db.delete(lic)
    db.commit()
    # Primero los cursos de dentro, luego los globales.
    for cid in _cursos:
        c = db.get(Curso, cid)
        if c and c.tipo != TipoCurso.GLOBAL:
            db.delete(c)
    db.commit()
    for cid in _cursos:
        c = db.get(Curso, cid)
        if c:
            db.delete(c)
    for oid in _orgs:
        for m in db.exec(select(UsuarioOrganizacion).where(UsuarioOrganizacion.organizacion_id == oid)).all():
            db.delete(m)
        org = db.get(Organizacion, oid)
        if org:
            db.delete(org)
    db.commit()


# ── helpers ──────────────────────────────────────────────────────────────────


def _cliente(user_id: uuid.UUID) -> TestClient:
    c = TestClient(app)
    c.cookies.set("access_token", create_access_token(user_id, expires_delta=timedelta(minutes=10)))
    return c


def _admin(db: Session) -> tuple[TestClient, uuid.UUID]:
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).first()
    assert admin is not None
    return _cliente(admin.id), admin.id


def _alumno(db: Session, org_id: uuid.UUID | None = None) -> tuple[TestClient, uuid.UUID]:
    user = crud.create_user(
        session=db, user_create=UserCreate(email=random_email(), password=random_lower_string())
    )
    if org_id:
        db.add(UsuarioOrganizacion(organizacion_id=org_id, usuario_id=user.id))
        db.commit()
    return _cliente(user.id), user.id


def _org(db: Session) -> uuid.UUID:
    org = Organizacion(nombre=f"Org {uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()
    _orgs.append(org.id)
    return org.id


def _curso(
    db: Session,
    instructor_id: uuid.UUID,
    titulo: str,
    *,
    lecciones: int = 2,
    tipo: TipoCurso = TipoCurso.INDIVIDUAL,
    marca: MarcaCurso = MarcaCurso.RAM,
    estado: EstadoCurso = EstadoCurso.PUBLICADO,
) -> Curso:
    curso = crud.create_curso(
        session=db,
        curso_in=CursoCreate(
            titulo=titulo, slug=f"c-{uuid.uuid4().hex[:10]}", tipo=tipo,
            estado=estado, marca=marca, es_gratis=True,
        ),
        instructor_id=instructor_id,
    )
    _cursos.append(curso.id)
    if tipo == TipoCurso.INDIVIDUAL and lecciones:
        m = crud.create_modulo(session=db, modulo_in=ModuloCreate(titulo="Módulo 1", orden=1), curso_id=curso.id)
        for i in range(lecciones):
            crud.create_leccion(
                session=db,
                leccion_in=LeccionCreate(titulo=f"Lección {i + 1}", tipo=TipoLeccion.LECTURA, orden=i),
                modulo_id=m.id,
            )
    return curso


def _escenario(db: Session):
    """Org con licencia de un curso global "Testeo" con 3 cursos dentro."""
    admin, admin_id = _admin(db)
    org_id = _org(db)
    testeo = _curso(db, admin_id, "Testeo", tipo=TipoCurso.GLOBAL, estado=EstadoCurso.BORRADOR)
    hijos = [_curso(db, admin_id, t, lecciones=n) for t, n in (("Desensamble", 3), ("Quitar tapa", 2), ("Escaneo", 1))]
    r = admin.put(f"{API}/cursos/{testeo.id}/subcursos", json={"curso_ids": [str(h.id) for h in hijos]})
    assert r.status_code == 201, r.text
    r = admin.patch(f"{API}/cursos/{testeo.id}", json={"estado": "publicado"})
    assert r.status_code == 201, r.text
    crud.assign_licencia(session=db, org_id=org_id, curso_id=testeo.id)
    return admin, admin_id, org_id, testeo, hijos


# ── cursos sin global: igual que antes ──────────────────────────────────────


def test_curso_existente_no_cambia(db: Session) -> None:
    _, admin_id = _admin(db)
    curso = _curso(db, admin_id, "Excel suelto", marca=MarcaCurso.NEXTGEN)
    alumno, _ = _alumno(db)

    lista = alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"]
    item = next(c for c in lista if c["id"] == str(curso.id))
    assert item["tipo"] == "individual"
    assert item["curso_padre_id"] is None
    assert item["subcursos_total"] == 0

    det = alumno.get(f"{API}/cursos/{curso.id}").json()
    assert det["padre"] is None and det["subcursos"] == []
    assert len(det["modulos"]) == 1

    r = alumno.post(f"{API}/inscripciones/", json={"curso_id": str(curso.id)})
    assert r.status_code == 201
    assert r.json()["curso_id"] == str(curso.id)


def test_licencia_de_curso_suelto_no_se_agrupa(db: Session) -> None:
    """Si la org tiene licencia de solo algunos cursos del global (y no del
    global), el alumno sigue viendo esos cursos sueltos, como hoy."""
    admin, admin_id = _admin(db)
    org_id = _org(db)
    glob = _curso(db, admin_id, "Reparación", tipo=TipoCurso.GLOBAL, estado=EstadoCurso.BORRADOR)
    hijo = _curso(db, admin_id, "Antena y base")
    otro = _curso(db, admin_id, "Pantalla")
    admin.put(f"{API}/cursos/{glob.id}/subcursos", json={"curso_ids": [str(hijo.id), str(otro.id)]})
    admin.patch(f"{API}/cursos/{glob.id}", json={"estado": "publicado"})
    crud.assign_licencia(session=db, org_id=org_id, curso_id=hijo.id)
    alumno, _ = _alumno(db, org_id)

    ids = {c["id"] for c in alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"]}
    assert str(hijo.id) in ids
    assert str(glob.id) not in ids
    r = alumno.post(f"{API}/inscripciones/", json={"curso_id": str(glob.id)})
    assert r.status_code == 403


def test_licencias_de_todos_sus_cursos_agrupan_sin_licencia_del_global(db: Session) -> None:
    """Si la org ya tiene licencia de cada curso del global, el alumno lo ve
    agrupado y puede inscribirse al global, sin licencia propia del global."""
    admin, admin_id = _admin(db)
    org_id = _org(db)
    glob = _curso(db, admin_id, "Limpieza", tipo=TipoCurso.GLOBAL, estado=EstadoCurso.BORRADOR)
    a = _curso(db, admin_id, "Tarjeta")
    b = _curso(db, admin_id, "Carcasa")
    admin.put(f"{API}/cursos/{glob.id}/subcursos", json={"curso_ids": [str(a.id), str(b.id)]})
    admin.patch(f"{API}/cursos/{glob.id}", json={"estado": "publicado"})
    crud.assign_licencia(session=db, org_id=org_id, curso_id=a.id)
    crud.assign_licencia(session=db, org_id=org_id, curso_id=b.id)
    alumno, alumno_id = _alumno(db, org_id)

    lista = alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"]
    ids = [c["id"] for c in lista]
    assert ids.count(str(glob.id)) == 1
    assert str(a.id) not in ids and str(b.id) not in ids
    assert next(c for c in lista if c["id"] == str(glob.id))["es_de_mi_org"] is True

    r = alumno.post(f"{API}/inscripciones/", json={"curso_id": str(glob.id)})
    assert r.status_code == 201, r.text
    inscritos = {
        i.curso_id for i in db.exec(select(Inscripcion).where(Inscripcion.usuario_id == alumno_id)).all()
    }
    assert inscritos == {a.id, b.id}


# ── catálogo, ficha e inscripción ───────────────────────────────────────────


def test_catalogo_muestra_el_global_en_lugar_de_sus_cursos(db: Session) -> None:
    _, _, org_id, testeo, hijos = _escenario(db)
    alumno, _ = _alumno(db, org_id)

    lista = alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"]
    ids = [c["id"] for c in lista]
    assert ids.count(str(testeo.id)) == 1
    assert not any(str(h.id) in ids for h in hijos)
    g = next(c for c in lista if c["id"] == str(testeo.id))
    assert g["tipo"] == "global"
    assert g["subcursos_total"] == 3
    assert g["lecciones_total"] == 6
    assert g["es_de_mi_org"] is True


def test_ficha_del_global_y_de_un_curso_dentro(db: Session) -> None:
    _, _, org_id, testeo, hijos = _escenario(db)
    alumno, _ = _alumno(db, org_id)

    det = alumno.get(f"{API}/cursos/{testeo.id}").json()
    assert [s["titulo"] for s in det["subcursos"]] == ["Desensamble", "Quitar tapa", "Escaneo"]
    assert det["subcursos"][0]["total_lecciones"] == 3
    assert det["modulos"] == []

    medio = alumno.get(f"{API}/cursos/{hijos[1].id}").json()
    assert medio["padre"]["titulo"] == "Testeo"
    assert medio["padre"]["posicion"] == 2 and medio["padre"]["total"] == 3
    assert medio["padre"]["siguiente_titulo"] == "Escaneo"
    assert medio["padre"]["anterior_titulo"] == "Desensamble"


def test_inscribirse_al_global_inscribe_en_todos(db: Session) -> None:
    _, _, org_id, testeo, hijos = _escenario(db)
    alumno, alumno_id = _alumno(db, org_id)

    r = alumno.post(f"{API}/inscripciones/", json={"curso_id": str(testeo.id)})
    assert r.status_code == 201, r.text
    inscs = db.exec(select(Inscripcion).where(Inscripcion.usuario_id == alumno_id)).all()
    assert {i.curso_id for i in inscs} == {h.id for h in hijos}

    # Con la inscripción, el contenido de cada curso ya es accesible.
    det = alumno.get(f"{API}/cursos/{hijos[0].id}/modulos").json()
    assert det[0]["lecciones"]

    g = next(c for c in alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"] if c["id"] == str(testeo.id))
    assert g["subcursos_inscritos"] == 3

    # Repetirlo no duplica inscripciones.
    assert alumno.post(f"{API}/inscripciones/", json={"curso_id": str(testeo.id)}).status_code == 201
    assert len(db.exec(select(Inscripcion).where(Inscripcion.usuario_id == alumno_id)).all()) == 3


def test_alumno_sin_licencia_no_ve_ni_se_inscribe(db: Session) -> None:
    _, _, _, testeo, hijos = _escenario(db)
    alumno, _ = _alumno(db)
    ids = {c["id"] for c in alumno.get(f"{API}/cursos/", params={"limit": 500}).json()["data"]}
    assert str(testeo.id) not in ids and not any(str(h.id) in ids for h in hijos)
    assert alumno.post(f"{API}/inscripciones/", json={"curso_id": str(testeo.id)}).status_code == 403


# ── reglas del admin ─────────────────────────────────────────────────────────


def test_reglas_de_armado(db: Session) -> None:
    admin, admin_id, _, testeo, hijos = _escenario(db)
    otro = _curso(db, admin_id, "Limpieza", tipo=TipoCurso.GLOBAL, estado=EstadoCurso.BORRADOR)

    # Un curso no puede estar en dos globales.
    r = admin.put(f"{API}/cursos/{otro.id}/subcursos", json={"curso_ids": [str(hijos[0].id)]})
    assert r.status_code == 409 and "Testeo" in r.json()["detail"]
    # Un global no va dentro de otro.
    r = admin.put(f"{API}/cursos/{otro.id}/subcursos", json={"curso_ids": [str(testeo.id)]})
    assert r.status_code == 409
    # Un global no tiene módulos.
    r = admin.post(f"{API}/cursos/{otro.id}/modulos", json={"titulo": "M", "orden": 1})
    assert r.status_code == 409
    # No se publica vacío.
    assert admin.patch(f"{API}/cursos/{otro.id}", json={"estado": "publicado"}).status_code == 409

    # Quitar un curso lo deja suelto, sin borrarlo; reordenar cambia el orden.
    r = admin.put(f"{API}/cursos/{testeo.id}/subcursos", json={"curso_ids": [str(hijos[2].id), str(hijos[0].id)]})
    assert r.status_code == 200
    assert [s["titulo"] for s in r.json()] == ["Escaneo", "Desensamble"]
    db.expire_all()
    suelto = db.get(Curso, hijos[1].id)
    assert suelto is not None and suelto.curso_padre_id is None


def test_borrar_el_global_deja_sueltos_sus_cursos(db: Session) -> None:
    admin, _, _, testeo, hijos = _escenario(db)
    for lic in db.exec(select(LicenciaCurso).where(LicenciaCurso.curso_id == testeo.id)).all():
        db.delete(lic)
    db.commit()
    assert admin.delete(f"{API}/cursos/{testeo.id}").status_code == 200
    db.expire_all()
    for h in hijos:
        c = db.get(Curso, h.id)
        assert c is not None and c.curso_padre_id is None
