"""Aplica db/migrations/*.sql en orden sobre Supabase (schema mfa_lab).

    python -m scripts.migrate
"""

from pathlib import Path

from app.db import close_pool, connection

MIGRATIONS = Path(__file__).resolve().parent.parent / "db" / "migrations"


def main() -> None:
    with connection() as conn:
        conn.execute("create schema if not exists mfa_lab")
        conn.execute(
            """create table if not exists mfa_lab.schema_migrations (
                   name text primary key, applied_at timestamptz not null default now())"""
        )
        conn.execute("alter table mfa_lab.schema_migrations enable row level security")
        applied = {r["name"] for r in conn.execute("select name from mfa_lab.schema_migrations")}

    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in applied:
            print(f"  = {path.name} (ya aplicada)")
            continue
        with connection() as conn:
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("insert into mfa_lab.schema_migrations (name) values (%s)", (path.name,))
        print(f"  + {path.name}")
    close_pool()


if __name__ == "__main__":
    main()
