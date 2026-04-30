import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import EmailStr
from sqlmodel import SQLModel, col, delete, func, select

from app import crud
from app.api.deps import (
    AdminOrSuperuser,
    CurrentUser,
    SessionDep,
    require_admin_or_superuser,
)
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.models._enums import EstadoUsuario, RolOrganizacion, RolUsuario
from app.models.organizacion import UsuarioOrganizacion
from app.utils import generate_activacion_email, generate_new_account_email, send_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(require_admin_or_superuser)],
    response_model=UsersPublic,
)
def read_users(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    rol: RolUsuario | None = None,
    estado: EstadoUsuario | None = None,
    search: str | None = None,
) -> Any:
    """
    Retrieve users. Soporta filtros: ?rol=&estado=&search=
    """
    query = select(User)
    count_query = select(func.count()).select_from(User)

    filters = []
    if rol:
        filters.append(User.rol == rol)
    if estado:
        filters.append(User.estado == estado)
    if search:
        filters.append(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))  # type: ignore

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    count = session.exec(count_query).one()
    users = session.exec(query.offset(skip).limit(limit)).all()

    return UsersPublic(data=users, count=count)


@router.post("/", response_model=UserPublic)
def create_user(*, session: SessionDep, user_in: UserCreate, current_user: AdminOrSuperuser) -> Any:
    """
    Create new user.
    """
    # Evitar escalada de privilegios: solo un superusuario puede crear otros superusuarios
    if not current_user.is_superuser and user_in.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Solo el superusuario puede crear otros superusuarios",
        )

    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = crud.create_user(session=session, user_create=user_in)
    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """

    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Update own password.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


class UserOrgInfo(SQLModel):
    id: uuid.UUID
    nombre: str
    rol_org: str


class UserMePublic(UserPublic):
    organizacion: UserOrgInfo | None = None


@router.get("/me", response_model=UserMePublic)
def read_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """Get current user with organization info."""
    info = crud.get_organizacion_of_user(session=session, user_id=current_user.id)
    org_public: UserOrgInfo | None = None
    if info:
        org, rol_org = info
        org_public = UserOrgInfo(
            id=org.id, nombre=org.nombre,
            rol_org=rol_org.value if hasattr(rol_org, "value") else str(rol_org),
        )
    data = current_user.model_dump()
    return UserMePublic(**data, organizacion=org_public)


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """
    Create new user without the need to be logged in.
    """
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    user = crud.create_user(session=session, user_create=user_create)
    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser and current_user.rol != RolUsuario.ADMINISTRADOR:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(require_admin_or_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(require_admin_or_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    session.exec(delete(Item).where(col(Item.owner_id) == user_id))  # type: ignore
    session.exec(delete(UsuarioOrganizacion).where(col(UsuarioOrganizacion.usuario_id) == user_id))  # type: ignore
    session.delete(user)
    session.commit()
    return Message(message="User deleted successfully")


# ── RF-12: Alta de usuarios por empresa ────────────────────────────────────────

class UserEmpresaCreate(SQLModel):
    email: EmailStr
    full_name: str | None = None
    organizacion_id: uuid.UUID | None = None


class ActivarCuentaBody(SQLModel):
    token: str
    new_password: str


@router.post("/empresa", dependencies=[Depends(require_admin_or_superuser)], response_model=UserPublic)
def create_user_empresa(*, session: SessionDep, user_in: UserEmpresaCreate) -> Any:
    """
    Crea un usuario empresarial con estado pendiente_activacion.
    Envía correo con link de activación (72h).
    """
    existing = crud.get_user_by_email(session=session, email=user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo.")

    token = secrets.token_urlsafe(32)
    placeholder_password = secrets.token_urlsafe(16)

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(placeholder_password),
        rol=RolUsuario.ESTUDIANTE,
        estado=EstadoUsuario.PENDIENTE_ACTIVACION,
        is_active=False,
        token_activacion=token,
        token_activacion_expira=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    session.add(user)
    session.flush()  # INSERT user antes de la membresía para satisfacer el FK

    if user_in.organizacion_id:
        membresia = UsuarioOrganizacion(
            organizacion_id=user_in.organizacion_id,
            usuario_id=user.id,
            rol_org=RolOrganizacion.MIEMBRO,
        )
        session.add(membresia)

    session.commit()
    session.refresh(user)

    if settings.emails_enabled:
        email_data = generate_activacion_email(email_to=user.email, token=token)
        send_email(email_to=user.email, subject=email_data.subject, html_content=email_data.html_content)

    return user


@router.post("/activar", response_model=Message)
def activar_cuenta(session: SessionDep, body: ActivarCuentaBody) -> Any:
    """
    Ruta pública. El empleado establece su contraseña y activa su cuenta.
    El token se invalida al usarse (uso único).
    """
    user = session.exec(select(User).where(User.token_activacion == body.token)).first()

    if not user:
        raise HTTPException(status_code=400, detail="Token inválido")

    if user.token_activacion_expira is None or datetime.now(timezone.utc) > user.token_activacion_expira.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Token expirado")

    user.hashed_password = get_password_hash(body.new_password)
    user.estado = EstadoUsuario.ACTIVO
    user.is_active = True
    user.token_activacion = None
    user.token_activacion_expira = None
    session.add(user)
    session.commit()
    return Message(message="Cuenta activada correctamente")


@router.post("/{user_id}/reenviar-activacion", dependencies=[Depends(require_admin_or_superuser)], response_model=Message)
def reenviar_activacion(*, session: SessionDep, user_id: uuid.UUID) -> Any:
    """
    Regenera el token de activación y reenvía el correo.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.estado != EstadoUsuario.PENDIENTE_ACTIVACION:
        raise HTTPException(status_code=400, detail="El usuario ya activó su cuenta")

    token = secrets.token_urlsafe(32)
    user.token_activacion = token
    user.token_activacion_expira = datetime.now(timezone.utc) + timedelta(hours=72)
    session.add(user)
    session.commit()

    if settings.emails_enabled:
        email_data = generate_activacion_email(email_to=user.email, token=token)
        send_email(email_to=user.email, subject=email_data.subject, html_content=email_data.html_content)

    return Message(message="Correo de activación reenviado")
