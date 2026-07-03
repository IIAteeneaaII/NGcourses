"""add resumen column to lecciones

Campo informativo de resumen de la lección: lo llena el editor (admin/instructor)
y el alumno lo ve en la pestaña "Resumen" del reproductor. Nullable (opcional).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-03 13:45:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('lecciones', sa.Column('resumen', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('lecciones', 'resumen')
