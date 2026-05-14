import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.core import security
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import get_password_hash
from app.models import Message, NewPassword, Token, User, UserPublic
from app.utils import (
    generate_reset_password_email,
    send_email,
)

router = APIRouter(tags=["login"])


@router.post("/login/access-token", response_model=UserPublic)
@limiter.limit("5/minute")
def login_access_token(
    request: Request,
    response: Response,
    session: SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Any:
    """
    OAuth2 compatible token login. Emite cookie HttpOnly con el JWT (FND-003).
    """
    user = crud.authenticate(
        session=session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = security.create_access_token(user.id, expires_delta=access_token_expires)
    is_prod = settings.ENVIRONMENT != "local"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="strict" if is_prod else "lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return UserPublic.model_validate(user)


@router.post("/logout")
def logout(response: Response) -> Message:
    """Cierra sesión eliminando la cookie HttpOnly del JWT."""
    response.delete_cookie("access_token", path="/")
    return Message(message="Sesión cerrada")


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery/{email}")
@limiter.limit("3/hour")
def recover_password(request: Request, email: str, session: SessionDep) -> Message:
    """
    Password Recovery — genera token de un solo uso almacenado en DB.
    Respuesta uniforme para evitar user enumeration (FND-004).
    """
    user = crud.get_user_by_email(session=session, email=email)

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expira = datetime.now(timezone.utc) + timedelta(
            hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS
        )
        session.add(user)
        session.commit()

        email_data = generate_reset_password_email(
            email_to=user.email, email=email, token=token
        )
        send_email(
            email_to=user.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return Message(message="Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.")


@router.post("/reset-password/")
@limiter.limit("5/minute")
def reset_password(request: Request, session: SessionDep, body: NewPassword) -> Message:
    """
    Reset password — invalida el token al usarlo (uso único).
    """
    user = session.exec(
        select(User).where(User.password_reset_token == body.token)
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if user.password_reset_expira is None or datetime.now(timezone.utc) > user.password_reset_expira.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    user.hashed_password = get_password_hash(password=body.new_password)
    user.password_reset_token = None
    user.password_reset_expira = None
    session.add(user)
    session.commit()
    return Message(message="Password updated successfully")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    user = crud.get_user_by_email(session=session, email=email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )

    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )
