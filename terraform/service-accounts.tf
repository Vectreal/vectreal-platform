# Service Account for Production Deployments
resource "google_service_account" "prod_deployer" {
  account_id   = "vectreal-prod-deployer"
  display_name = "Vectreal Production Deployer"
  description  = "Service account for GitHub Actions to deploy to production"
}

# Service Account for Staging Deployments
resource "google_service_account" "staging_deployer" {
  account_id   = "vectreal-staging-deployer"
  display_name = "Vectreal Staging Deployer"
  description  = "Service account for GitHub Actions to deploy to staging"
}

# Service Account for Application Runtime
resource "google_service_account" "runtime" {
  account_id   = "vectreal-platform-runtime"
  display_name = "Vectreal Platform Runtime"
  description  = "Service account for the Vectreal Platform application"
}

# Service Account for Local Development Storage Access
resource "google_service_account" "local_dev_storage" {
  account_id   = "vectreal-local-dev-storage"
  display_name = "Vectreal Local Dev Storage"
  description  = "Service account for local development storage access"
}

# IAM Bindings for Production Deployer
resource "google_project_iam_member" "prod_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.prod_deployer.email}"
}

resource "google_project_iam_member" "prod_deployer_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.prod_deployer.email}"
}

resource "google_project_iam_member" "prod_deployer_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.prod_deployer.email}"
}

resource "google_project_iam_member" "prod_deployer_storage_object_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.prod_deployer.email}"
}

# IAM Bindings for Staging Deployer
resource "google_project_iam_member" "staging_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.staging_deployer.email}"
}

resource "google_project_iam_member" "staging_deployer_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.staging_deployer.email}"
}

resource "google_project_iam_member" "staging_deployer_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.staging_deployer.email}"
}

resource "google_project_iam_member" "staging_deployer_storage_object_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.staging_deployer.email}"
}

# IAM Bindings for Runtime Service Account (for the app to access GCS, etc.)
resource "google_project_iam_member" "runtime_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_storage_admin_production" {
  bucket = google_storage_bucket.private_production.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_storage_admin_staging" {
  bucket = google_storage_bucket.private_staging.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_storage_bucket_iam_member" "local_dev_storage_admin" {
  bucket = google_storage_bucket.private_local_dev.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.local_dev_storage.email}"
}

# Create service account keys for GitHub Actions
resource "google_service_account_key" "prod_deployer_key" {
  service_account_id = google_service_account.prod_deployer.name
}

resource "google_service_account_key" "staging_deployer_key" {
  service_account_id = google_service_account.staging_deployer.name
}

resource "google_service_account_key" "local_dev_storage_key" {
  service_account_id = google_service_account.local_dev_storage.name
}

# Save keys to local files (be careful with these!)
resource "local_sensitive_file" "prod_key" {
  content  = base64decode(google_service_account_key.prod_deployer_key.private_key)
  filename = "${path.module}/../credentials/gcp-prod-deployer-key.json"
}

resource "local_sensitive_file" "staging_key" {
  content  = base64decode(google_service_account_key.staging_deployer_key.private_key)
  filename = "${path.module}/../credentials/gcp-staging-deployer-key.json"
}

resource "local_sensitive_file" "local_dev_storage_key" {
  content  = base64decode(google_service_account_key.local_dev_storage_key.private_key)
  filename = "${path.module}/../credentials/google-storage-local-dev-sa.json"
}
