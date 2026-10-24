"""Recorre el flujo completo contra la API en vivo y deja los flow runs en Prefect.

    python -m scripts.e2e_demo [http://localhost:8000]

Simula el teléfono con el mismo TOTP (RFC 6238) del backend. Crea un usuario nuevo
cada vez, así que se puede repetir sin limpiar la base.
"""

import json
import secrets
import sys
import time
import urllib.error
import urllib.request

from app.mfa import totp

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"content-type": "application/json", **({"authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"{}")


def step(name: str, ok: bool, detail: object = "") -> None:
    print(f"{'✔' if ok else '✘'} {name}  {detail}")
    if not ok:
        sys.exit(1)


def login(email: str, password: str) -> dict:
    status, res = call("POST", "/auth/login", {"email": email, "password": password})
    step(f"login → next_step={res.get('next_step')}", status == 200, "")
    return res


def main() -> None:
    email, password = f"e2e-{secrets.token_hex(3)}@fastpay.dev", "Prueba2026!"
    status, _ = call("POST", "/auth/register", {"email": email, "password": password, "full_name": "Esther Howard"})
    step(f"registro {email}", status == 201)

    pre = login(email, password)["pre_auth_token"]

    status, _ = call("GET", "/api/boveda-secreta", token=pre)
    step("el pre_auth_token NO abre la bóveda", status == 401, f"HTTP {status}")

    status, enroll = call("POST", "/auth/2fa/enroll", {"pre_auth_token": pre})
    step("enroll → PENDING_VERIFICATION", status == 200 and enroll["status"] == "PENDING_VERIFICATION")
    secret = enroll["secret"]

    status, res = call("POST", "/auth/2fa/confirm", {"pre_auth_token": pre, "code": "000000"})
    step("código incorrecto rechazado (flow Failed en execute_mfa_strategy)", status == 401, res.get("error"))

    code = totp.totp(secret)
    status, confirmed = call("POST", "/auth/2fa/confirm", {"pre_auth_token": pre, "code": code})
    step("confirm → ACTIVE + access_token", status == 200 and confirmed["mfa_verified"], f"ventana {confirmed.get('matched_window')}")
    backup_codes = confirmed["backup_codes"]

    status, vault = call("GET", "/api/boveda-secreta", token=confirmed["access_token"])
    step("GET /api/boveda-secreta con mfa_verified", status == 200, f"saldo ${vault.get('balance')}")

    # Segundo login: ya está ACTIVE, así que el paso es "verify". Se reutiliza el MISMO código.
    pre2 = login(email, password)["pre_auth_token"]
    status, res = call("POST", "/auth/verify-2fa", {"pre_auth_token": pre2, "code": code, "method": "totp"})
    step("REPLAY del mismo código bloqueado (Failed en check_anti_replay_cache)", status == 409, res.get("message"))

    # Clock skew: código de la ventana anterior (teléfono 30 s atrasado). Si faltan menos de
    # 5 s para que cambie la ventana se espera a la siguiente: si no, el código llegaría como C-2.
    if 30 - time.time() % 30 < 5:
        time.sleep(30 - time.time() % 30 + 0.5)
    skewed = totp.totp(secret, time.time() - 30)
    if skewed != code:
        status, res = call("POST", "/auth/verify-2fa", {"pre_auth_token": pre2, "code": skewed, "method": "totp"})
        step("código de la ventana C-1 aceptado", status == 200, f"matched_window={res.get('matched_window')}")
    else:
        print("  (se omite C-1: coincide con el código ya usado)")

    pre3 = login(email, password)["pre_auth_token"]
    status, res = call("POST", "/auth/verify-2fa", {"pre_auth_token": pre3, "code": backup_codes[0], "method": "backup"})
    step("BackupCodeStrategy acepta un código de emergencia", status == 200, res.get("method"))

    pre4 = login(email, password)["pre_auth_token"]
    status, res = call("POST", "/auth/verify-2fa", {"pre_auth_token": pre4, "code": backup_codes[0], "method": "backup"})
    step("el mismo código de respaldo no sirve dos veces", status in (401, 409), res.get("error"))

    print("\nTodo OK. Revisa los flow runs en http://localhost:4200/runs")


if __name__ == "__main__":
    main()
