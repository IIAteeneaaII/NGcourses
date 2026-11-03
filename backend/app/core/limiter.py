import ipaddress
from functools import lru_cache

from slowapi import Limiter
from starlette.requests import Request

from app.core.config import settings

_IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


@lru_cache(maxsize=1)
def _trusted_networks() -> tuple[_IPNetwork, ...]:
    """TRUSTED_PROXIES acepta IPs sueltas o rangos CIDR (ej. 172.16.0.0/12).

    Los contenedores de Docker cambian de IP en cada deploy, así que en
    producción conviene usar el rango de la red de Docker en vez de IPs fijas.
    """
    nets: list[_IPNetwork] = []
    for entry in settings.TRUSTED_PROXIES:
        try:
            nets.append(ipaddress.ip_network(entry.strip(), strict=False))
        except ValueError:
            continue
    return tuple(nets)


def _is_trusted(host: str | None) -> bool:
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in net for net in _trusted_networks())


def get_client_ip(request: Request) -> str:
    """IP real del cliente para el rate limit y los logs de auditoría.

    Solo se lee X-Forwarded-For cuando la conexión directa viene de un proxy
    de confianza (Traefik o el BFF de Next.js). Se recorre de derecha a
    izquierda saltando proxies de confianza: la primera IP que no lo es es la
    del cliente. Así un cliente no puede falsificar su IP mandando su propio
    X-Forwarded-For, porque lo que él escriba queda a la izquierda.
    """
    client_host = request.client.host if request.client else None
    if _is_trusted(client_host):
        xff = request.headers.get("X-Forwarded-For", "")
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        for hop in reversed(hops):
            if not _is_trusted(hop):
                return hop
    return client_host or "127.0.0.1"


limiter = Limiter(key_func=get_client_ip)
