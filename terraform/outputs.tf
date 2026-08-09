output "ec2_public_ip" {
  description = "Static Elastic IP address of the EC2 instance"
  value       = aws_eip.backend_eip.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of the Elastic IP"
  value       = aws_eip.backend_eip.public_dns
}

output "ecr_repository_url" {
  description = "URL of the created ECR Repository"
  value       = aws_ecr_repository.api.repository_url
}

output "s3_bucket_name" {
  description = "Name of the created S3 bucket for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront Distribution"
  value       = aws_cloudfront_distribution.frontend_cdn.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront Distribution"
  value       = aws_cloudfront_distribution.frontend_cdn.domain_name
}
