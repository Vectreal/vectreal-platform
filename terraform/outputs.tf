output "production_service_url" {
  description = "URL of the production Cloud Run service (only if managed by Terraform)"
  value       = var.manage_cloud_run_services ? google_cloud_run_v2_service.production[0].uri : "Not managed by Terraform - created by GitHub Actions"
}

output "staging_service_url" {
  description = "URL of the staging Cloud Run service (only if managed by Terraform)"
  value       = var.manage_cloud_run_services ? google_cloud_run_v2_service.staging[0].uri : "Not managed by Terraform - created by GitHub Actions"
}

output "production_service_name" {
  description = "Name of the production Cloud Run service"
  value       = var.production_service_name
}

output "staging_service_name" {
  description = "Name of the staging Cloud Run service"
  value       = var.staging_service_name
}

output "prod_deployer_email" {
  description = "Email of the production deployer service account"
  value       = google_service_account.prod_deployer.email
}

output "staging_deployer_email" {
  description = "Email of the staging deployer service account"
  value       = google_service_account.staging_deployer.email
}

output "runtime_service_account_email" {
  description = "Email of the runtime service account"
  value       = google_service_account.runtime.email
}

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "prod_deployer_key_path" {
  description = "Path to the production deployer service account key"
  value       = local_sensitive_file.prod_key.filename
  sensitive   = true
}

output "staging_deployer_key_path" {
  description = "Path to the staging deployer service account key"
  value       = local_sensitive_file.staging_key.filename
  sensitive   = true
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.vectreal.name
}

output "artifact_registry_location" {
  description = "Artifact Registry location"
  value       = google_artifact_registry_repository.vectreal.location
}

output "production_private_bucket_name" {
  description = "Production private Cloud Storage bucket name"
  value       = google_storage_bucket.private_production.name
}

output "staging_private_bucket_name" {
  description = "Staging private Cloud Storage bucket name"
  value       = google_storage_bucket.private_staging.name
}

output "local_dev_private_bucket_name" {
  description = "Local development private Cloud Storage bucket name"
  value       = google_storage_bucket.private_local_dev.name
}

output "local_dev_storage_key_path" {
  description = "Path to the local development storage service account key"
  value       = local_sensitive_file.local_dev_storage_key.filename
  sensitive   = true
}

output "staging_secondary_service_names" {
  description = "Names of the staging secondary-region Cloud Run services"
  value       = [for service in values(google_cloud_run_v2_service.staging_secondary) : service.name]
}

output "production_secondary_service_names" {
  description = "Names of the production secondary-region Cloud Run services"
  value       = [for service in values(google_cloud_run_v2_service.production_secondary) : service.name]
}

output "staging_edge_ip" {
  description = "Global IP address for staging edge load balancer (only when enabled)"
  value       = length(google_compute_global_address.staging_edge) > 0 ? google_compute_global_address.staging_edge[0].address : ""
}

output "staging_static_bucket_name" {
  description = "Public staging static bucket name (only when staging edge is enabled)"
  value       = length(google_storage_bucket.staging_static) > 0 ? google_storage_bucket.staging_static[0].name : ""
}

output "staging_edge_hosts" {
  description = "Hostnames configured for staging edge"
  value = {
    app_host    = var.staging_edge_host
    static_host = var.staging_static_host
  }
}

# GitHub Secrets Setup - Use the helper script
output "github_secrets_setup_help" {
  description = "How to set up GitHub secrets"
  value       = <<-EOT
    See ./scripts/setup-github-secrets.sh for automated setup.
    
    The script will:
    - Load secrets from .env.development
    - Set all GitHub Secrets automatically
    - Verify configuration
    
    Usage:
      ./scripts/setup-github-secrets.sh
  EOT
}

output "next_steps" {
  description = "What to do next"
  value       = <<-EOT
    ✅ Terraform infrastructure created successfully!
    
    Next steps:
    1. Configure deployment secrets:
       cp .env.development.example .env.development
       # Edit with your actual production and staging secrets

     1a. Local development storage credentials are generated automatically at:
       credentials/google-storage-local-dev-sa.json
    
    2. Set up GitHub secrets:
       ./scripts/setup-github-secrets.sh
    
    3. Verify secrets are set:
       gh secret list
    
     4. Deploy to staging:
       git push origin main

     5. Deploy to production:
       gh workflow run "CD - Deploy Platform to Production"

     6. Monitor deployment:
       https://github.com/${var.github_org}/${var.github_repo}/actions
    
    📚 Documentation:
    - ../terraform/README.md - Infrastructure details
  EOT
}
