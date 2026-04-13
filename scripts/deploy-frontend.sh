#!/usr/bin/env bash
# deploy-frontend.sh — Deploy rápido del frontend al servidor de producción
# Uso: ./scripts/deploy-frontend.sh <usuario> <ip_servidor> [ruta_proyecto]
# Ejemplo: ./scripts/deploy-frontend.sh ubuntu 44.250.178.54 /home/ubuntu/NGcourses

set -euo pipefail

SERVER_USER="${1:?Falta usuario SSH. Uso: $0 <usuario> <ip> [ruta]}"
SERVER_IP="${2:?Falta IP del servidor. Uso: $0 <usuario> <ip> [ruta]}"
PROJECT_PATH="${3:-/home/${SERVER_USER}/NGcourses}"

echo "==> Haciendo push de los cambios locales..."
git push

echo ""
echo "==> Conectando al servidor ${SERVER_USER}@${SERVER_IP}..."
echo "    Proyecto en: ${PROJECT_PATH}"
echo ""

ssh -t "${SERVER_USER}@${SERVER_IP}" bash <<REMOTE
set -euo pipefail

cd "${PROJECT_PATH}"

echo "--- [1/3] Pulling últimos cambios de git..."
git pull

echo ""
echo "--- [2/3] Rebuildeando imagen del frontend..."
docker compose -f docker-compose.prod.yml -f docker-compose.prod-build.yml build frontend

echo ""
echo "--- [3/3] Reiniciando contenedor del frontend..."
docker compose -f docker-compose.prod.yml -f docker-compose.prod-build.yml up -d frontend

echo ""
echo "--- Verificando estado..."
sleep 3
docker compose -f docker-compose.prod.yml ps frontend

echo ""
echo "✓ Deploy completado."
REMOTE
