"""rf12_activacion_usuario

Revision ID: l0c7e5f9b2d1
Revises: k9b6d4e8f2a3
Branch labels: None
Depends on: None
Create Date: 2026-04-27

RF-12: Alta de usuarios por empresa.
- Agrega valor 'pendiente_activacion' al enum estadousuario
- Agrega token_activacion y token_activacion_expira a tabla user
"""
from alembic import op
import sqlalchemy as sa

revision = 'l0c7e5f9b2d1'
down_revision = 'k9b6d4e8f2a3'
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE no puede correr dentro de una transacción en PostgreSQL
    op.execute("ALTER TYPE estadousuario ADD VALUE IF NOT EXISTS 'pendiente_activacion'")
    op.add_column('user', sa.Column('token_activacion', sa.VARCHAR(255), nullable=True))
    op.add_column('user', sa.Column('token_activacion_expira', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('user', 'token_activacion_expira')
    op.drop_column('user', 'token_activacion')
    # No se puede eliminar un valor de un enum en PostgreSQL sin recrear el tipo
