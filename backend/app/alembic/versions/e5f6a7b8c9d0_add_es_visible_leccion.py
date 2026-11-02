"""add es_visible column to lecciones

Toggle del editor (admin/instructor) para habilitar/deshabilitar una lección:
oculta no se muestra al alumno ni cuenta para progreso/certificado.
Las lecciones existentes quedan visibles (server_default true).

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-02 13:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'lecciones',
        sa.Column('es_visible', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_column('lecciones', 'es_visible')
