#!/usr/bin/env bash
# Restaura un dump de producción (pg_dump -Fc) en la BD local de docker compose.
# Uso: bash scripts/restore-db.sh <archivo.dump>
# ATENCIÓN: borra y reemplaza todos los datos de la BD local.

set -euo pipefail

DUMP="${1:?Uso: $0 <archivo.dump>}"
[ -f "$DUMP" ] || { echo "No existe: $DUMP" >&2; exit 1; }

cd "$(dirname "$0")/.."
set -a; source .env; set +a

CONTAINER="$(docker compose ps -q db)"
[ -n "$CONTAINER" ] || { echo "El servicio db no está corriendo (docker compose up -d db)" >&2; exit 1; }

export MSYS_NO_PATHCONV=1

echo "Copiando dump al contenedor..."
docker cp "$DUMP" "$CONTAINER:/tmp/restore.dump"

echo "Deteniendo backend para liberar conexiones..."
docker compose stop backend >/dev/null 2>&1 || true

echo "Recreando base de datos ${POSTGRES_DB}..."
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\" WITH (FORCE);" \
  -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

echo "Restaurando..."
docker exec "$CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-privileges --exit-on-error /tmp/restore.dump

docker exec "$CONTAINER" rm -f /tmp/restore.dump

echo "Versión alembic restaurada:"
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version_num FROM alembic_version;"

echo "Levantando backend (aplica migraciones pendientes en prestart)..."
docker compose start backend

echo "Listo."
