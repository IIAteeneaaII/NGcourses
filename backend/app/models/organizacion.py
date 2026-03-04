import uuid
from datetime import datetime

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import (
    EstadoLicencia,
    EstadoOrganizacion,
    EstadoSolicitud,
    RolOrganizacion,
)


# ── Organizaciones ──────────────────────────────────────────────────────────


class Organizacion(SQLModel, table=True):
    __tablename__ = "organizaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(max_length=255)
    rfc: str | None = Field(default=None, max_length=20)
    dominio_corporativo: str | None = Field(default=None, max_length=255)
    estado: EstadoOrganizacion = Field(default=EstadoOrganizacion.ACTIVA)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    usuarios: list["UsuarioOrganizacion"] = Relationship(
        back_populates="organizacion", cascade_delete=True
    )
    licencias: list["LicenciaCurso"] = Relationship(
        back_populates="organizacion", cascade_delete=True
    )
    solicitudes: list["SolicitudCurso"] = Relationship(
        back_populates="organizacion", cascade_delete=True
    )


# ── Usuarios-Organizacion (junction) ──────────────────────────────────────


class UsuarioOrganizacion(SQLModel, table=True):
    __tablename__ = "usuarios_organizacion"
    __table_args__ = (UniqueConstraint("organizacion_id", "usuario_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organizacion_id: uuid.UUID = Field(
        foreign_key="organizaciones.id", nullable=False, ondelete="CASCADE"
    )
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    rol_org: RolOrganizacion = Field(default=RolOrganizacion.MIEMBRO)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    organizacion: Organizacion = Relationship(back_populates="usuarios")


# ── Licencias de Curso ─────────────────────────────────────────────────────


class LicenciaCurso(SQLModel, table=True):
    __tablename__ = "licencias_curso"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organizacion_id: uuid.UUID = Field(
        foreign_key="organizaciones.id", nullable=False, ondelete="CASCADE"
    )
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    cupos_total: int = Field(default=0)
    cupos_usados: int = Field(default=0)
    inicia_en: datetime | None = Field(default=None)
    termina_en: datetime | None = Field(default=None)
    estado: EstadoLicencia = Field(default=EstadoLicencia.ACTIVA)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    organizacion: Organizacion = Relationship(back_populates="licencias")
    curso: "Curso" = Relationship(back_populates="licencias")  # noqa: F821


# ── Solicitudes de Curso ───────────────────────────────────────────────────


class SolicitudCurso(SQLModel, table=True):
    __tablename__ = "solicitudes_curso"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organizacion_id: uuid.UUID = Field(
        foreign_key="organizaciones.id", nullable=False, ondelete="CASCADE"
    )
    solicitante_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    titulo_solicitud: str = Field(max_length=255)
    descripcion: str | None = Field(default=None)
    estado: EstadoSolicitud = Field(default=EstadoSolicitud.ABIERTA)
    creado_en: datetime = Field(default_factory=datetime.utcnow)
    actualizado_en: datetime | None = Field(default=None)

    # Relationships
    organizacion: Organizacion = Relationship(back_populates="solicitudes")
    comentarios: list["ComentarioSolicitud"] = Relationship(
        back_populates="solicitud", cascade_delete=True
    )


# ── Comentarios de Solicitud ───────────────────────────────────────────────


class ComentarioSolicitud(SQLModel, table=True):
    __tablename__ = "comentarios_solicitud"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    solicitud_id: uuid.UUID = Field(
        foreign_key="solicitudes_curso.id", nullable=False, ondelete="CASCADE"
    )
    autor_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    comentario: str
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    solicitud: SolicitudCurso = Relationship(back_populates="comentarios")
