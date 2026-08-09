#!/usr/bin/env bash
set -e

# Deploy Frontend (analyzer-web) to AWS S3 & invalidate CloudFront CDN cache
# Usage:
#   S3_BUCKET=my-s3-bucket CLOUDFRONT_DIST_ID=E123456789 ./scripts/deploy-frontend.sh

S3_BUCKET="${S3_BUCKET:-}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

if [ -z "$S3_BUCKET" ] || [ -z "$CLOUDFRONT_DIST_ID" ]; then
  echo "❌ Error: S3_BUCKET and CLOUDFRONT_DIST_ID environment variables are required."
  echo "Example:"
  echo "  S3_BUCKET=tech-parks-web CLOUDFRONT_DIST_ID=E123456789 ./scripts/deploy-frontend.sh"
  exit 1
fi

echo "📦 1. Building React Web Dashboard (analyzer-web)..."
pnpm --filter analyzer-web build

echo "☁️ 2. Syncing static build output to S3 bucket: $S3_BUCKET..."
aws s3 sync apps/analyzer-web/dist "s3://$S3_BUCKET" --delete --region "$AWS_REGION"

echo "⚡ 3. Invalidating CloudFront cache for distribution: $CLOUDFRONT_DIST_ID..."
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*"

echo "✅ Frontend deployment to S3 + CloudFront complete!"
