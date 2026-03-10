"""add_portada_url_to_cursos

Revision ID: a1b2c3d4e5f6
Revises: c4d1e9f3a078
Create Date: 2026-03-09 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'c4d1e9f3a078'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cursos',
        sa.Column('portada_url', sa.String(length=500), nullable=True),
    )


def downgrade():
    op.drop_column('cursos', 'portada_url')
