from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import SessionDep
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    User,
    UserPublic,
)


def _require_local_env() -> None:
    if settings.ENVIRONMENT != "local":
        raise HTTPException(status_code=404, detail="Not found")


router = APIRouter(tags=["private"], prefix="/private", dependencies=[Depends(_require_local_env)])


class PrivateUserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    is_verified: bool = False


@router.post("/users/", response_model=UserPublic)
def create_user(user_in: PrivateUserCreate, session: SessionDep) -> Any:
    """
    Create a new user.
    """

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
    )

    session.add(user)
    session.commit()

    return user
