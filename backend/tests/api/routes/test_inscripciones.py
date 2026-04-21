"""Tests del bloqueo de inscripción por LicenciaCurso de la organización."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models._enums import EstadoCurso, MarcaCurso
from app.models.contenido import Curso, CursoCreate
from app.models.inscripcion import Inscripcion
from app.models.organizacion import LicenciaCurso, Organizacion, UsuarioOrganizacion
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR


# ── Helpers / fixtures ───────────────────────────────────────────────────────

_created_curso_ids: list[uuid.UUID] = []
_created_org_ids: list[uuid.UUID] = []
_created_user_emails: list[str] = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(db: Session):
    yield
    for cid in _created_curso_ids:
        for ins in db.exec(
            __import__("sqlmodel").select(Inscripcion).where(Inscripcion.curso_id == cid)
        ).all():
            db.delete(ins)
        for lic in db.exec(
            __import__("sqlmodel").select(LicenciaCurso).where(LicenciaCurso.curso_id == cid)
        ).all():
            db.delete(lic)
        c = db.get(Curso, cid)
        if c:
            db.delete(c)
    for oid in _created_org_ids:
        for uo in db.exec(
            __import__("sqlmodel").select(UsuarioOrganizacion).where(
                UsuarioOrganizacion.organizacion_id == oid
            )
        ).all():
            db.delete(uo)
        org = db.get(Organizacion, oid)
        if org:
            db.delete(org)
    db.commit()
    _created_curso_ids.clear()
    _created_org_ids.clear()


def _create_curso(db: Session, instructor_id: uuid.UUID, *, marca: MarcaCurso, es_gratis: bool) -> Curso:
    curso_in = CursoCreate(
        titulo=f"Curso {marca.value} gratis={es_gratis}",
        slug=f"curso-{uuid.uuid4().hex[:8]}",
        descripcion="test",
        estado=EstadoCurso.PUBLICADO,
        marca=marca,
        es_gratis=es_gratis,
    )
    curso = crud.create_curso(session=db, curso_in=curso_in, instructor_id=instructor_id)
    # Forzar PUBLICADO (create_curso defaultea a BORRADOR si no se respeta)
    curso.estado = EstadoCurso.PUBLICADO
    db.add(curso)
    db.commit()
    db.refresh(curso)
    _created_curso_ids.append(curso.id)
    return curso


def _create_org_user(db: Session, client: TestClient) -> tuple[uuid.UUID, dict]:
    email = random_email()
    _created_user_emails.append(email)
    headers = authentication_token_from_email(client=client, email=email, db=db)
    me = client.get(f"{API}/users/me", headers=headers).json()
    user_id = uuid.UUID(me["id"])

    org = crud.create_organizacion(session=db, nombre=f"Org {uuid.uuid4().hex[:6]}")
    _created_org_ids.append(org.id)
    crud.add_user_to_organizacion(session=db, org_id=org.id, user_id=user_id)
    return org.id, headers


def _superuser_id(client: TestClient, headers: dict) -> uuid.UUID:
    r = client.post(f"{API}/login/test-token", headers=headers)
    return uuid.UUID(r.json()["id"])


# ── Tests ────────────────────────────────────────────────────────────────────


def test_inscripcion_nextgen_gratis_sin_licencia_ok(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """Curso NEXTGEN gratuito: cualquier usuario puede inscribirse sin licencia."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=True)
    _, headers = _create_org_user(db, client)

    r = client.post(
        f"{API}/inscripciones/", headers=headers, json={"curso_id": str(curso.id)}
    )
    assert r.status_code == 201, r.text


def test_inscripcion_nextgen_pagado_sin_licencia_bloqueada(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """Curso NEXTGEN no gratuito sin LicenciaCurso → 403."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=False)
    _, headers = _create_org_user(db, client)

    r = client.post(
        f"{API}/inscripciones/", headers=headers, json={"curso_id": str(curso.id)}
    )
    assert r.status_code == 403, r.text
    assert "organización" in r.json()["detail"].lower() or "organizacion" in r.json()["detail"].lower()


def test_inscripcion_nextgen_pagado_con_licencia_ok(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """Curso NEXTGEN no gratuito con LicenciaCurso ACTIVA → 201."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=False)
    org_id, headers = _create_org_user(db, client)
    crud.assign_licencia(session=db, org_id=org_id, curso_id=curso.id)

    r = client.post(
        f"{API}/inscripciones/", headers=headers, json={"curso_id": str(curso.id)}
    )
    assert r.status_code == 201, r.text


def test_admin_puede_inscribir_curso_pagado_sin_licencia(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """Admin/superuser puede inscribirse aunque no haya licencia (bypass existente)."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=False)

    r = client.post(
        f"{API}/inscripciones/",
        headers=superuser_token_headers,
        json={"curso_id": str(curso.id)},
    )
    assert r.status_code == 201, r.text


def test_detalle_curso_expone_bloqueado_por_licencia(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """GET /cursos/{id} debe incluir bloqueado_por_licencia=True para estudiante sin licencia."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=False)
    _, headers = _create_org_user(db, client)

    r = client.get(f"{API}/cursos/{curso.id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["bloqueado_por_licencia"] is True


def test_listado_curso_expone_bloqueado_por_licencia(
    client: TestClient, db: Session, superuser_token_headers: dict
) -> None:
    """GET /cursos/ marca con bloqueado_por_licencia los NEXTGEN no gratuitos sin licencia."""
    instructor_id = _superuser_id(client, superuser_token_headers)
    curso_pago = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=False)
    curso_gratis = _create_curso(db, instructor_id, marca=MarcaCurso.NEXTGEN, es_gratis=True)
    _, headers = _create_org_user(db, client)

    r = client.get(f"{API}/cursos/?limit=200", headers=headers)
    assert r.status_code == 200
    by_id = {item["id"]: item for item in r.json()["data"]}
    assert by_id[str(curso_pago.id)]["bloqueado_por_licencia"] is True
    assert by_id[str(curso_gratis.id)]["bloqueado_por_licencia"] is False
