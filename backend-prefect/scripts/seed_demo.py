"""Crea el usuario de demo (sin 2FA, para mostrar el aprovisionamiento en vivo).

    python -m scripts.seed_demo
"""

from app import repositories as repo
from app.db import close_pool, connection
from app.security import hash_password

DEMO_EMAIL = "demo@fastpay.dev"
DEMO_PASSWORD = "FastPay2026!"
DEMO_NAME = "Darlene Robertson"


def main() -> None:
    with connection() as conn:
        if repo.find_user_by_email(conn, DEMO_EMAIL):
            print(f"Ya existe {DEMO_EMAIL}")
        else:
            user = repo.create_user(conn, DEMO_EMAIL, DEMO_NAME, hash_password(DEMO_PASSWORD))
            repo.create_wallet(conn, user["id"], DEMO_NAME)
            print(f"Creado {DEMO_EMAIL} / {DEMO_PASSWORD}")
    close_pool()


if __name__ == "__main__":
    main()
