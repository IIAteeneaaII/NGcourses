"""add cursos globales (tipo, curso_padre_id, orden_en_padre)

Un curso "global" agrupa cursos existentes como subcursos. Solo agrega
columnas con valores por defecto: todos los cursos que ya existen quedan como
"individual", sin padre y con orden 0, así que su comportamiento no cambia.

Revision ID: b8c9d0e1f2a3
Revises: f6a7b8c9d0e1
Create Date: 2026-11-10 16:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b8c9d0e1f2a3'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cursos',
        sa.Column('tipo', sa.String(length=20), nullable=False, server_default='individual'),
    )
    op.add_column(
        'cursos',
        sa.Column('curso_padre_id', sa.Uuid(), nullable=True),
    )
    op.add_column(
        'cursos',
        sa.Column('orden_en_padre', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_foreign_key(
        'cursos_curso_padre_id_fkey', 'cursos', 'cursos',
        ['curso_padre_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_cursos_curso_padre_id', 'cursos', ['curso_padre_id'])


def downgrade():
    op.drop_index('ix_cursos_curso_padre_id', table_name='cursos')
    op.drop_constraint('cursos_curso_padre_id_fkey', 'cursos', type_='foreignkey')
    op.drop_column('cursos', 'orden_en_padre')
    op.drop_column('cursos', 'curso_padre_id')
    op.drop_column('cursos', 'tipo')
