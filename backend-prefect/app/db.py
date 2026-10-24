from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        # Pooler de Supabase en modo sesión (5432), igual que Afirmative Pill.
        _pool = ConnectionPool(
            get_settings().database_url,
            min_size=1,
            max_size=4,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
            # Si la red cambia (wifi, hotspot) o Supabase cierra una conexión inactiva, la
            # conexión del pool queda muerta: se verifica antes de entregarla y se reemplaza.
            check=ConnectionPool.check_connection,
            max_idle=120,
            open=True,
        )
    return _pool


@contextmanager
def connection() -> Iterator[Connection]:
    """Una conexión por unidad de trabajo; commit al salir, rollback si hay excepción."""
    with get_pool().connection() as conn:
        yield conn


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
