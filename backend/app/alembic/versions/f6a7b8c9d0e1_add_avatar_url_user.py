"""add avatar_url column to user

Foto de perfil guardada en el servidor (volumen de media) en lugar del
navegador. Columna nullable: los usuarios existentes quedan sin foto y la
interfaz muestra sus iniciales.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-04 10:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('avatar_url', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('user', 'avatar_url')
