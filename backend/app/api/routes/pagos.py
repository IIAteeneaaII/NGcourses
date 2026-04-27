"""
Rutas de pagos (RF10/RF08).

Flujo PayPal:
  1. POST /pagos/crear-orden { curso_id }
     -> Backend valida precio del curso, crea Pago(status=pendiente),
        crea orden en PayPal y retorna { pago_id, paypal_order_id }.
  2. Frontend abre el flujo de PayPal con paypal_order_id, usuario aprueba.
  3. POST /pagos/confirmar { pago_id, paypal_order_id }
     -> Backend captura la orden en PayPal. Si COMPLETED:
        - Pago.status = completado
        - Crea Inscripcion (si no existia)
        Si falla: Pago.status = fallido.

Cortesia:
  POST /admin/pagos/cortesia { usuario_id, curso_id }
  -> Crea Pago(status=cortesia, monto=0) e Inscripcion. Solo admin.

Historial alumno:
  GET /pagos/mis-compras -> lista de pagos del usuario autenticado.
"""
import logging
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import AdminOrSuperuser, CurrentUser, SessionDep
from app.models._enums import EstadoPago
from app.models.contenido import Curso
from app.models.pago import (
    ConfirmarPagoRequest,
    ConfirmarPagoResponse,
    CortesiaRequest,
    CrearOrdenRequest,
    CrearOrdenResponse,
    PagoPublic,
    PagosPublic,
)
from app.services import paypal as paypal_svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagos", tags=["pagos"])


def _validar_curso_pagable(session: SessionDep, curso_id: uuid.UUID) -> Curso:
    curso = crud.get_curso(session=session, curso_id=curso_id)
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    if curso.precio is None or Decimal(curso.precio) <= 0:
        raise HTTPException(
            status_code=400,
            detail="Este curso es gratuito; no requiere pago",
        )
    return curso


@router.post("/crear-orden", response_model=CrearOrdenResponse, status_code=201)
def crear_orden(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: CrearOrdenRequest,
) -> Any:
    """Crea una orden PayPal y un Pago(pendiente) asociado al usuario y curso."""
    if not paypal_svc.settings.paypal_enabled:
        raise HTTPException(
            status_code=503,
            detail="PayPal no esta configurado en el servidor",
        )

    curso = _validar_curso_pagable(session, body.curso_id)

    # Si el alumno ya tiene un pago COMPLETADO o CORTESIA para este curso, no permitir otra orden.
    if crud.usuario_tiene_pago_completado(
        session=session, usuario_id=current_user.id, curso_id=body.curso_id
    ):
        raise HTTPException(status_code=409, detail="Ya tienes acceso a este curso")

    monto = Decimal(curso.precio)  # type: ignore[arg-type]
    moneda = curso.moneda or "MXN"

    # 1) Crear el registro local primero (en estado pendiente)
    pago = crud.create_pago_pendiente(
        session=session,
        usuario_id=current_user.id,
        curso_id=curso.id,
        monto=monto,
        moneda=moneda,
        status=EstadoPago.PENDIENTE,
    )

    # 2) Crear orden en PayPal
    try:
        order = paypal_svc.create_order(
            monto=monto,
            moneda=moneda,
            descripcion=f"NGcourses — {curso.titulo}",
            reference_id=str(pago.id),
        )
    except paypal_svc.PayPalError as e:
        logger.error("PayPal create_order fallo para pago %s: %s", pago.id, e)
        crud.update_pago_status(session=session, pago=pago, status=EstadoPago.FALLIDO)
        raise HTTPException(status_code=502, detail=f"PayPal: {e}") from e

    paypal_order_id = order.get("id")
    if not paypal_order_id:
        crud.update_pago_status(session=session, pago=pago, status=EstadoPago.FALLIDO)
        raise HTTPException(status_code=502, detail="PayPal no devolvio order id")

    # Persistir referencia
    crud.update_pago_status(
        session=session,
        pago=pago,
        status=EstadoPago.PENDIENTE,
        referencia_paypal=paypal_order_id,
    )

    return CrearOrdenResponse(
        pago_id=pago.id,
        paypal_order_id=paypal_order_id,
        monto=monto,
        moneda=moneda,
    )


