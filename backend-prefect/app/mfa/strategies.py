"""Strategy Pattern para el segundo factor.

El flow de verificación no sabe si está validando un TOTP o un código de respaldo:
recibe una SecondFactorStrategy y le pide verify(). Agregar WebAuthn o SMS sería
otra implementación más, sin tocar el flow.
"""

import hmac
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, ClassVar, Literal

from app.mfa import totp

Method = Literal["totp", "backup"]

# Ventanas evaluadas, en el orden en que se reportan en los logs de Prefect.
TOTP_WINDOWS: tuple[tuple[str, int], ...] = (("C-1", -1), ("C", 0), ("C+1", 1))


@dataclass(frozen=True)
class VerificationResult:
    ok: bool
    method: Method
    # Para TOTP: "C-1" | "C" | "C+1". Para backup: códigos restantes.
    detail: str
    time_step: int | None = None


class SecondFactorStrategy(ABC):
    method: ClassVar[Method]

    @abstractmethod
    def verify(self, code: str) -> VerificationResult: ...


class TOTPStrategy(SecondFactorStrategy):
    method = "totp"

    def __init__(self, secret: str, clock: Callable[[], float] = time.time):
        self._key = totp.decode_base32(secret)
        self._clock = clock

    def verify(self, code: str) -> VerificationResult:
        code = code.strip()
        current = totp.time_step(self._clock())
        matched: tuple[str, int] | None = None
        # Se evalúan las 3 ventanas siempre (sin cortar en el primer match) para que
        # el tiempo de respuesta no revele cuál ventana coincidió.
        for label, delta in TOTP_WINDOWS:
            candidate = totp.hotp(self._key, current + delta)
            if hmac.compare_digest(candidate, code) and matched is None:
                matched = (label, current + delta)
        if matched is None:
            return VerificationResult(ok=False, method=self.method, detail="sin coincidencia", time_step=current)
        return VerificationResult(ok=True, method=self.method, detail=matched[0], time_step=matched[1])


class BackupCodeStrategy(SecondFactorStrategy):
    method = "backup"

    def __init__(self, consume: Callable[[str], int | None]):
        # consume(code) marca el código como usado de forma atómica y devuelve cuántos
        # quedan, o None si no existía o ya se había usado.
        self._consume = consume

    def verify(self, code: str) -> VerificationResult:
        remaining = self._consume(code.strip())
        if remaining is None:
            return VerificationResult(ok=False, method=self.method, detail="código inválido o ya usado")
        return VerificationResult(ok=True, method=self.method, detail=f"{remaining} códigos restantes")
