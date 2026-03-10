"""add_bunny_collection_id_to_cursos

Revision ID: c4d1e9f3a078
Revises: b7e9f2c1a034
Create Date: 2026-03-09 00:02:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d1e9f3a078'
down_revision = 'b7e9f2c1a034'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cursos',
        sa.Column('bunny_collection_id', sa.String(length=100), nullable=True),
    )


def downgrade():
    op.drop_column('cursos', 'bunny_collection_id')
