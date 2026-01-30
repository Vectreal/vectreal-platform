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

# Create service account keys for GitHub Actions
resource "google_service_account_key" "prod_deployer_key" {
  service_account_id = google_service_account.prod_deployer.name
}

resource "google_service_account_key" "staging_deployer_key" {
  service_account_id = google_service_account.staging_deployer.name
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
