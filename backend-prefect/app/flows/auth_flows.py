"""Flows de Prefect. Cada endpoint de autenticación ejecuta uno y queda como un flow run
en el dashboard (http://127.0.0.1:4200), con su grafo de tasks y sus logs."""

from typing import Any

from prefect import flow
from pydantic import SecretStr

from app.flows.tasks import (
    SCOPE_ENROLL,
    SCOPE_VERIFY,
    activate_mfa_enrollment,
    authenticate_credentials,
    check_anti_replay_cache,
    execute_mfa_strategy,
    issue_elevated_session,
    issue_pre_auth_token,
    provision_pending_enrollment,
    resolve_mfa_state,
    validate_pre_auth_state,
)
from app.mfa.enrollment import MfaStatus
from app.mfa.strategies import Method


@flow(name="password-login", flow_run_name="login-{email}")
def password_login_flow(email: str, password: SecretStr) -> dict[str, Any]:
    """POST /auth/login: primer factor. Devuelve un pre_auth_token, nunca acceso."""
    user = authenticate_credentials(email, password)
    status = resolve_mfa_state(user["id"])
    return issue_pre_auth_token(user, status)


@flow(name="verify-2fa-step-up", flow_run_name="verify-2fa-{method}")
def verify_second_factor_flow(pre_auth_token: SecretStr, code: SecretStr, method: Method = "totp") -> dict[str, Any]:
    """POST /auth/verify-2fa: el pipeline de 4 tasks de la guía."""
    ctx = validate_pre_auth_state(pre_auth_token, SCOPE_VERIFY)
    check_anti_replay_cache(ctx, code)
    result = execute_mfa_strategy(ctx, code, method)
    return issue_elevated_session(ctx, code, result)


@flow(name="mfa-provisioning-start", flow_run_name="provision-pending")
def start_enrollment_flow(pre_auth_token: SecretStr) -> dict[str, Any]:
    """POST /auth/2fa/enroll: crea (o regenera) el secreto en PENDING_VERIFICATION."""
    ctx = validate_pre_auth_state(pre_auth_token, SCOPE_ENROLL, count_attempt=False)
    return provision_pending_enrollment(ctx)


@flow(name="mfa-provisioning-confirm", flow_run_name="provision-confirm")
def confirm_enrollment_flow(pre_auth_token: SecretStr, code: SecretStr) -> dict[str, Any]:
    """POST /auth/2fa/confirm: el primer código válido mueve PENDING_VERIFICATION → ACTIVE."""
    ctx = validate_pre_auth_state(pre_auth_token, SCOPE_ENROLL)
    check_anti_replay_cache(ctx, code)
    result = execute_mfa_strategy(ctx, code, "totp", expected_status=MfaStatus.PENDING_VERIFICATION)
    backup_codes = activate_mfa_enrollment(ctx)
    session = issue_elevated_session(ctx, code, result)
    return {**session, "backup_codes": backup_codes}
