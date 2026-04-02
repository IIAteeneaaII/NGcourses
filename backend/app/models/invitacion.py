import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class InvitacionCurso(SQLModel, table=True):
    __tablename__ = "invitaciones_curso"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    curso_id: uuid.UUID = Field(
        foreign_key="cursos.id",
        nullable=False,
        index=True,
    )
    email: str = Field(max_length=255, index=True)
    token_hash: str = Field(max_length=64, index=True, unique=True)
    expira_en: datetime
    usado_en: datetime | None = Field(default=None)
    creado_por: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    creado_en: datetime = Field(default_factory=datetime.utcnow)
