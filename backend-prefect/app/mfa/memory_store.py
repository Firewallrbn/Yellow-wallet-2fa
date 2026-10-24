"""Estado en memoria del proceso (alcance de laboratorio: un solo worker de uvicorn).

En producción esto iría en Redis con SET NX EX; aquí un dict con TTL y un Lock da la
misma semántica: la operación "marcar como usado" es atómica.
"""

import threading
import time


class TTLSet:
    def __init__(self, ttl_seconds: int):
        self._ttl = ttl_seconds
        self._entries: dict[tuple, float] = {}
        self._lock = threading.Lock()

    def _purge(self, now: float) -> None:
        for key in [k for k, exp in self._entries.items() if exp <= now]:
            del self._entries[key]

    def contains(self, key: tuple) -> bool:
        with self._lock:
            now = time.monotonic()
            self._purge(now)
            return key in self._entries

    def add_if_absent(self, key: tuple, ttl_seconds: int | None = None) -> bool:
        """True si la clave era nueva. False si ya estaba (la carrera la ganó otro)."""
        with self._lock:
            now = time.monotonic()
            self._purge(now)
            if key in self._entries:
                return False
            self._entries[key] = now + (ttl_seconds or self._ttl)
            return True

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


class AttemptCounter:
    """Intentos fallidos por pre_auth_token (jti): frena la fuerza bruta de 6 dígitos."""

    def __init__(self):
        self._counts: dict[str, int] = {}
        self._lock = threading.Lock()

    def increment(self, key: str) -> int:
        with self._lock:
            self._counts[key] = self._counts.get(key, 0) + 1
            return self._counts[key]

    def clear(self) -> None:
        with self._lock:
            self._counts.clear()


# (user_id, code) usados en los últimos 90 s.
anti_replay_cache = TTLSet(ttl_seconds=90)
# jti de pre_auth_tokens ya canjeados por un access_token (un token, un canje).
consumed_pre_auth = TTLSet(ttl_seconds=600)
verify_attempts = AttemptCounter()
