"""Process Manager / máquina de estados del aprovisionamiento 2FA.

    (sin registro) ──solicitar──▶ PENDING_VERIFICATION ──primer código válido──▶ ACTIVE
                                   │        ▲
                                   └────────┘ regenerar QR (nunca se escaneó)

Mientras el estado sea PENDING_VERIFICATION el login NO exige el segundo factor de ese
secreto: si el usuario genera el QR y nunca lo escanea, no queda bloqueado.
"""

from enum import StrEnum

from app.errors import InvalidStateTransition


class MfaStatus(StrEnum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"


_TRANSITIONS: dict[MfaStatus | None, set[MfaStatus]] = {
    None: {MfaStatus.PENDING_VERIFICATION},
    MfaStatus.PENDING_VERIFICATION: {MfaStatus.PENDING_VERIFICATION, MfaStatus.ACTIVE},
    MfaStatus.ACTIVE: set(),
}


def ensure_transition(current: MfaStatus | None, target: MfaStatus) -> None:
    if target not in _TRANSITIONS[current]:
        raise InvalidStateTransition(f"Transición no permitida: {current or 'SIN_2FA'} → {target}")
