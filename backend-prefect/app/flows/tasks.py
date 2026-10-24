"""Tasks observables del pipeline de autenticación.

Cada una lanza una excepción de dominio cuando falla: así Prefect marca en rojo (Failed)
exactamente la task donde se rompió el pipeline y el flow queda Failed.
"""

from dataclasses import dataclass
from typing import Any

import jwt
from prefect import get_run_logger, task
from prefect.cache_policies import NO_CACHE
from pydantic import SecretStr

from app import repositories as repo
from app.config import get_settings
from app.db import connection
from app.errors import (
    InvalidCredentials,
    InvalidPreAuthToken,
    InvalidSecondFactor,
    ReplayAttackDetected,
    TooManyAttempts,
)
from app.mfa import totp
from app.mfa.enrollment import MfaStatus, ensure_transition
from app.mfa.memory_store import anti_replay_cache, consumed_pre_auth, verify_attempts
from app.mfa.strategies import (
    BackupCodeStrategy,
    Method,
    SecondFactorStrategy,
    TOTPStrategy,
    VerificationResult,
)
from app.security import (
    decode_token,
    decrypt_secret,
    encrypt_secret,
    generate_backup_codes,
    hash_backup_code,
    issue_token,
    verify_password,
)

SCOPE_ENROLL = "mfa:enroll"
SCOPE_VERIFY = "mfa:verify"

# Sin caché de Prefect: cada intento de login debe ejecutarse de verdad.
auth_task = task(cache_policy=NO_CACHE, retries=0)


@dataclass(frozen=True)
class PreAuthContext:
    user_id: str
    email: str
    full_name: str
    jti: str
    scope: str


def _mask(code: str) -> str:
    code = code.strip()
    return code if len(code) <= 2 else f"{code[:2]}{'•' * (len(code) - 4)}{code[-2:]}"


def _normalize(code: str) -> str:
    return code.replace("-", "").replace(" ", "").upper()


# ── Login (primer factor) ───────────────────────────────────────────────────

@auth_task(name="authenticate_credentials")
def authenticate_credentials(email: str, password: SecretStr) -> dict[str, Any]:
    logger = get_run_logger()
    with connection() as conn:
        user = repo.find_user_by_email(conn, email)
    if not verify_password(user["password_hash"] if user else None, password.get_secret_value()):
        logger.warning("Credenciales inválidas para %s", email)
        raise InvalidCredentials("Correo o contraseña incorrectos")
    logger.info("Primer factor OK para %s", email)
    return {"id": str(user["id"]), "email": user["email"], "full_name": user["full_name"]}


@auth_task(name="resolve_mfa_state")
def resolve_mfa_state(user_id: str) -> MfaStatus | None:
    logger = get_run_logger()
    with connection() as conn:
        enrollment = repo.get_enrollment(conn, user_id)
    status = MfaStatus(enrollment["status"]) if enrollment else None
    logger.info("Estado del Process Manager 2FA: %s", status or "SIN_2FA")
    return status


@auth_task(name="issue_pre_auth_token")
def issue_pre_auth_token(user: dict[str, Any], status: MfaStatus | None) -> dict[str, Any]:
    logger = get_run_logger()
    # Step-Up: el password nunca entrega acceso. Solo un token restringido a UN endpoint.
    scope = SCOPE_VERIFY if status == MfaStatus.ACTIVE else SCOPE_ENROLL
    ttl = get_settings().pre_auth_ttl_seconds
    token = issue_token(
        "pre_auth", user["id"], ttl,
        scope=scope, email=user["email"], name=user["full_name"], mfa_verified=False,
    )
    next_step = "verify" if scope == SCOPE_VERIFY else "enroll"
    logger.info("pre_auth_token emitido (scope=%s, expira en %ss) → siguiente paso: %s", scope, ttl, next_step)
    return {"pre_auth_token": token, "expires_in": ttl, "next_step": next_step, "mfa_status": status}


