"""Borra el enrolamiento 2FA y los códigos de respaldo de un usuario (para repetir la demo).

    python -m scripts.reset_mfa demo@fastpay.dev
"""

import sys

from app import repositories as repo
from app.db import close_pool, connection


def main(email: str) -> None:
    with connection() as conn:
        user = repo.find_user_by_email(conn, email)
        if user is None:
            sys.exit(f"No existe {email}")
        repo.reset_enrollment(conn, user["id"])
    close_pool()
    print(f"2FA reiniciado para {email}: el próximo login pedirá escanear un QR nuevo")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "demo@fastpay.dev")
