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
  value       = var.create_service_account_keys ? local_sensitive_file.prod_key[0].filename : ""
  sensitive   = true
}

output "staging_deployer_key_path" {
  description = "Path to the staging deployer service account key"
  value       = var.create_service_account_keys ? local_sensitive_file.staging_key[0].filename : ""
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
  value       = var.create_service_account_keys || var.create_local_dev_storage_key ? local_sensitive_file.local_dev_storage_key[0].filename : ""
  sensitive   = true
}

output "workload_identity_provider" {
  description = "Full Workload Identity Provider resource name - set as GCP_WIF_PROVIDER_PROD and GCP_WIF_PROVIDER_STAGING GitHub secrets"
  value       = var.enable_workload_identity ? google_iam_workload_identity_pool_provider.github_actions[0].name : ""
}

output "prod_deployer_sa_email" {
  description = "Production deployer service account email - set as GCP_SA_EMAIL_PROD GitHub secret"
  value       = google_service_account.prod_deployer.email
}

output "staging_deployer_sa_email" {
  description = "Staging deployer service account email - set as GCP_SA_EMAIL_STAGING GitHub secret"
  value       = google_service_account.staging_deployer.email
}

output "turnstile_production_site_key" {
  description = "Cloudflare Turnstile site key for production (set as CLOUDFLARE_TURNSTILE_SITE_KEY_PROD GitHub secret)"
  value       = local.enable_turnstile ? cloudflare_turnstile_widget.production[0].id : ""
  sensitive   = true
}

output "turnstile_staging_site_key" {
  description = "Cloudflare Turnstile site key for staging (set as CLOUDFLARE_TURNSTILE_SITE_KEY_STAGING GitHub secret)"
  value       = local.enable_turnstile ? cloudflare_turnstile_widget.staging[0].id : ""
  sensitive   = true
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
      pnpm nx run terraform:setup-github-secrets
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

     1a. Generate local development storage credentials (optional, local-only):
       pnpm nx run terraform:bootstrap-local-gcs
    
    2. Set up GitHub secrets:
       pnpm nx run terraform:setup-github-secrets
    
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

output "optimization_function_url" {
  description = "URL for the optimize-textures Cloud Function (empty when disabled)"
  value       = var.enable_optimization_function ? google_cloudfunctions2_function.optimize_textures[0].service_config[0].uri : ""
}
