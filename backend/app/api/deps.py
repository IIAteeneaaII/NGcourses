from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import TokenPayload, User
from app.models._enums import RolUsuario

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


# ISO 25010 §6.5 Mantenibilidad: dependency reutilizable para control de roles,
# evita duplicación del mismo bloque en cursos.py, quiz.py, etc.
_INSTRUCTOR_ROLES = {RolUsuario.INSTRUCTOR, RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL}


def require_instructor_or_above(current_user: CurrentUser) -> User:
    """Dependency: rechaza con 403 si el usuario no es instructor, admin o usuario_control."""
    if not current_user.is_superuser and current_user.rol not in _INSTRUCTOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de instructor o administrador",
        )
    return current_user


InstructorOrAbove = Annotated[User, Depends(require_instructor_or_above)]


def require_admin_or_superuser(current_user: CurrentUser) -> User:
    """Dependency: permite acceso a administradores del sistema y superusuarios.
    Diferencia con get_current_active_superuser: también acepta rol ADMINISTRADOR
    aunque is_superuser sea False (usuarios admin creados desde el panel).
    """
    if not current_user.is_superuser and current_user.rol != RolUsuario.ADMINISTRADOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador",
        )
    return current_user


AdminOrSuperuser = Annotated[User, Depends(require_admin_or_superuser)]


_SUPERVISOR_ROLES = {
    RolUsuario.SUPERVISOR,
    RolUsuario.ADMINISTRADOR,
    RolUsuario.USUARIO_CONTROL,
}


def require_supervisor_or_above(current_user: CurrentUser) -> User:
    """Dependency: rechaza con 403 si el usuario no es supervisor, admin o usuario_control."""
    if not current_user.is_superuser and current_user.rol not in _SUPERVISOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de supervisor o administrador",
        )
    return current_user


SupervisorOrAbove = Annotated[User, Depends(require_supervisor_or_above)]
