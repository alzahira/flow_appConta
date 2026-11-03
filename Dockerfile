# Multi-stage Dockerfile para Flow - Finanzas & Botes
# Optimizado para producción, ligereza y seguridad (usuario no-root)

FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS builder

WORKDIR /app

# Instalar dependencias usando uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Stage final de producción
FROM python:3.11-slim-bookworm

# Variables de entorno de producción
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_CONTA_ENV=production \
    APP_CONTA_HOST=0.0.0.0 \
    APP_CONTA_PORT=8000 \
    APP_CONTA_DB=/data/conta.db \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Instalar curl para healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario de sistema no privilegiado para ejecutar la app
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -m -s /bin/bash appuser

# Copiar el entorno virtual compilado desde el builder
COPY --from=builder /app/.venv /app/.venv

# Copiar el código fuente y las migraciones
COPY . /app

# Crear directorio persistente para SQLite y asignar permisos al usuario no-root
RUN mkdir -p /data && chown -R appuser:appuser /data /app

USER appuser

EXPOSE 8000

# Healthcheck que comprueba que la API responde 200 OK en /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

# Al arrancar, ejecuta las migraciones de Alembic y levanta Uvicorn
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app_conta.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

