"""add_password_reset_token_to_user

Revision ID: k9b6d4e8f2a3
Revises: j8a5c6d7e2f1
Branch labels: None
Depends on: None
Create Date: 2026-04-27

Agrega campos para recuperación de contraseña de un solo uso.
El token se almacena en DB y se borra al usarse, garantizando uso único.
"""
from alembic import op
import sqlalchemy as sa

revision = 'k9b6d4e8f2a3'
down_revision = 'j8a5c6d7e2f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('password_reset_token', sa.VARCHAR(255), nullable=True))
    op.add_column('user', sa.Column('password_reset_expira', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('user', 'password_reset_expira')
    op.drop_column('user', 'password_reset_token')
