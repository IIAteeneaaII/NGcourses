"""make_categoria_id_nullable_in_cursos

Revision ID: b7e9f2c1a034
Revises: f3c1a8b2d905
Create Date: 2026-03-09 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b7e9f2c1a034'
down_revision = 'f3c1a8b2d905'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'cursos',
        'categoria_id',
        existing_type=sa.UUID(),
        nullable=True,
    )


def downgrade():
    op.alter_column(
        'cursos',
        'categoria_id',
        existing_type=sa.UUID(),
        nullable=False,
    )
