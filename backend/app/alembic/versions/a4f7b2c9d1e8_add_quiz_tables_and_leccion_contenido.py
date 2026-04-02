"""add quiz tables and leccion contenido

Revision ID: a4f7b2c9d1e8
Revises: b3e2f1d0c9a8
Create Date: 2026-03-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a4f7b2c9d1e8'
down_revision = 'b3e2f1d0c9a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar campo contenido a lecciones (para quiz data JSON)
    op.add_column('lecciones', sa.Column('contenido', sa.Text(), nullable=True))

    # Crear tabla quiz_intentos
    op.create_table(
        'quiz_intentos',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('inscripcion_id', sa.Uuid(), nullable=False),
        sa.Column('leccion_id', sa.Uuid(), nullable=False),
        sa.Column('aprobado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('total_preguntas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('correctas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['inscripcion_id'], ['inscripciones.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leccion_id'], ['lecciones.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_quiz_intentos_inscripcion_leccion', 'quiz_intentos', ['inscripcion_id', 'leccion_id'])

    # Crear tabla quiz_respuestas
    op.create_table(
        'quiz_respuestas',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('intento_id', sa.Uuid(), nullable=False),
        sa.Column('pregunta_id', sa.String(length=100), nullable=False),
        sa.Column('opcion_id', sa.String(length=100), nullable=False),
        sa.Column('es_correcta', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['intento_id'], ['quiz_intentos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('quiz_respuestas')
    op.drop_index('ix_quiz_intentos_inscripcion_leccion', table_name='quiz_intentos')
    op.drop_table('quiz_intentos')
    op.drop_column('lecciones', 'contenido')
