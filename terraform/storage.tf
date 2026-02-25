# Private storage buckets per environment
resource "google_storage_bucket" "private_production" {
  name          = var.production_private_bucket_name
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket" "private_staging" {
  name          = var.staging_private_bucket_name
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket" "private_local_dev" {
  name          = var.local_dev_private_bucket_name
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}
