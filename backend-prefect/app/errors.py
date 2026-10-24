"""Excepciones de dominio. Las lanzan las tasks de Prefect (y por eso el flow queda en
Failed en la UI); main.py las traduce a códigos HTTP."""


class AuthError(Exception):
    status_code = 401
    code = "auth_error"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidCredentials(AuthError):
    code = "invalid_credentials"


class InvalidPreAuthToken(AuthError):
    code = "invalid_pre_auth_token"


class TooManyAttempts(AuthError):
    status_code = 429
    code = "too_many_attempts"


class ReplayAttackDetected(AuthError):
    status_code = 409
    code = "replay_attack_detected"


class InvalidSecondFactor(AuthError):
    code = "invalid_second_factor"


class InvalidStateTransition(AuthError):
    status_code = 409
    code = "invalid_state_transition"


class EmailAlreadyRegistered(AuthError):
    status_code = 409
    code = "email_already_registered"
