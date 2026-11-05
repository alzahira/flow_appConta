"""Servicio de Criptografía, Hashing y Seguridad para Autenticación."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict
from threading import Lock

from fastapi import Request

# Parámetros actuales de scrypt (OWASP memory-hard). El formato guardado incluye
# N/r/p para poder subir el coste en el futuro sin invalidar hashes antiguos.
SCRYPT_N = 2**16
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64
SCRYPT_MAXMEM = 134_217_728  # 128 MiB
_SCRYPT_N_LEGACY = 16_384

# Rate limiter en memoria para endpoints sensibles (login / backup)
_rate_limit_lock = Lock()
_intentos_ip: dict[str, list[float]] = defaultdict(list)

# Hash señuelo para que un usuario inexistente tarde lo mismo que uno real.
_dummy_hash: str | None = None


def crear_hash_password(password: str) -> str:
    """Genera un hash scrypt con sal aleatoria y parámetros versionados."""
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=SCRYPT_MAXMEM,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${dk.hex()}"


def _parametros_hash(hash_almacenado: str) -> tuple[int, int, int, bytes, bytes] | None:
    """Devuelve (n, r, p, salt, hash) soportando el formato antiguo de 3 partes."""
    partes = hash_almacenado.split("$")
    try:
        if len(partes) == 3 and partes[0] == "scrypt":
            # Formato antiguo: scrypt$salt$hash (N=16384, r=8, p=1)
            return (
                _SCRYPT_N_LEGACY,
                8,
                1,
                bytes.fromhex(partes[1]),
                bytes.fromhex(partes[2]),
            )
        if len(partes) == 6 and partes[0] == "scrypt":
            n = int(partes[1])
            r = int(partes[2])
            p = int(partes[3])
            # Evita que un hash manipulado provoque un consumo desmedido.
            if n < 2**14 or n > 2**20 or r < 1 or r > 32 or p < 1 or p > 16:
                return None
            return n, r, p, bytes.fromhex(partes[4]), bytes.fromhex(partes[5])
    except (ValueError, TypeError):
        return None
    return None


def verificar_password(password: str, hash_almacenado: str) -> bool:
    """Verifica la contraseña en tiempo constante, aceptando hashes antiguos."""
    parametros = _parametros_hash(hash_almacenado)
    if parametros is None:
        return False
    n, r, p, salt, esperado = parametros
    try:
        dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            maxmem=max(SCRYPT_MAXMEM, 128 * n * r * 2),
            dklen=len(esperado),
        )
        return hmac.compare_digest(dk, esperado)
    except (ValueError, MemoryError, OSError):
        return False


def necesita_rehash(hash_almacenado: str) -> bool:
    """True si el hash usa parámetros inferiores a los actuales (upgrade al login)."""
    parametros = _parametros_hash(hash_almacenado)
    if parametros is None:
        return True
    n, r, p, _salt, _esperado = parametros
    return (n, r, p) != (SCRYPT_N, SCRYPT_R, SCRYPT_P)


def hash_dummy() -> str:
    """Hash válido generado una vez para igualar el tiempo de usuarios inexistentes."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = crear_hash_password(secrets.token_urlsafe(32))
    return _dummy_hash


def generar_token_sesion() -> tuple[str, str]:
    """Genera un token seguro para la cookie y su hash SHA-256 para guardar en BD."""
    token_plano = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_plano.encode("utf-8")).hexdigest()
    return token_plano, token_hash


def hash_token(token_plano: str) -> str:
    """Obtiene el hash SHA-256 del token plano recibido en la cookie."""
    return hashlib.sha256(token_plano.encode("utf-8")).hexdigest()


def _proxy_de_confianza() -> bool:
    """Solo se confía en X-Forwarded-For si el operador lo declara explícitamente."""
    return os.environ.get("APP_CONTA_TRUST_PROXY", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def obtener_ip_cliente(request: Request) -> str:
    """IP real del cliente, sin aceptar cabeceras falsificables por defecto."""
    if _proxy_de_confianza():
        cf = request.headers.get("CF-Connecting-IP")
        if cf:
            return cf.strip()
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def comprobar_rate_limit(
    ip: str, max_intentos: int = 5, ventana_segundos: int = 60
) -> bool:
    """Comprueba si una IP ha superado el número máximo de fallos recientes.

    No consume un intento: el fallo se registra después con `registrar_fallo`.
    Así un login correcto no gasta el cupo y no se bloquea al usuario legítimo.
    """
    ahora = time.time()
    with _rate_limit_lock:
        recientes = [t for t in _intentos_ip.get(ip, []) if ahora - t < ventana_segundos]
        _intentos_ip[ip] = recientes
        return len(recientes) < max_intentos


def registrar_fallo(ip: str, ventana_segundos: int = 60) -> None:
    """Registra un intento fallido para la IP indicada."""
    ahora = time.time()
    with _rate_limit_lock:
        recientes = [t for t in _intentos_ip.get(ip, []) if ahora - t < ventana_segundos]
        recientes.append(ahora)
        _intentos_ip[ip] = recientes


def limpiar_intentos(ip: str) -> None:
    """Limpia los fallos de una IP tras un login correcto."""
    with _rate_limit_lock:
        _intentos_ip.pop(ip, None)


def limpiar_rate_limits() -> None:
    """Limpia el registro de intentos en memoria (útil en tests)."""
    with _rate_limit_lock:
        _intentos_ip.clear()
