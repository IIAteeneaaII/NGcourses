#!/usr/bin/env bash
# deploy-frontend.sh — Build, push a ECR y deploy al servidor
# Uso: ./scripts/deploy-frontend.sh
# Requiere: AWS CLI configurado, Docker corriendo, acceso SSH con ngcourses-key.pem

set -euo pipefail

AWS_REGION="us-west-2"
AWS_ACCOUNT="314679576825"
ECR_REPO="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/ngcourses-frontend"
IMAGE_TAG="latest"
SERVER="ec2-user@44.250.178.54"
SSH_KEY="/c/Users/admin/ngcourses-key.pem"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "================================================"
echo " Deploy Frontend — NGcourses"
echo "================================================"

# 1. Login a ECR
echo ""
echo "[1/4] Login a ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# 2. Build imagen
echo ""
echo "[2/4] Buildeando imagen del frontend..."
docker build -t "${ECR_REPO}:${IMAGE_TAG}" ./frontend

# 3. Push a ECR
echo ""
echo "[3/4] Subiendo imagen a ECR..."
docker push "${ECR_REPO}:${IMAGE_TAG}"

# 4. Deploy en servidor
echo ""
echo "[4/4] Desplegando en el servidor..."
ssh $SSH_OPTS "$SERVER" bash <<'REMOTE'
set -euo pipefail
cd ~

echo "  Login a ECR..."
aws ecr get-login-password --region us-west-2 \
  | docker login --username AWS --password-stdin 314679576825.dkr.ecr.us-west-2.amazonaws.com 2>&1 | grep -v WARNING

echo "  Pulling nueva imagen..."
docker-compose -f docker-compose.prod.yml pull frontend

echo "  Reiniciando contenedor..."
docker-compose -f docker-compose.prod.yml up -d frontend

echo "  Verificando..."
sleep 3
docker-compose -f docker-compose.prod.yml ps
REMOTE

echo ""
echo "================================================"
echo " ✓ Deploy completado exitosamente"
echo "================================================"
