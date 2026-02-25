resource "google_storage_bucket" "staging_static" {
  name          = var.staging_static_bucket_name
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Cache-Control", "ETag"]
    max_age_seconds = 3600
  }

  depends_on = [
    google_project_service.storage
  ]
}

resource "google_storage_bucket_iam_member" "staging_static_public_read" {
  bucket = google_storage_bucket.staging_static.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket" "production_static" {
  name          = var.production_static_bucket_name
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Cache-Control", "ETag"]
    max_age_seconds = 3600
  }

  depends_on = [
    google_project_service.storage
  ]
}

resource "google_storage_bucket_iam_member" "production_static_public_read" {
  bucket = google_storage_bucket.production_static.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
