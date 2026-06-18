"""add 'rechazado' value to estadocurso enum

Permite que el admin rechace un curso sin borrarlo: el curso queda en estado
'rechazado' (conservado) en lugar de eliminarse físicamente.

Revision ID: b2c3d4e5f6a7
Revises: 1a11599a9554
Create Date: 2026-06-18 12:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = '1a11599a9554'
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de un bloque de
    # transacción en algunas versiones; en PG 12+ se permite siempre que el
    # valor nuevo no se use en la misma transacción (aquí solo se agrega).
    op.execute("ALTER TYPE estadocurso ADD VALUE IF NOT EXISTS 'rechazado'")


def downgrade():
    # Postgres no soporta quitar un valor de un enum de forma directa.
    # El downgrade se deja como no-op intencional (el valor sobrante es inofensivo).
    pass
