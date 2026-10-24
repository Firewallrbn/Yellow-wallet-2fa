from functools import lru_cache

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Se carga antes de importar Prefect en cualquier módulo: así PREFECT_API_URL del .env
# apunta los flows al servidor local (`prefect server start`) y no a uno efímero.
load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    mfa_encryption_key: str
    backup_code_pepper: str

    issuer: str = "FastPay"
    pre_auth_ttl_seconds: int = 300
    access_ttl_seconds: int = 900
    max_verify_attempts: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
