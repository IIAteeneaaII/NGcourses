"""add invitaciones_curso table

Revision ID: e1f2a3b4c5d6
Revises: a4f7b2c9d1e8
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'a4f7b2c9d1e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'invitaciones_curso',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('curso_id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expira_en', sa.DateTime(), nullable=False),
        sa.Column('usado_en', sa.DateTime(), nullable=True),
        sa.Column('creado_por', sa.Uuid(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['creado_por'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index('ix_invitaciones_curso_curso_id', 'invitaciones_curso', ['curso_id'])
    op.create_index('ix_invitaciones_curso_email', 'invitaciones_curso', ['email'])
    op.create_index(
        'ix_invitaciones_curso_token_hash', 'invitaciones_curso', ['token_hash'], unique=True
    )


def downgrade() -> None:
    op.drop_index('ix_invitaciones_curso_token_hash', table_name='invitaciones_curso')
    op.drop_index('ix_invitaciones_curso_email', table_name='invitaciones_curso')
    op.drop_index('ix_invitaciones_curso_curso_id', table_name='invitaciones_curso')
    op.drop_table('invitaciones_curso')
