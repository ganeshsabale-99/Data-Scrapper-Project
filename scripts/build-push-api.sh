#!/usr/bin/env bash
set -e

# Build backend (analyzer-api) Docker image (amd64) locally & push to ECR
# Usage:
#   ECR_REPO=123456789012.dkr.ecr.ap-south-1.amazonaws.com/tech-parks-api ./scripts/build-push-api.sh [tag]

IMAGE_TAG="${1:-latest}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_REPO="${ECR_REPO:-}"

if [ -z "$ECR_REPO" ]; then
  echo "❌ Error: ECR_REPO environment variable is required."
  echo "Example:"
  echo "  ECR_REPO=123456789012.dkr.ecr.ap-south-1.amazonaws.com/tech-parks-api ./scripts/build-push-api.sh latest"
  exit 1
fi

AWS_ACCOUNT_ID=$(echo "$ECR_REPO" | cut -d'.' -f1)

echo "🔐 1. Logging into AWS ECR ($AWS_REGION)..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

DOCKERFILE_PATH="${DOCKERFILE_PATH:-Dockerfile.api}"

echo "🐳 2. Building amd64 Docker image for analyzer-api using $DOCKERFILE_PATH..."
docker buildx build \
  --platform linux/amd64 \
  -f "$DOCKERFILE_PATH" \
  -t "$ECR_REPO:$IMAGE_TAG" \
  -t "$ECR_REPO:latest" \
  --push .

echo "✅ Docker image pushed successfully to $ECR_REPO:$IMAGE_TAG and $ECR_REPO:latest!"
