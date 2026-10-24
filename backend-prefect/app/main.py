from app.config import get_settings  # noqa: I001  (carga .env antes de importar Prefect)

from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Annotated, Any, Literal

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, SecretStr

from app import repositories as repo
from app.db import close_pool, connection, get_pool
from app.errors import AuthError
from app.flows.auth_flows import (
    confirm_enrollment_flow,
    password_login_flow,
    start_enrollment_flow,
    verify_second_factor_flow,
)
from app.security import decode_token, hash_password


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()
    get_pool()
    yield
    close_pool()


app = FastAPI(title="FastPay · Step-Up Auth (2FA TOTP + Prefect)", lifespan=lifespan)


@app.exception_handler(AuthError)
async def auth_error_handler(_: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.code, "message": exc.message})


# ── Esquemas ────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=80)
    password: SecretStr = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: SecretStr


class PreAuthIn(BaseModel):
    pre_auth_token: SecretStr


class CodeIn(PreAuthIn):
    code: SecretStr = Field(min_length=6, max_length=12)


class VerifyIn(CodeIn):
    method: Literal["totp", "backup"] = "totp"


# ── Rutas públicas ──────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", status_code=201)
def register(body: RegisterIn) -> dict[str, Any]:
    with connection() as conn:
        user = repo.create_user(conn, body.email, body.full_name.strip(), hash_password(body.password.get_secret_value()))
        repo.create_wallet(conn, user["id"], user["full_name"])
    return {"id": str(user["id"]), "email": user["email"], "full_name": user["full_name"]}


@app.post("/auth/login")
def login(body: LoginIn) -> dict[str, Any]:
    """Primer factor. Devuelve un pre_auth_token que SOLO sirve para el segundo paso."""
    return password_login_flow(body.email.lower(), body.password)


# ── Aprovisionamiento 2FA (requiere pre_auth_token con scope mfa:enroll) ───

@app.post("/auth/2fa/enroll")
def enroll(body: PreAuthIn) -> dict[str, Any]:
    return start_enrollment_flow(body.pre_auth_token)


@app.post("/auth/2fa/confirm")
def confirm(body: CodeIn) -> dict[str, Any]:
    return confirm_enrollment_flow(body.pre_auth_token, body.code)


# ── Step-Up (requiere pre_auth_token con scope mfa:verify) ──────────────────

@app.post("/auth/verify-2fa")
def verify_2fa(body: VerifyIn) -> dict[str, Any]:
    return verify_second_factor_flow(body.pre_auth_token, body.code, body.method)


# ── Recurso protegido ───────────────────────────────────────────────────────

bearer = HTTPBearer(auto_error=False)


def require_mfa_session(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(401, "Falta el access_token", headers={"WWW-Authenticate": "Bearer"})
    try:
        # decode_token rechaza un pre_auth_token aquí: el tipo debe ser "access".
        claims = decode_token(credentials.credentials, "access")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(401, f"access_token inválido: {exc}", headers={"WWW-Authenticate": "Bearer"}) from None
    if claims.get("mfa_verified") is not True:
        raise HTTPException(403, "Se requiere sesión con mfa_verified: true")
    return claims


def _jsonable(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


@app.get("/api/boveda-secreta")
def boveda_secreta(claims: Annotated[dict[str, Any], Depends(require_mfa_session)]) -> dict[str, Any]:
    with connection() as conn:
        vault = repo.get_vault(conn, claims["sub"])
    if vault is None:
        raise HTTPException(404, "Billetera no encontrada")
    vault = {k: _jsonable(v) for k, v in vault.items()}
    vault["transactions"] = [{k: _jsonable(v) for k, v in t.items()} for t in vault["transactions"]]
    vault["session"] = {"mfa_verified": claims["mfa_verified"], "amr": claims.get("amr"), "exp": claims["exp"]}
    return vault
