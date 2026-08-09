#!/usr/bin/env bash
set -e

# Remote EC2 Deployment Script with Health Check & Automated Rollback
# Executed via SSH on EC2 instance:
#   ssh -i key.pem ubuntu@EC2_IP 'ECR_REPO=... bash -s' < deploy/remote-deploy-api.sh [tag]

IMAGE_TAG="${1:-latest}"
CONTAINER_NAME="tech-parks-api"
BACKUP_CONTAINER="${CONTAINER_NAME}-backup"
ENV_FILE="/home/ubuntu/api.env"
HOST_PORT="${HOST_PORT:-4000}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

if [ -z "$ECR_REPO" ]; then
  echo "❌ Error: ECR_REPO environment variable is required."
  exit 1
fi

AWS_ACCOUNT_ID=$(echo "$ECR_REPO" | cut -d'.' -f1)

echo "🔐 1. Logging into AWS ECR on EC2..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "📥 2. Pulling Docker image: $ECR_REPO:$IMAGE_TAG..."
docker pull "$ECR_REPO:$IMAGE_TAG"

# Backup existing running container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "📦 3. Backing up running container ($CONTAINER_NAME -> $BACKUP_CONTAINER)..."
  docker stop "$BACKUP_CONTAINER" 2>/dev/null || true
  docker rm "$BACKUP_CONTAINER" 2>/dev/null || true
  docker stop "$CONTAINER_NAME"
  docker rename "$CONTAINER_NAME" "$BACKUP_CONTAINER"
fi

echo "🚀 4. Launching new container ($CONTAINER_NAME on port $HOST_PORT)..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart always \
  --env-file "$ENV_FILE" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  "$ECR_REPO:$IMAGE_TAG"

echo "🔍 5. Performing health checks (10 attempts over 50s)..."
HEALTH_CHECK_PASSED=false
for i in {1..10}; do
  sleep 5
  if curl -sf "http://localhost:${HOST_PORT}/health/live" >/dev/null 2>&1 || curl -sf "http://localhost:${HOST_PORT}/health" >/dev/null 2>&1; then
    HEALTH_CHECK_PASSED=true
    break
  fi
  echo "  Waiting for service readiness... ($i/10)"
done

if [ "$HEALTH_CHECK_PASSED" = true ]; then
  echo "✅ Health check passed! Purging backup container..."
  docker rm -f "$BACKUP_CONTAINER" 2>/dev/null || true
  echo "🎉 API Deployment successful!"
else
  echo "⚠️ Health check failed! Printing container logs..."
  docker logs --tail 50 "$CONTAINER_NAME" || true

  echo "⏪ Rolling back to previous backup container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  
  if docker ps -a --format '{{.Names}}' | grep -q "^${BACKUP_CONTAINER}$"; then
    docker rename "$BACKUP_CONTAINER" "$CONTAINER_NAME"
    docker start "$CONTAINER_NAME"
    echo "✅ Rollback complete. Previous version restored."
  fi
  exit 1
fi
