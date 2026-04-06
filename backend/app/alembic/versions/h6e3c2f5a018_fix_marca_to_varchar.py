"""fix_marca_to_varchar

Revision ID: h6e3c2f5a018
Revises: g5d2b1e4f907
Create Date: 2026-04-06 12:30:00.000000

Convierte la columna marca de tipo PG enum a VARCHAR para evitar
incompatibilidad con la serialización de str-enum en SQLModel/psycopg3.
"""
from alembic import op
import sqlalchemy as sa

revision = 'h6e3c2f5a018'
down_revision = 'g5d2b1e4f907'
branch_labels = None
depends_on = None


def upgrade():
    # Quitar el server_default que depende del tipo enum antes de alterar
    op.execute("ALTER TABLE cursos ALTER COLUMN marca DROP DEFAULT")
    op.execute(
        "ALTER TABLE cursos ALTER COLUMN marca TYPE VARCHAR(20) "
        "USING marca::TEXT"
    )
    # Restaurar el default como string literal
    op.execute("ALTER TABLE cursos ALTER COLUMN marca SET DEFAULT 'ram'")
    op.execute("DROP TYPE IF EXISTS marcacurso CASCADE")


def downgrade():
    marcacurso = sa.Enum('ram', 'nextgen', name='marcacurso')
    marcacurso.create(op.get_bind(), checkfirst=True)
    op.execute(
        "ALTER TABLE cursos ALTER COLUMN marca TYPE marcacurso "
        "USING marca::marcacurso"
    )
