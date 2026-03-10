"""add_bunny_library_id_to_cursos

Revision ID: f3c1a8b2d905
Revises: ad555931d588
Create Date: 2026-03-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3c1a8b2d905'
down_revision = 'ad555931d588'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cursos',
        sa.Column('bunny_library_id', sa.String(length=50), nullable=True),
    )


def downgrade():
    op.drop_column('cursos', 'bunny_library_id')
