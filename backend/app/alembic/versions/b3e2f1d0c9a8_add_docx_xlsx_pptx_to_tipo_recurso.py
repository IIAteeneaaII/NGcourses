"""add_docx_xlsx_pptx_to_tipo_recurso

Revision ID: b3e2f1d0c9a8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-19 01:00:00.000000

"""
from alembic import op

revision = 'b3e2f1d0c9a8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL requires COMMIT before adding enum values
    op.execute("COMMIT")
    op.execute("ALTER TYPE tiporecurso ADD VALUE IF NOT EXISTS 'DOCX'")
    op.execute("ALTER TYPE tiporecurso ADD VALUE IF NOT EXISTS 'XLSX'")
    op.execute("ALTER TYPE tiporecurso ADD VALUE IF NOT EXISTS 'PPTX'")


def downgrade():
    # PostgreSQL does not support removing enum values directly
    pass