@router.post("/confirmar", response_model=ConfirmarPagoResponse)
def confirmar_pago(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: ConfirmarPagoRequest,
) -> Any:
    """Captura la orden en PayPal y, si exitoso, marca pago=completado y crea Inscripcion."""
    pago = crud.get_pago_by_id(session=session, pago_id=body.pago_id)
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if pago.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este pago")
    if pago.status == EstadoPago.COMPLETADO:
        # Idempotencia: si ya esta completado, devolver inscripcion existente
        insc = crud.get_inscripcion_by_usuario_curso(
            session=session, usuario_id=pago.usuario_id, curso_id=pago.curso_id
        )
        return ConfirmarPagoResponse(
            pago_id=pago.id,
            status=pago.status,
            inscripcion_id=insc.id if insc else None,
        )

    try:
        capture = paypal_svc.capture_order(body.paypal_order_id)
    except paypal_svc.PayPalError as e:
        logger.error("PayPal capture_order fallo para pago %s: %s", pago.id, e)
        crud.update_pago_status(session=session, pago=pago, status=EstadoPago.FALLIDO)
        raise HTTPException(status_code=502, detail=f"PayPal: {e}") from e

    paypal_status = (capture.get("status") or "").upper()
    if paypal_status != "COMPLETED":
        crud.update_pago_status(session=session, pago=pago, status=EstadoPago.FALLIDO)
        raise HTTPException(
            status_code=402,
            detail=f"PayPal no completo el cobro (status={paypal_status})",
        )

    # Marcar pago completado
    pago = crud.update_pago_status(
        session=session,
        pago=pago,
        status=EstadoPago.COMPLETADO,
        referencia_paypal=body.paypal_order_id,
    )

    # Crear inscripcion si no existe
    insc = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=pago.usuario_id, curso_id=pago.curso_id
    )
    if not insc:
        insc = crud.create_inscripcion(
            session=session, usuario_id=pago.usuario_id, curso_id=pago.curso_id
        )

    return ConfirmarPagoResponse(
        pago_id=pago.id,
        status=pago.status,
        inscripcion_id=insc.id,
    )


@router.get("/mis-compras", response_model=PagosPublic)
def mis_compras(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Historial de pagos del usuario autenticado. Incluye titulo del curso."""
    pagos, count = crud.get_pagos_usuario(
        session=session, usuario_id=current_user.id, skip=skip, limit=limit
    )
    items: list[PagoPublic] = []
    for p in pagos:
        titulo = p.curso.titulo if p.curso else None
        items.append(
            PagoPublic(
                id=p.id,
                usuario_id=p.usuario_id,
                curso_id=p.curso_id,
                monto=p.monto,
                moneda=p.moneda,
                referencia_paypal=p.referencia_paypal,
                status=p.status,
                created_at=p.created_at,
                updated_at=p.updated_at,
                curso_titulo=titulo,
            )
        )
    return PagosPublic(data=items, count=count)


# ── Admin: cortesia ────────────────────────────────────────────────────────


@router.post("/admin/cortesia", response_model=ConfirmarPagoResponse, status_code=201)
def cortesia(
    *,
    session: SessionDep,
    current_user: AdminOrSuperuser,  # noqa: ARG001 — solo valida rol
    body: CortesiaRequest,
) -> Any:
    """Desbloqueo manual sin pago. Registra Pago(status=cortesia, monto=0) y crea Inscripcion."""
    curso = crud.get_curso(session=session, curso_id=body.curso_id)
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    if crud.usuario_tiene_pago_completado(
        session=session, usuario_id=body.usuario_id, curso_id=body.curso_id
    ):
        raise HTTPException(status_code=409, detail="El usuario ya tiene acceso a este curso")

    pago = crud.create_pago_pendiente(
        session=session,
        usuario_id=body.usuario_id,
        curso_id=body.curso_id,
        monto=Decimal("0.00"),
        moneda=curso.moneda or "MXN",
        status=EstadoPago.CORTESIA,
    )

    insc = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=body.usuario_id, curso_id=body.curso_id
    )
    if not insc:
        insc = crud.create_inscripcion(
            session=session, usuario_id=body.usuario_id, curso_id=body.curso_id
        )

    return ConfirmarPagoResponse(
        pago_id=pago.id,
        status=pago.status,
        inscripcion_id=insc.id,
    )
