"""add_precio_moneda_destacado_to_cursos

Revision ID: k9b6d7e8f3a2
Revises: j8a5c6d7e2f1
Create Date: 2026-04-27 12:00:00.000000

Sprint 2 (SOL-02):
- RF09: agrega `precio` (Decimal nullable) y `moneda` (VARCHAR(3) default 'MXN') a cursos.
- CP13: agrega `destacado` (Boolean default false) a cursos para el carrete dinamico.
"""
from alembic import op
import sqlalchemy as sa


revision = 'k9b6d7e8f3a2'
down_revision = 'j8a5c6d7e2f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cursos',
        sa.Column('precio', sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        'cursos',
        sa.Column(
            'moneda',
            sa.String(length=3),
            nullable=False,
            server_default='MXN',
        ),
    )
    op.add_column(
        'cursos',
        sa.Column(
            'destacado',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )


def downgrade():
    op.drop_column('cursos', 'destacado')
    op.drop_column('cursos', 'moneda')
    op.drop_column('cursos', 'precio')
