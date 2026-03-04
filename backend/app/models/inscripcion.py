import uuid
from datetime import datetime

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import EstadoInscripcion


# ── Inscripciones ───────────────────────────────────────────────────────────


class Inscripcion(SQLModel, table=True):
    __tablename__ = "inscripciones"
    __table_args__ = (UniqueConstraint("usuario_id", "curso_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    estado: EstadoInscripcion = Field(default=EstadoInscripcion.ACTIVA)
    inscrito_en: datetime = Field(default_factory=datetime.utcnow)
    ultimo_acceso_en: datetime | None = Field(default=None)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))

    # Relationships
    usuario: "User" = Relationship(back_populates="inscripciones")  # noqa: F821
    curso: "Curso" = Relationship(back_populates="inscripciones")  # noqa: F821
    progreso: list["ProgresoLeccion"] = Relationship(
        back_populates="inscripcion", cascade_delete=True
    )
    certificado: "Certificado | None" = Relationship(back_populates="inscripcion")


# ── Progreso de Lecciones ──────────────────────────────────────────────────


class ProgresoLeccion(SQLModel, table=True):
    __tablename__ = "progreso_lecciones"
    __table_args__ = (UniqueConstraint("inscripcion_id", "leccion_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inscripcion_id: uuid.UUID = Field(
        foreign_key="inscripciones.id", nullable=False, ondelete="CASCADE"
    )
    leccion_id: uuid.UUID = Field(foreign_key="lecciones.id", nullable=False)
    visto_seg: int = Field(default=0)
    progreso_pct: int = Field(default=0)
    completado: bool = Field(default=False)
    completado_en: datetime | None = Field(default=None)
    actualizado_en: datetime | None = Field(default=None)

    # Relationships
    inscripcion: Inscripcion = Relationship(back_populates="progreso")
    leccion: "Leccion" = Relationship(back_populates="progreso")  # noqa: F821


# ── Certificados ────────────────────────────────────────────────────────────


class Certificado(SQLModel, table=True):
    __tablename__ = "certificados"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inscripcion_id: uuid.UUID = Field(
        foreign_key="inscripciones.id", unique=True, nullable=False
    )
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    folio: str = Field(max_length=100, unique=True)
    url_pdf: str | None = Field(default=None)
    hash_verificacion: str | None = Field(default=None)
    emitido_en: datetime = Field(default_factory=datetime.utcnow)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))

    # Relationships
    inscripcion: Inscripcion = Relationship(back_populates="certificado")
    usuario: "User" = Relationship(back_populates="certificados")  # noqa: F821
    curso: "Curso" = Relationship()  # noqa: F821
