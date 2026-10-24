"""TOTP (RFC 6238) implementado con la librería estándar: hmac + hashlib + struct.

Es el mismo algoritmo que corre la app móvil, paso a paso, para que el servidor y el
teléfono lleguen al mismo código sin estar conectados entre sí.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

PERIOD = 30
DIGITS = 6


def generate_secret() -> str:
    """160 bits aleatorios (el tamaño de bloque de salida de SHA-1) en Base32 sin padding."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def decode_base32(secret: str) -> bytes:
    cleaned = secret.replace(" ", "").upper()
    return base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))


def time_step(unix_time: float | None = None) -> int:
    """C = floor(UnixTime / 30)."""
    return int((time.time() if unix_time is None else unix_time) // PERIOD)


def hotp(key: bytes, counter: int) -> str:
    # 1. C como entero de 8 bytes Big-Endian.
    message = struct.pack(">Q", counter)
    # 2. HMAC-SHA1(K, C) -> 20 bytes.
    digest = hmac.new(key, message, hashlib.sha1).digest()
    # 3. Truncamiento dinámico: offset = últimos 4 bits del byte 19.
    offset = digest[19] & 0x0F
    # 4. 4 bytes desde offset, quitando el bit de signo -> entero de 31 bits.
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    # 5. Módulo 10^6 y relleno con ceros a la izquierda.
    return str(binary % 10**DIGITS).zfill(DIGITS)


def totp(secret: str, unix_time: float | None = None) -> str:
    return hotp(decode_base32(secret), time_step(unix_time))


def provisioning_uri(secret: str, account: str, issuer: str) -> str:
    label = quote(f"{issuer}:{account}")
    params = urlencode(
        {"secret": secret, "issuer": issuer, "algorithm": "SHA1", "digits": DIGITS, "period": PERIOD}
    )
    return f"otpauth://totp/{label}?{params}"
