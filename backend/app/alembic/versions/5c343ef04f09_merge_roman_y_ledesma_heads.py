"""merge roman y ledesma heads

Revision ID: 5c343ef04f09
Revises: l0c7e8f9g4b3, l0c7e5f9b2d1
Create Date: 2026-04-30 11:24:06.617705

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '5c343ef04f09'
down_revision = ('l0c7e8f9g4b3', 'l0c7e5f9b2d1')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
