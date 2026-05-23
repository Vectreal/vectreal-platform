locals {
  optimization_function_source_dir = "${path.module}/../build/apps/vectreal-platform/functions/optimize-textures"
}

data "archive_file" "optimize_textures_source" {
  count       = var.enable_optimization_function ? 1 : 0
  type        = "zip"
  source_dir  = local.optimization_function_source_dir
  output_path = "${path.module}/optimize-textures-function.zip"
}

resource "google_storage_bucket" "functions_source" {
  count         = var.enable_optimization_function ? 1 : 0
  name          = "${var.project_id}-functions-source"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket_object" "optimize_textures_source" {
  count  = var.enable_optimization_function ? 1 : 0
  name   = "optimize-textures-${data.archive_file.optimize_textures_source[0].output_md5}.zip"
  bucket = google_storage_bucket.functions_source[0].name
  source = data.archive_file.optimize_textures_source[0].output_path
}

resource "google_cloudfunctions2_function" "optimize_textures" {
  count       = var.enable_optimization_function ? 1 : 0
  name        = var.optimization_function_name
  location    = var.region
  description = "Dedicated texture optimization runtime for Vectreal"

  build_config {
    runtime     = var.optimization_function_runtime
    entry_point = "optimizeTextures"

    source {
      storage_source {
        bucket = google_storage_bucket.functions_source[0].name
        object = google_storage_bucket_object.optimize_textures_source[0].name
      }
    }
  }

  service_config {
    service_account_email            = google_service_account.runtime.email
    min_instance_count               = var.optimization_function_min_instances
    max_instance_count               = var.optimization_function_max_instances
    available_cpu                    = var.optimization_function_cpu
    available_memory                 = var.optimization_function_memory
    timeout_seconds                  = var.optimization_function_timeout_seconds
    max_instance_request_concurrency = 1
    ingress_settings                 = var.optimization_function_ingress
    all_traffic_on_latest_revision   = true

    environment_variables = {
      NODE_ENV                       = "production"
      OPTIMIZE_TEXTURES_WORKER_TOKEN = var.optimization_worker_token
    }
  }

  depends_on = [
    google_project_service.cloudfunctions,
    google_project_service.cloudbuild,
    google_project_service.artifact_registry,
    google_project_service.run
  ]
}

resource "google_cloudfunctions2_function_iam_member" "optimize_textures_invoker" {
  count          = var.enable_optimization_function ? 1 : 0
  project        = var.project_id
  location       = var.region
  cloud_function = google_cloudfunctions2_function.optimize_textures[0].name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}