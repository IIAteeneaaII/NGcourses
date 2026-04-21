import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import (
    CanalNotificacion,
    CategoriaEvento,
    EstadoNotificacion,
    ProveedorNotificacion,
    TipoNotificacion,
)


def _enum_type(enum_cls, name: str) -> sa.Enum:
    return sa.Enum(
        enum_cls,
        values_callable=lambda obj: [e.value for e in obj],
        name=name,
        create_type=False,
    )


_canalnotif_type = _enum_type(CanalNotificacion, "canalnotificacion")
_tiponotif_type = _enum_type(TipoNotificacion, "tiponotificacion")
_estadonotif_type = _enum_type(EstadoNotificacion, "estadonotificacion")
_proveedornotif_type = _enum_type(ProveedorNotificacion, "proveedornotificacion")
_categoriaevento_type = _enum_type(CategoriaEvento, "categoriaevento")


# ── Notificaciones ──────────────────────────────────────────────────────────


class Notificacion(SQLModel, table=True):
    __tablename__ = "notificaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    canal: CanalNotificacion = Field(sa_type=_canalnotif_type)
    tipo: TipoNotificacion = Field(sa_type=_tiponotif_type)
    titulo: str = Field(max_length=255)
    cuerpo: str | None = Field(default=None)
    estado: EstadoNotificacion = Field(
        default=EstadoNotificacion.PENDIENTE, sa_type=_estadonotif_type
    )
    proveedor: ProveedorNotificacion | None = Field(
        default=None, sa_type=_proveedornotif_type
    )
    proveedor_message_id: str | None = Field(default=None, max_length=255)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)
    enviado_en: datetime | None = Field(default=None)
    leido_en: datetime | None = Field(default=None)

    # Relationships
    usuario: "User" = Relationship(back_populates="notificaciones")  # noqa: F821


# ── Eventos del Sistema ─────────────────────────────────────────────────────


class EventoSistema(SQLModel, table=True):
    __tablename__ = "eventos_sistema"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    actor_usuario_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id"
    )
    categoria: CategoriaEvento = Field(sa_type=_categoriaevento_type)
    accion: str = Field(max_length=100)
    entidad: str | None = Field(default=None, max_length=100)
    entidad_id: uuid.UUID | None = Field(default=None)
    ip: str | None = Field(default=None, max_length=45)
    user_agent: str | None = Field(default=None)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)


# ── Refresh Tokens ──────────────────────────────────────────────────────────


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    token_hash: str = Field(index=True)
    expira_en: datetime
    revocado_en: datetime | None = Field(default=None)
    reemplazado_por_token_hash: str | None = Field(default=None)
    ip_creacion: str | None = Field(default=None, max_length=45)
    creado_en: datetime = Field(default_factory=datetime.utcnow)


# ── Eventos de Analytics ────────────────────────────────────────────────────


class EventoAnalytics(SQLModel, table=True):
    __tablename__ = "eventos_analytics"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    leccion_id: uuid.UUID = Field(foreign_key="lecciones.id", nullable=False)
    evento: str = Field(max_length=50)
    posicion_seg: int = Field(default=0)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    leccion: "Leccion" = Relationship(back_populates="eventos_analytics")  # noqa: F821
