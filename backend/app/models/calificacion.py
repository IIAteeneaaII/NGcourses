import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import EstadoCalificacion

_estadocalificacion_type = sa.Enum(
    EstadoCalificacion,
    values_callable=lambda obj: [e.value for e in obj],
    name="estadocalificacion",
    create_type=False,
)


# ── Calificaciones ──────────────────────────────────────────────────────────


class Calificacion(SQLModel, table=True):
    __tablename__ = "calificaciones"
    __table_args__ = (UniqueConstraint("usuario_id", "curso_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    estrellas: int = Field(ge=1, le=5)
    titulo: str | None = Field(default=None, max_length=255)
    comentario: str | None = Field(default=None)
    estado: EstadoCalificacion = Field(
        default=EstadoCalificacion.PENDIENTE, sa_type=_estadocalificacion_type
    )
    creado_en: datetime = Field(default_factory=datetime.utcnow)
    actualizado_en: datetime | None = Field(default=None)

    # Relationships
    usuario: "User" = Relationship(back_populates="calificaciones")  # noqa: F821
    curso: "Curso" = Relationship(back_populates="calificaciones")  # noqa: F821
    votos: list["VotoResena"] = Relationship(
        back_populates="calificacion", cascade_delete=True
    )


# ── Votos de Resena ─────────────────────────────────────────────────────────


class VotoResena(SQLModel, table=True):
    __tablename__ = "votos_resena"
    __table_args__ = (UniqueConstraint("calificacion_id", "usuario_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    calificacion_id: uuid.UUID = Field(
        foreign_key="calificaciones.id", nullable=False, ondelete="CASCADE"
    )
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    voto: int = Field(ge=-1, le=1)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    calificacion: Calificacion = Relationship(back_populates="votos")
