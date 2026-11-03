"""Servicio de Criptografía, Hashing y Seguridad para Autenticación."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections import defaultdict
from threading import Lock

# Rate limiter en memoria para endpoints sensibles (login / backup)
_rate_limit_lock = Lock()
_intentos_ip: dict[str, list[float]] = defaultdict(list)


def crear_hash_password(password: str) -> str:
    """Genera un hash seguro con scrypt (NIST/OWASP memory-hard)."""
    salt = secrets.token_bytes(16)
    # Parámetros recomendados OWASP: N=16384, r=8, p=1
    dk = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        maxmem=67108864,
        dklen=64,
    )
    return f"scrypt${salt.hex()}${dk.hex()}"


def verificar_password(password: str, hash_almacenado: str) -> bool:
    """Verifica si la contraseña coincide con el hash en tiempo constante."""
    try:
        partes = hash_almacenado.split("$")
        if len(partes) != 3 or partes[0] != "scrypt":
            return False
        salt = bytes.fromhex(partes[1])
        esperado = bytes.fromhex(partes[2])
        dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=16384,
            r=8,
            p=1,
            maxmem=67108864,
            dklen=64,
        )
        return hmac.compare_digest(dk, esperado)
    except Exception:
        return False


def generar_token_sesion() -> tuple[str, str]:
    """Genera un token seguro para la cookie y su hash SHA-256 para guardar en BD."""
    token_plano = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_plano.encode("utf-8")).hexdigest()
    return token_plano, token_hash


def hash_token(token_plano: str) -> str:
    """Obtiene el hash SHA-256 del token plano recibido en la cookie."""
    return hashlib.sha256(token_plano.encode("utf-8")).hexdigest()


def comprobar_rate_limit(ip: str, max_intentos: int = 5, ventana_segundos: int = 60) -> bool:
    """Comprueba si una IP ha superado el número máximo de intentos recientes.

    Devuelve True si está permitido, False si está bloqueada.
    """
    ahora = time.time()
    with _rate_limit_lock:
        historial = _intentos_ip[ip]
        # Filtrar intentos que salieron de la ventana
        recientes = [t for t in historial if ahora - t < ventana_segundos]
        if len(recientes) >= max_intentos:
            _intentos_ip[ip] = recientes
            return False
        recientes.append(ahora)
        _intentos_ip[ip] = recientes
        return True


def limpiar_rate_limits() -> None:
    """Limpia el registro de intentos en memoria (útil en tests)."""
    with _rate_limit_lock:
        _intentos_ip.clear()

