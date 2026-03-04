import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class UUIDModel(SQLModel):
    """Mixin: UUID primary key."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class CreatedAtMixin(SQLModel):
    """Mixin: creado_en timestamp."""

    creado_en: datetime = Field(default_factory=datetime.utcnow)


class TimestampMixin(CreatedAtMixin):
    """Mixin: creado_en + actualizado_en timestamps."""

    actualizado_en: datetime | None = Field(default=None)
