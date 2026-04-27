"""add_pagos_table

Revision ID: l0c7e8f9g4b3
Revises: k9b6d7e8f3a2
Create Date: 2026-04-27 13:30:00.000000

Sprint 2 (SOL-02) — RF10/RF08:
- Crea enum `estadopago` (pendiente | completado | fallido | cortesia).
- Crea tabla `pagos` para registrar transacciones PayPal y desbloqueos por cortesia.
- Indices en usuario_id y curso_id para queries de "mis compras" y validacion de acceso.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'l0c7e8f9g4b3'
down_revision = 'k9b6d7e8f3a2'
branch_labels = None
depends_on = None


_estadopago_values = ('pendiente', 'completado', 'fallido', 'cortesia')


def upgrade():
    # Crear el enum solo si no existe (idempotente). PostgreSQL no soporta
    # IF NOT EXISTS en CREATE TYPE, asi que envolvemos en un bloque DO.
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE estadopago AS ENUM ('pendiente', 'completado', 'fallido', 'cortesia'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    )

    # Usamos postgresql.ENUM con create_type=False para que SQLAlchemy NO intente
    # emitir CREATE TYPE al construir el CREATE TABLE (el enum ya existe por el DO arriba).
    estadopago = postgresql.ENUM(
        *_estadopago_values, name='estadopago', create_type=False,
    )

    op.create_table(
        'pagos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('usuario_id', sa.UUID(), nullable=False),
        sa.Column('curso_id', sa.UUID(), nullable=False),
        sa.Column('monto', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            'moneda',
            sa.String(length=3),
            nullable=False,
            server_default='MXN',
        ),
        sa.Column('referencia_paypal', sa.String(length=255), nullable=True),
        sa.Column(
            'status',
            estadopago,
            nullable=False,
            server_default='pendiente',
        ),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['usuario_id'], ['user.id']),
        sa.ForeignKeyConstraint(['curso_id'], ['cursos.id']),
    )
    op.create_index('ix_pagos_usuario_id', 'pagos', ['usuario_id'])
    op.create_index('ix_pagos_curso_id', 'pagos', ['curso_id'])
    op.create_index('ix_pagos_referencia_paypal', 'pagos', ['referencia_paypal'])


def downgrade():
    op.drop_index('ix_pagos_referencia_paypal', table_name='pagos')
    op.drop_index('ix_pagos_curso_id', table_name='pagos')
    op.drop_index('ix_pagos_usuario_id', table_name='pagos')
    op.drop_table('pagos')
    op.execute('DROP TYPE IF EXISTS estadopago')
