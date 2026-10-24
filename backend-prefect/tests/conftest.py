import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Los tests unitarios no tocan la base ni Prefect; solo necesitan settings válidos.
os.environ.setdefault("DATABASE_URL", "postgresql://unused")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MFA_ENCRYPTION_KEY", "Z2V0LXJlYWR5LWZvci10ZXN0cy0zMi1ieXRlcy1rZXk=")
os.environ.setdefault("BACKUP_CODE_PEPPER", "test-pepper")
