import base64

import pytest

from app.errors import InvalidStateTransition
from app.mfa import totp
from app.mfa.enrollment import MfaStatus, ensure_transition
from app.mfa.memory_store import TTLSet
from app.mfa.strategies import BackupCodeStrategy, TOTPStrategy

# Semilla de los vectores de prueba del RFC 6238 (Apéndice B) para SHA-1.
RFC_SECRET = base64.b32encode(b"12345678901234567890").decode()


@pytest.mark.parametrize(
    ("unix_time", "expected_8_digits"),
    [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
        (20000000000, "65353130"),
    ],
)
def test_rfc6238_vectors(unix_time, expected_8_digits):
    # Nuestro TOTP es de 6 dígitos: los últimos 6 del vector de 8 (mismo truncamiento, mod 10^6).
    assert totp.totp(RFC_SECRET, unix_time) == expected_8_digits[-6:]


def test_base32_roundtrip_without_padding():
    secret = totp.generate_secret()
    assert "=" not in secret
    assert len(totp.decode_base32(secret)) == 20
    assert totp.decode_base32(secret.lower()) == totp.decode_base32(secret)


def test_provisioning_uri():
    uri = totp.provisioning_uri("JBSWY3DPEHPK3PXP", "demo@fastpay.dev", "FastPay")
    assert uri.startswith("otpauth://totp/FastPay%3Ademo%40fastpay.dev?")
    assert "secret=JBSWY3DPEHPK3PXP" in uri and "issuer=FastPay" in uri


@pytest.mark.parametrize(("phone_offset", "window"), [(-30, "C-1"), (0, "C"), (30, "C+1")])
def test_totp_strategy_reports_matching_window(phone_offset, window):
    server_now = 1_700_000_015.0
    phone_code = totp.totp(RFC_SECRET, server_now + phone_offset)
    result = TOTPStrategy(RFC_SECRET, clock=lambda: server_now).verify(phone_code)
    assert result.ok and result.detail == window


def test_totp_strategy_rejects_codes_outside_windows():
    server_now = 1_700_000_015.0
    stale = totp.totp(RFC_SECRET, server_now - 90)
    assert not TOTPStrategy(RFC_SECRET, clock=lambda: server_now).verify(stale).ok


def test_backup_strategy_delegates_consumption():
    remaining = {"AAAA-BBBB": 9}
    strategy = BackupCodeStrategy(lambda code: remaining.pop(code, None))
    assert strategy.verify("AAAA-BBBB").ok
    assert not strategy.verify("AAAA-BBBB").ok  # un solo uso


def test_enrollment_state_machine():
    ensure_transition(None, MfaStatus.PENDING_VERIFICATION)
    ensure_transition(MfaStatus.PENDING_VERIFICATION, MfaStatus.PENDING_VERIFICATION)
    ensure_transition(MfaStatus.PENDING_VERIFICATION, MfaStatus.ACTIVE)
    with pytest.raises(InvalidStateTransition):
        ensure_transition(None, MfaStatus.ACTIVE)  # no se activa sin pasar por la verificación
    with pytest.raises(InvalidStateTransition):
        ensure_transition(MfaStatus.ACTIVE, MfaStatus.PENDING_VERIFICATION)


def test_ttl_set_add_if_absent_is_single_winner():
    cache = TTLSet(ttl_seconds=90)
    assert cache.add_if_absent(("u1", "123456"))
    assert not cache.add_if_absent(("u1", "123456"))
    assert cache.contains(("u1", "123456"))
    assert not cache.contains(("u2", "123456"))
