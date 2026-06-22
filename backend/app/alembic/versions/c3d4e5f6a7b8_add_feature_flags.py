"""add feature_flags table

Tabla de interruptores de funcionalidad (feature flags) controlados por el admin
en runtime. Seed inicial: 'instructores' = false (rol instructor apagado por
defecto; se reactiva desde el panel de Configuración).

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-22 12:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'feature_flags',
        sa.Column('nombre', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('habilitado', sa.Boolean(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('nombre'),
    )
    # Seed: el rol instructor arranca apagado. Idempotente por si se re-aplica.
    op.execute(
        "INSERT INTO feature_flags (nombre, habilitado, actualizado_en) "
        "VALUES ('instructores', false, now()) "
        "ON CONFLICT (nombre) DO NOTHING"
    )


def downgrade():
    op.drop_table('feature_flags')
