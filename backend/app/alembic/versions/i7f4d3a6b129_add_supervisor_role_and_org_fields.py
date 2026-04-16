"""add_supervisor_role_and_org_fields

Revision ID: i7f4d3a6b129
Revises: h6e3c2f5a018
Create Date: 2026-04-16 10:00:00.000000

- Agrega valor SUPERVISOR al enum rolusuario.
- Agrega campos de contacto / plan / fecha_compra a organizaciones.
"""
from alembic import op
import sqlalchemy as sa


revision = 'i7f4d3a6b129'
down_revision = 'h6e3c2f5a018'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agregar valor SUPERVISOR al enum rolusuario.
    # ALTER TYPE ... ADD VALUE no se puede ejecutar dentro de una transacción
    # en PG < 12; se usa COMMIT + ALTER para compatibilidad.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE rolusuario ADD VALUE IF NOT EXISTS 'SUPERVISOR'")

    # 2. Agregar campos nuevos a organizaciones
    op.add_column(
        'organizaciones',
        sa.Column('email_contacto', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'organizaciones',
        sa.Column('telefono_contacto', sa.String(length=20), nullable=True),
    )
    op.add_column(
        'organizaciones',
        sa.Column('plan_de_cursos', sa.Text(), nullable=True),
    )
    op.add_column(
        'organizaciones',
        sa.Column('fecha_compra', sa.DateTime(), nullable=True),
    )


def downgrade():
    # Revertir campos de organizaciones
    op.drop_column('organizaciones', 'fecha_compra')
    op.drop_column('organizaciones', 'plan_de_cursos')
    op.drop_column('organizaciones', 'telefono_contacto')
    op.drop_column('organizaciones', 'email_contacto')

    # Revertir el enum: PG no soporta DROP VALUE, se recrea el tipo.
    op.execute("ALTER TYPE rolusuario RENAME TO rolusuario_old")
    op.execute(
        "CREATE TYPE rolusuario AS ENUM "
        "('ESTUDIANTE', 'INSTRUCTOR', 'USUARIO_CONTROL', 'ADMINISTRADOR')"
    )
    op.execute(
        "ALTER TABLE \"user\" ALTER COLUMN rol TYPE rolusuario "
        "USING rol::text::rolusuario"
    )
    op.execute("DROP TYPE rolusuario_old")
