"""
Cliente PayPal REST API v2 para NGcourses (RF10/RF08).

Documentacion: https://developer.paypal.com/docs/api/orders/v2/

Variables de entorno:
  PAYPAL_CLIENT_ID — Client ID de PayPal (sandbox o live)
  PAYPAL_SECRET    — Secret de PayPal
  PAYPAL_MODE      — "sandbox" (default) o "live"

Flujo:
  1. create_order(monto, moneda, ...) -> devuelve {id, status, ...}.
     El frontend usa el `id` para abrir el flujo PayPal y obtener aprobacion del usuario.
  2. capture_order(order_id) -> captura el pago aprobado. Devuelve {status: COMPLETED, ...}.
"""
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings


_TIMEOUT = 30.0


class PayPalError(Exception):
    """Error generico de PayPal API (HTTP no-2xx, configuracion faltante, etc)."""


def _ensure_configured() -> None:
    if not settings.paypal_enabled:
        raise PayPalError(
            "PayPal no configurado. Define PAYPAL_CLIENT_ID y PAYPAL_SECRET en .env"
        )


def get_access_token() -> str:
    """Obtiene un OAuth2 access token de PayPal via client_credentials."""
    _ensure_configured()
    url = f"{settings.paypal_api_base}/v1/oauth2/token"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                url,
                auth=(settings.PAYPAL_CLIENT_ID or "", settings.PAYPAL_SECRET or ""),
                data={"grant_type": "client_credentials"},
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()["access_token"]
    except httpx.HTTPError as e:
        raise PayPalError(f"Error obteniendo access token de PayPal: {e}") from e


def create_order(
    *,
    monto: Decimal,
    moneda: str,
    descripcion: str | None = None,
    reference_id: str | None = None,
) -> dict[str, Any]:
    """Crea una orden en PayPal. Devuelve dict con id, status, links, etc."""
    _ensure_configured()
    token = get_access_token()
    url = f"{settings.paypal_api_base}/v2/checkout/orders"

    purchase_unit: dict[str, Any] = {
        "amount": {
            "currency_code": moneda.upper(),
            "value": f"{Decimal(monto):.2f}",
        },
    }
    if descripcion:
        purchase_unit["description"] = descripcion[:127]
    if reference_id:
        purchase_unit["reference_id"] = str(reference_id)[:255]

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [purchase_unit],
    }

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise PayPalError(
            f"PayPal create_order fallo {e.response.status_code}: {e.response.text}"
        ) from e
    except httpx.HTTPError as e:
        raise PayPalError(f"PayPal create_order error de red: {e}") from e


def capture_order(order_id: str) -> dict[str, Any]:
    """Captura una orden PayPal previamente aprobada por el comprador.
    Retorna dict con status (COMPLETED si exitoso) y purchase_units actualizados."""
    _ensure_configured()
    token = get_access_token()
    url = f"{settings.paypal_api_base}/v2/checkout/orders/{order_id}/capture"

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise PayPalError(
            f"PayPal capture_order fallo {e.response.status_code}: {e.response.text}"
        ) from e
    except httpx.HTTPError as e:
        raise PayPalError(f"PayPal capture_order error de red: {e}") from e


def get_order(order_id: str) -> dict[str, Any]:
    """Consulta el estado de una orden PayPal."""
    _ensure_configured()
    token = get_access_token()
    url = f"{settings.paypal_api_base}/v2/checkout/orders/{order_id}"

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise PayPalError(
            f"PayPal get_order fallo {e.response.status_code}: {e.response.text}"
        ) from e
    except httpx.HTTPError as e:
        raise PayPalError(f"PayPal get_order error de red: {e}") from e