# ── Step-Up: las 4 tasks de la guía ─────────────────────────────────────────

@auth_task(name="validate_pre_auth_state")
def validate_pre_auth_state(
    pre_auth_token: SecretStr, required_scope: str, count_attempt: bool = True
) -> PreAuthContext:
    logger = get_run_logger()
    try:
        payload = decode_token(pre_auth_token.get_secret_value(), "pre_auth")
    except jwt.ExpiredSignatureError:
        raise InvalidPreAuthToken("El pre_auth_token expiró: vuelve a iniciar sesión") from None
    except jwt.InvalidTokenError as exc:
        raise InvalidPreAuthToken(f"pre_auth_token inválido: {exc}") from None

    if payload.get("scope") != required_scope:
        raise InvalidPreAuthToken(f"El token tiene scope '{payload.get('scope')}', se requiere '{required_scope}'")
    if consumed_pre_auth.contains((payload["jti"],)):
        raise InvalidPreAuthToken("Este pre_auth_token ya fue canjeado por una sesión")

    if count_attempt:
        attempts = verify_attempts.increment(payload["jti"])
        limit = get_settings().max_verify_attempts
        if attempts > limit:
            raise TooManyAttempts(f"Se superaron los {limit} intentos para este pre_auth_token")
        logger.info("pre_auth_token válido para %s (scope=%s, intento %s/%s)",
                    payload["email"], required_scope, attempts, limit)
    else:
        logger.info("pre_auth_token válido para %s (scope=%s)", payload["email"], required_scope)

    return PreAuthContext(
        user_id=payload["sub"], email=payload["email"], full_name=payload["name"],
        jti=payload["jti"], scope=payload["scope"],
    )


@auth_task(name="check_anti_replay_cache")
def check_anti_replay_cache(ctx: PreAuthContext, code: SecretStr) -> None:
    logger = get_run_logger()
    raw = code.get_secret_value()
    if anti_replay_cache.contains((ctx.user_id, _normalize(raw))):
        logger.error("🚨 ReplayAttackDetected: el código %s ya fue usado por %s en los últimos 90 s",
                     _mask(raw), ctx.email)
        raise ReplayAttackDetected(
            f"ReplayAttackDetected: el código {_mask(raw)} ya fue utilizado en los últimos 90 segundos"
        )
    logger.info("Código %s no aparece en la caché anti-replay (ventana de 90 s)", _mask(raw))


def _build_strategy(conn, ctx: PreAuthContext, method: Method, expected: MfaStatus) -> SecondFactorStrategy:
    """Fábrica de estrategias: el único lugar que sabe qué implementación concreta usar."""
    if method == "backup":
        return BackupCodeStrategy(lambda code: repo.consume_backup_code(conn, ctx.user_id, hash_backup_code(code)))
    enrollment = repo.get_enrollment(conn, ctx.user_id)
    if enrollment is None or enrollment["status"] != expected:
        raise InvalidSecondFactor(f"El usuario no tiene un enrolamiento 2FA en estado {expected}")
    return TOTPStrategy(decrypt_secret(enrollment["secret_encrypted"]))


_CLOCK_HINT = {
    "C-1": "el reloj del teléfono va ~30 s ATRASADO respecto al servidor",
    "C": "reloj del teléfono sincronizado con el servidor",
    "C+1": "el reloj del teléfono va ~30 s ADELANTADO respecto al servidor",
}


