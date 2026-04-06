"""add_marca_to_cursos

Revision ID: g5d2b1e4f907
Revises: a1b2c3d4e5f6
Create Date: 2026-04-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'g5d2b1e4f907'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    marcacurso = sa.Enum('ram', 'nextgen', name='marcacurso')
    marcacurso.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'cursos',
        sa.Column(
            'marca',
            sa.Enum('ram', 'nextgen', name='marcacurso'),
            nullable=False,
            server_default='ram',
        ),
    )


def downgrade():
    op.drop_column('cursos', 'marca')
    sa.Enum(name='marcacurso').drop(op.get_bind(), checkfirst=True)
