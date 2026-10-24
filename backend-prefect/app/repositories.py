"""Acceso a datos del schema mfa_lab (Supabase / Postgres)."""

import random
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from psycopg import Connection, errors

from app.errors import EmailAlreadyRegistered
from app.mfa.enrollment import MfaStatus


# ── Usuarios ────────────────────────────────────────────────────────────────

def find_user_by_email(conn: Connection, email: str) -> dict[str, Any] | None:
    return conn.execute(
        "select id, email, full_name, password_hash from mfa_lab.users where email = %s",
        (email.lower(),),
    ).fetchone()


def find_user(conn: Connection, user_id: UUID | str) -> dict[str, Any] | None:
    return conn.execute(
        "select id, email, full_name from mfa_lab.users where id = %s", (user_id,)
    ).fetchone()


def create_user(conn: Connection, email: str, full_name: str, password_hash: str) -> dict[str, Any]:
    try:
        with conn.transaction():
            return conn.execute(
                """insert into mfa_lab.users (email, full_name, password_hash)
                   values (%s, %s, %s) returning id, email, full_name""",
                (email.lower(), full_name, password_hash),
            ).fetchone()
    except errors.UniqueViolation:
        raise EmailAlreadyRegistered("Ya existe una cuenta con ese correo") from None


# ── Enrolamiento 2FA ────────────────────────────────────────────────────────

def get_enrollment(conn: Connection, user_id: UUID | str) -> dict[str, Any] | None:
    return conn.execute(
        "select user_id, status, secret_encrypted from mfa_lab.mfa_enrollments where user_id = %s",
        (user_id,),
    ).fetchone()


def upsert_pending_enrollment(conn: Connection, user_id: UUID | str, secret_encrypted: str) -> None:
    # El WHERE del ON CONFLICT impide pisar un enrolamiento ACTIVE aunque se salte la
    # validación de la máquina de estados (defensa en profundidad).
    conn.execute(
        """insert into mfa_lab.mfa_enrollments (user_id, status, secret_encrypted)
           values (%s, %s, %s)
           on conflict (user_id) do update
              set secret_encrypted = excluded.secret_encrypted, updated_at = now()
            where mfa_lab.mfa_enrollments.status = %s""",
        (user_id, MfaStatus.PENDING_VERIFICATION, secret_encrypted, MfaStatus.PENDING_VERIFICATION),
    )


def activate_enrollment(conn: Connection, user_id: UUID | str) -> bool:
    row = conn.execute(
        """update mfa_lab.mfa_enrollments
              set status = %s, activated_at = now(), updated_at = now()
            where user_id = %s and status = %s
        returning user_id""",
        (MfaStatus.ACTIVE, user_id, MfaStatus.PENDING_VERIFICATION),
    ).fetchone()
    return row is not None


def reset_enrollment(conn: Connection, user_id: UUID | str) -> None:
    conn.execute("delete from mfa_lab.backup_codes where user_id = %s", (user_id,))
    conn.execute("delete from mfa_lab.mfa_enrollments where user_id = %s", (user_id,))


# ── Códigos de respaldo ─────────────────────────────────────────────────────

def replace_backup_codes(conn: Connection, user_id: UUID | str, code_hashes: list[str]) -> None:
    conn.execute("delete from mfa_lab.backup_codes where user_id = %s", (user_id,))
    with conn.cursor() as cur:
        cur.executemany(
            "insert into mfa_lab.backup_codes (user_id, code_hash) values (%s, %s)",
            [(user_id, h) for h in code_hashes],
        )


def consume_backup_code(conn: Connection, user_id: UUID | str, code_hash: str) -> int | None:
    """Marca el código como usado en un solo UPDATE condicional: dos peticiones
    simultáneas con el mismo código no pueden ganar las dos."""
    row = conn.execute(
        """update mfa_lab.backup_codes set used_at = now()
            where user_id = %s and code_hash = %s and used_at is null
        returning id""",
        (user_id, code_hash),
    ).fetchone()
    if row is None:
        return None
    return conn.execute(
        "select count(*) as n from mfa_lab.backup_codes where user_id = %s and used_at is null",
        (user_id,),
    ).fetchone()["n"]


# ── Billetera (lo que protege la bóveda) ────────────────────────────────────

_COUNTERPARTIES = [
    "Esther Howard", "Ronald Richards", "Jenny Wilson", "Cameron Williamson",
    "Leslie Alexander", "Guy Hawkins", "Kristin Watson", "Savannah Nguyen",
]


def _luhn_card(prefix: str = "4") -> str:
    digits = [int(c) for c in prefix] + [random.randint(0, 9) for _ in range(15 - len(prefix))]
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 0:
            d *= 2
            d = d - 9 if d > 9 else d
        total += d
    return "".join(map(str, digits)) + str((10 - total % 10) % 10)


def create_wallet(conn: Connection, user_id: UUID | str, full_name: str) -> None:
    now = datetime.now(timezone.utc)
    conn.execute(
        """insert into mfa_lab.wallets
             (user_id, balance, card_number, card_cvv, card_expiry, card_holder)
           values (%s, %s, %s, %s, %s, %s)""",
        (
            user_id,
            round(random.uniform(4_000, 40_000), 2),
            _luhn_card(),
            f"{random.randint(0, 999):03d}",
            f"{random.randint(1, 12):02d}/{(now.year + random.randint(2, 6)) % 100:02d}",
            full_name.upper(),
        ),
    )
    rows = []
    for i in range(10):
        kind = random.choice(["send", "receive", "receive", "deposit", "withdraw"])
        amount = round(random.uniform(20, 900), 2)
        signed = amount if kind in ("receive", "deposit") else -amount
        when = now - timedelta(hours=i * random.randint(3, 20), minutes=random.randint(0, 59))
        party = random.choice(_COUNTERPARTIES) if kind in ("send", "receive") else "FastPay"
        rows.append((user_id, kind, party, signed, when))
    with conn.cursor() as cur:
        cur.executemany(
            """insert into mfa_lab.transactions (user_id, kind, counterparty, amount, occurred_at)
               values (%s, %s, %s, %s, %s)""",
            rows,
        )


def get_vault(conn: Connection, user_id: UUID | str) -> dict[str, Any] | None:
    wallet = conn.execute(
        """select w.balance, w.currency, w.card_brand, w.card_number, w.card_cvv,
                  w.card_expiry, w.card_holder, u.full_name, u.email
             from mfa_lab.wallets w join mfa_lab.users u on u.id = w.user_id
            where w.user_id = %s""",
        (user_id,),
    ).fetchone()
    if wallet is None:
        return None
    wallet["transactions"] = conn.execute(
        """select id, kind, counterparty, amount, occurred_at
             from mfa_lab.transactions where user_id = %s
            order by occurred_at desc limit 20""",
        (user_id,),
    ).fetchall()
    wallet["backup_codes_remaining"] = conn.execute(
        "select count(*) as n from mfa_lab.backup_codes where user_id = %s and used_at is null",
        (user_id,),
    ).fetchone()["n"]
    return wallet