@auth_task(name="execute_mfa_strategy")
def execute_mfa_strategy(
    ctx: PreAuthContext, code: SecretStr, method: Method,
    expected_status: MfaStatus = MfaStatus.ACTIVE,
) -> VerificationResult:
    logger = get_run_logger()
    with connection() as conn:
        strategy = _build_strategy(conn, ctx, method, expected_status)
        logger.info("Estrategia seleccionada: %s", type(strategy).__name__)
        result = strategy.verify(code.get_secret_value())

    if not result.ok:
        if method == "totp":
            logger.warning("❌ El código no coincide en ninguna ventana (C-1, C, C+1); C actual = %s", result.time_step)
        else:
            logger.warning("❌ Código de respaldo rechazado: %s", result.detail)
        raise InvalidSecondFactor("El código no es válido")

    if method == "totp":
        logger.info("✅ Match TOTP en la ventana %s (contador T=%s) — %s",
                    result.detail, result.time_step, _CLOCK_HINT[result.detail])
    else:
        logger.info("✅ Código de respaldo aceptado y quemado (%s)", result.detail)
    return result


@auth_task(name="issue_elevated_session")
def issue_elevated_session(ctx: PreAuthContext, code: SecretStr, result: VerificationResult) -> dict[str, Any]:
    logger = get_run_logger()
    raw = code.get_secret_value()
    # Marcar + comprobar en una sola operación atómica: si dos peticiones con el mismo
    # código pasaron check_anti_replay_cache a la vez, solo una gana aquí.
    if not anti_replay_cache.add_if_absent((ctx.user_id, _normalize(raw))):
        raise ReplayAttackDetected(f"ReplayAttackDetected: el código {_mask(raw)} se usó en paralelo")
    if not consumed_pre_auth.add_if_absent((ctx.jti,)):
        raise InvalidPreAuthToken("Este pre_auth_token ya fue canjeado por una sesión")

    ttl = get_settings().access_ttl_seconds
    access_token = issue_token(
        "access", ctx.user_id, ttl,
        email=ctx.email, name=ctx.full_name, scope="vault:read",
        mfa_verified=True, amr=["pwd", "otp" if result.method == "totp" else "backup"],
    )
    logger.info("Código %s marcado como usado (anti-replay 90 s); access_token emitido con mfa_verified=true", _mask(raw))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ttl,
        "mfa_verified": True,
        "method": result.method,
        "matched_window": result.detail if result.method == "totp" else None,
    }


# ── Aprovisionamiento (Process Manager) ─────────────────────────────────────

@auth_task(name="provision_pending_enrollment")
def provision_pending_enrollment(ctx: PreAuthContext) -> dict[str, Any]:
    import segno

    logger = get_run_logger()
    with connection() as conn:
        current = repo.get_enrollment(conn, ctx.user_id)
        current_status = MfaStatus(current["status"]) if current else None
        ensure_transition(current_status, MfaStatus.PENDING_VERIFICATION)
        secret = totp.generate_secret()
        repo.upsert_pending_enrollment(conn, ctx.user_id, encrypt_secret(secret))

    uri = totp.provisioning_uri(secret, ctx.email, get_settings().issuer)
    logger.info("Transición %s → PENDING_VERIFICATION (secreto nuevo de 160 bits, cifrado en reposo)",
                current_status or "SIN_2FA")
    return {
        "status": MfaStatus.PENDING_VERIFICATION,
        "secret": secret,
        "otpauth_uri": uri,
        "qr_svg": segno.make(uri, error="m").svg_data_uri(scale=8, border=2),
    }


@auth_task(name="activate_mfa_enrollment")
def activate_mfa_enrollment(ctx: PreAuthContext) -> list[str]:
    logger = get_run_logger()
    codes = generate_backup_codes()
    with connection() as conn:
        ensure_transition(MfaStatus.PENDING_VERIFICATION, MfaStatus.ACTIVE)
        if not repo.activate_enrollment(conn, ctx.user_id):
            raise InvalidSecondFactor("El enrolamiento ya no está en PENDING_VERIFICATION")
        repo.replace_backup_codes(conn, ctx.user_id, [hash_backup_code(c) for c in codes])
    logger.info("Transición PENDING_VERIFICATION → ACTIVE; %s códigos de respaldo generados", len(codes))
    return codes
