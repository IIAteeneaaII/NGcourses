"""Tests para los endpoints de cursos — con foco en upload de portada."""
import io
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app import crud
from app.core.config import settings
from app.models.contenido import Curso, CursoCreate
from tests.utils.utils import get_superuser_token_headers

API = settings.API_V1_STR

# IDs de cursos creados por estos tests — limpiados al teardown del módulo
_created_curso_ids: list[uuid.UUID] = []


# ── fixture de limpieza ───────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def cleanup_test_cursos(db: Session):
    """Elimina sólo los cursos creados por este módulo de tests."""
    yield
    for cid in _created_curso_ids:
        db_curso = db.get(Curso, cid)
        if db_curso:
            db.delete(db_curso)
    db.commit()
    _created_curso_ids.clear()


# ── helpers ──────────────────────────────────────────────────────────────────

def _create_curso(db: Session, instructor_id: uuid.UUID):
    curso_in = CursoCreate(
        titulo="Curso de prueba",
        slug=f"curso-prueba-{uuid.uuid4().hex[:8]}",
        descripcion="Descripción de prueba",
        estado="borrador",
        es_gratis=True,
    )
    curso = crud.create_curso(session=db, curso_in=curso_in, instructor_id=instructor_id)
    _created_curso_ids.append(curso.id)
    return curso


def _superuser_id(client: TestClient, headers: dict) -> uuid.UUID:
    r = client.post(f"{API}/login/test-token", headers=headers)
    return uuid.UUID(r.json()["id"])


# ── tests: cover upload ───────────────────────────────────────────────────────

class TestUploadCover:
    """Pruebas del endpoint POST /cursos/{id}/cover"""

    def test_upload_cover_jpeg_ok(
        self, client: TestClient, db: Session, superuser_token_headers: dict, tmp_path: Path
    ) -> None:
        """Subir un JPEG válido debe retornar 200 y actualizar portada_url."""
        instructor_id = _superuser_id(client, superuser_token_headers)
        curso = _create_curso(db, instructor_id)

        # Imagen JPEG mínima válida (1x1 px, 631 bytes)
        jpeg_bytes = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
            b'C  C\x00\x00\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
            b'\x00\x00\x00\x00\x00\x00\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01'
            b'\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01'
            b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07'
            b'\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03'
            b'\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!'
            b'1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1'
            b'\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJ'
            b'STUVWXYZ\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd3\xff\xd9'
        )

        covers_dir = tmp_path / "covers"

        with patch("app.api.routes.cursos.COVERS_DIR", str(covers_dir)):
            r = client.post(
                f"{API}/cursos/{curso.id}/cover",
                headers=superuser_token_headers,
                files={"file": ("portada.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            )

        assert r.status_code == 200, r.text
        data = r.json()
        assert "portada_url" in data
        assert data["portada_url"].startswith("/media/covers/")
        assert data["portada_url"].endswith(".jpg")

        # El archivo debe haberse guardado en tmp_path
        saved = covers_dir / f"{curso.id}.jpg"
        assert saved.exists()
        assert saved.read_bytes() == jpeg_bytes

    def test_upload_cover_invalid_type(
        self, client: TestClient, db: Session, superuser_token_headers: dict
    ) -> None:
        """Archivo que no es imagen debe retornar 400."""
        instructor_id = _superuser_id(client, superuser_token_headers)
        curso = _create_curso(db, instructor_id)

        r = client.post(
            f"{API}/cursos/{curso.id}/cover",
            headers=superuser_token_headers,
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        )
        assert r.status_code == 400
        assert "no permitido" in r.json()["detail"].lower()

    def test_upload_cover_too_large(
        self, client: TestClient, db: Session, superuser_token_headers: dict
    ) -> None:
        """Imagen mayor a 5 MB debe retornar 400."""
        instructor_id = _superuser_id(client, superuser_token_headers)
        curso = _create_curso(db, instructor_id)

        big_image = b"\xff\xd8" + b"\x00" * (5 * 1024 * 1024 + 1)  # > 5 MB, empieza con JPEG magic

        r = client.post(
            f"{API}/cursos/{curso.id}/cover",
            headers=superuser_token_headers,
            files={"file": ("grande.jpg", io.BytesIO(big_image), "image/jpeg")},
        )
        assert r.status_code == 400
        assert "5mb" in r.json()["detail"].lower()

    def test_upload_cover_curso_not_found(
        self, client: TestClient, superuser_token_headers: dict
    ) -> None:
        """Curso inexistente debe retornar 404."""
        fake_id = uuid.uuid4()
        r = client.post(
            f"{API}/cursos/{fake_id}/cover",
            headers=superuser_token_headers,
            files={"file": ("x.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")},
        )
        assert r.status_code == 404

    def test_upload_cover_unauthenticated(
        self, client: TestClient, db: Session, superuser_token_headers: dict
    ) -> None:
        """Sin token debe retornar 401."""
        instructor_id = _superuser_id(client, superuser_token_headers)
        curso = _create_curso(db, instructor_id)

        r = client.post(
            f"{API}/cursos/{curso.id}/cover",
            files={"file": ("x.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")},
        )
        assert r.status_code == 401

    def test_upload_cover_png_ok(
        self, client: TestClient, db: Session, superuser_token_headers: dict, tmp_path: Path
    ) -> None:
        """Un PNG válido debe guardarse con extensión .png."""
        instructor_id = _superuser_id(client, superuser_token_headers)
        curso = _create_curso(db, instructor_id)

        # PNG mínimo válido (1x1 px transparente)
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
            b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
            b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )

        covers_dir = tmp_path / "covers"

        with patch("app.api.routes.cursos.COVERS_DIR", str(covers_dir)):
            r = client.post(
                f"{API}/cursos/{curso.id}/cover",
                headers=superuser_token_headers,
                files={"file": ("portada.png", io.BytesIO(png_bytes), "image/png")},
            )

        assert r.status_code == 200, r.text
        data = r.json()
        assert data["portada_url"].endswith(".png")
