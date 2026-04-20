import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import (
    EstadoLicencia,
    EstadoOrganizacion,
    EstadoSolicitud,
    RolOrganizacion,
)

def _ev(obj):
    return [e.value for e in obj]

_estadoorg_type = sa.Enum(EstadoOrganizacion, values_callable=_ev, name="estadoorganizacion", create_type=False)
_rolorg_type = sa.Enum(RolOrganizacion, values_callable=_ev, name="rolorganizacion", create_type=False)
_estadolic_type = sa.Enum(EstadoLicencia, values_callable=_ev, name="estadolicencia", create_type=False)
_estadosol_type = sa.Enum(EstadoSolicitud, values_callable=_ev, name="estadosolicitud", create_type=False)


# ── Organizaciones ──────────────────────────────────────────────────────────


class Organizacion(SQLModel, table=True):
    __tablename__ = "organizaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(max_length=255)
    rfc: str | None = Field(default=None, max_length=20)
    dominio_corporativo: str | None = Field(default=None, max_length=255)
    estado: EstadoOrganizacion = Field(default=EstadoOrganizacion.ACTIVA, sa_type=_estadoorg_type)
    email_contacto: str | None = Field(default=None, max_length=255)
    telefono_contacto: str | None = Field(default=None, max_length=20)
    plan_de_cursos: str | None = Field(default=None)
    fecha_compra: datetime | None = Field(default=None)
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
    rol_org: RolOrganizacion = Field(default=RolOrganizacion.MIEMBRO, sa_type=_rolorg_type)
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
    estado: EstadoLicencia = Field(default=EstadoLicencia.ACTIVA, sa_type=_estadolic_type)
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
    estado: EstadoSolicitud = Field(default=EstadoSolicitud.ABIERTA, sa_type=_estadosol_type)
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
