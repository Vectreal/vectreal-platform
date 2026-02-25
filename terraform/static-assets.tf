resource "google_storage_bucket" "staging_static" {
  count         = var.enable_staging_edge ? 1 : 0
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
  count  = var.enable_staging_edge ? 1 : 0
  bucket = google_storage_bucket.staging_static[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
