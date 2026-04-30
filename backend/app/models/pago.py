import uuid
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Column, Numeric, String
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import EstadoPago

_estadopago_type = sa.Enum(
    EstadoPago,
    values_callable=lambda obj: [e.value for e in obj],
    name="estadopago",
    create_type=False,
)


# ── Pagos (RF10/RF08) ──────────────────────────────────────────────────────


class Pago(SQLModel, table=True):
    __tablename__ = "pagos"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False, index=True)
    monto: Decimal = Field(
        sa_column=Column("monto", Numeric(10, 2), nullable=False),
    )
    moneda: str = Field(
        default="MXN",
        sa_column=Column("moneda", String(3), nullable=False, server_default="MXN"),
    )
    referencia_paypal: str | None = Field(default=None, max_length=255, index=True)
    status: EstadoPago = Field(
        default=EstadoPago.PENDIENTE, sa_type=_estadopago_type
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime | None = Field(default=None)

    usuario: "User" = Relationship()  # noqa: F821
    curso: "Curso" = Relationship()  # noqa: F821


# ── Schemas ────────────────────────────────────────────────────────────────


class PagoPublic(SQLModel):
    id: uuid.UUID
    usuario_id: uuid.UUID
    curso_id: uuid.UUID
    monto: Decimal
    moneda: str
    referencia_paypal: str | None = None
    status: EstadoPago
    created_at: datetime
    updated_at: datetime | None = None
    curso_titulo: str | None = None


class PagosPublic(SQLModel):
    data: list[PagoPublic]
    count: int


class CrearOrdenRequest(SQLModel):
    curso_id: uuid.UUID


class CrearOrdenResponse(SQLModel):
    pago_id: uuid.UUID
    paypal_order_id: str
    monto: Decimal
    moneda: str


class ConfirmarPagoRequest(SQLModel):
    pago_id: uuid.UUID
    paypal_order_id: str


class ConfirmarPagoResponse(SQLModel):
    pago_id: uuid.UUID
    status: EstadoPago
    inscripcion_id: uuid.UUID | None = None


class CortesiaRequest(SQLModel):
    usuario_id: uuid.UUID
    curso_id: uuid.UUID
