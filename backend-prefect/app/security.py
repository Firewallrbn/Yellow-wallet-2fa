"""Primitivas de seguridad: contraseñas, cifrado del secreto TOTP, hash de backups y JWT."""

import hashlib
import hmac
import secrets
import time
import uuid
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet

from app.config import get_settings

_hasher = PasswordHasher()

# Hash fijo para comparar cuando el email no existe: el login tarda lo mismo y no
# revela qué cuentas están registradas.
_DUMMY_HASH = _hasher.hash("timing-equalizer")

TokenType = Literal["pre_auth", "access"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except VerifyMismatchError:
        return False


def _fernet() -> Fernet:
    return Fernet(get_settings().mfa_encryption_key.encode())


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def hash_backup_code(code: str) -> str:
    """HMAC-SHA256 con pepper: los códigos tienen alta entropía, no necesitan argon2."""
    normalized = code.replace("-", "").replace(" ", "").upper()
    pepper = get_settings().backup_code_pepper.encode()
    return hmac.new(pepper, normalized.encode(), hashlib.sha256).hexdigest()


def generate_backup_codes(count: int = 10) -> list[str]:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I para dictarlos sin errores
    codes = []
    for _ in range(count):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def issue_token(token_type: TokenType, subject: str, ttl: int, **claims: Any) -> str:
    now = int(time.time())
    payload = {
        "sub": subject,
        "typ": token_type,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
        "iss": get_settings().issuer,
        **claims,
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        get_settings().jwt_secret,
        algorithms=["HS256"],
        issuer=get_settings().issuer,
        options={"require": ["exp", "iat", "sub", "typ", "jti"]},
    )
    if payload["typ"] != expected_type:
        # Un pre_auth_token jamás sirve como access_token (ni al revés).
        raise jwt.InvalidTokenError(f"se esperaba un token '{expected_type}'")
    return payload
