# Re-export all models for backward compatibility.
# `from app.models import User` continues to work.
# Also ensures all table models are registered in SQLModel.metadata
# before Alembic inspects it.

from sqlmodel import SQLModel  # noqa: F401 – needed by alembic/env.py

from app.models._enums import *  # noqa: F401, F403
from app.models.calificacion import *  # noqa: F401, F403
from app.models.contenido import *  # noqa: F401, F403
from app.models.inscripcion import *  # noqa: F401, F403
from app.models.item import *  # noqa: F401, F403
from app.models.organizacion import *  # noqa: F401, F403
from app.models.schemas import *  # noqa: F401, F403
from app.models.invitacion import *  # noqa: F401, F403
from app.models.quiz import *  # noqa: F401, F403
from app.models.sistema import *  # noqa: F401, F403
from app.models.user import *  # noqa: F401, F403
