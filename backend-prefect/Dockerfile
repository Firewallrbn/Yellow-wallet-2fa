# syntax=docker/dockerfile:1
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY db ./db

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# Un solo worker: la caché anti-replay vive en memoria del proceso (alcance de laboratorio).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
