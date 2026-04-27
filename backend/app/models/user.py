import uuid
from datetime import datetime

import sqlalchemy as sa
from pydantic import EmailStr
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import EstadoUsuario, RolUsuario

_rol_type = sa.Enum(RolUsuario, values_callable=lambda obj: [e.value for e in obj], name="rolusuario", create_type=False)
_estado_type = sa.Enum(EstadoUsuario, values_callable=lambda obj: [e.value for e in obj], name="estadousuario", create_type=False)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    rol: RolUsuario = Field(default=RolUsuario.ESTUDIANTE, sa_type=_rol_type)
    estado: EstadoUsuario = Field(default=EstadoUsuario.ACTIVO, sa_type=_estado_type)
    telefono: str | None = Field(default=None, max_length=20)
    telefono_e164: str | None = Field(default=None, max_length=20)
    whatsapp_opt_in: bool = Field(default=False)
    notif_prefs: dict | None = Field(default=None, sa_column=Column(JSONB))


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=20)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    password_reset_token: str | None = Field(default=None, max_length=255)
    password_reset_expira: datetime | None = Field(default=None)
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)  # noqa: F821
    # Relationships
    cursos_instructor: list["Curso"] = Relationship(back_populates="instructor")  # noqa: F821
    inscripciones: list["Inscripcion"] = Relationship(back_populates="usuario")  # noqa: F821
    calificaciones: list["Calificacion"] = Relationship(back_populates="usuario")  # noqa: F821
    certificados: list["Certificado"] = Relationship(back_populates="usuario")  # noqa: F821
    notificaciones: list["Notificacion"] = Relationship(back_populates="usuario")  # noqa: F821


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int
