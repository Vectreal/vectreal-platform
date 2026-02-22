# =============================================================================
# Cloud Run Services
# =============================================================================
# 
# IMPORTANT: By default, Cloud Run services are NOT managed by Terraform to
# avoid circular dependencies during initial setup:
#
# 1. Terraform creates: APIs, Artifact Registry, Secrets (empty), Service Accounts
# 2. You populate secrets manually with actual values
# 3. GitHub Actions creates Cloud Run services on first deployment with secret refs
#
# This approach eliminates dependencies between infrastructure and deployment.
#
# To manage services via Terraform later, set: manage_cloud_run_services = true
# =============================================================================

# Production Cloud Run Service (Optional - managed by GitHub Actions by default)
resource "google_cloud_run_v2_service" "production" {
  count    = var.manage_cloud_run_services ? 1 : 0
  name     = var.production_service_name
  location = var.region
  ingress  = upper("INGRESS_TRAFFIC_${replace(var.allowed_ingress, "-", "_")}")

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.production_min_instances
      max_instance_count = var.production_max_instances
    }

    containers {
      # Placeholder image - GitHub Actions will replace this on deployment
      image = var.placeholder_image

      resources {
        limits = {
          cpu    = var.production_cpu
          memory = var.production_memory
        }
        cpu_idle = true
      }

      # Basic environment variables - GitHub Actions configures secrets
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_service_account.runtime
  ]

  lifecycle {
    ignore_changes = [
      # GitHub Actions manages these - ignore Terraform drift
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }
}

# Staging Cloud Run Service (Optional - managed by GitHub Actions by default)
resource "google_cloud_run_v2_service" "staging" {
  count    = var.manage_cloud_run_services ? 1 : 0
  name     = var.staging_service_name
  location = var.region
  ingress  = upper("INGRESS_TRAFFIC_${replace(var.allowed_ingress, "-", "_")}")

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.staging_min_instances
      max_instance_count = var.staging_max_instances
    }

    containers {
      # Placeholder image - GitHub Actions will replace this on deployment
      image = var.placeholder_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle = true
      }

      # Basic environment variables - GitHub Actions configures secrets
      env {
        name  = "NODE_ENV"
        value = "staging"
      }

      env {
        name  = "ENVIRONMENT"
        value = "staging"
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_service_account.runtime
  ]

  lifecycle {
    ignore_changes = [
      # GitHub Actions manages these - ignore Terraform drift
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }
}

# Public access for production (only if managed by Terraform)
resource "google_cloud_run_v2_service_iam_member" "production_public" {
  count    = var.manage_cloud_run_services ? 1 : 0
  location = google_cloud_run_v2_service.production[0].location
  name     = google_cloud_run_v2_service.production[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Public access for staging (only if managed by Terraform)
resource "google_cloud_run_v2_service_iam_member" "staging_public" {
  count    = var.manage_cloud_run_services ? 1 : 0
  location = google_cloud_run_v2_service.staging[0].location
  name     = google_cloud_run_v2_service.staging[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "production_secondary" {
  for_each = var.enable_multi_region_cloud_run ? toset(var.production_secondary_regions) : toset([])
  name     = "${var.production_service_name}-${each.value}"
  location = each.value
  ingress  = upper("INGRESS_TRAFFIC_${replace(var.allowed_ingress, "-", "_")}")

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.production_max_instances
    }

    containers {
      image = var.placeholder_image

      resources {
        limits = {
          cpu    = var.production_cpu
          memory = var.production_memory
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_service_account.runtime
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }
}

resource "google_cloud_run_v2_service" "staging_secondary" {
  for_each = var.enable_multi_region_cloud_run ? toset(var.staging_secondary_regions) : toset([])
  name     = "${var.staging_service_name}-${each.value}"
  location = each.value
  ingress  = upper("INGRESS_TRAFFIC_${replace(var.allowed_ingress, "-", "_")}")

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.staging_max_instances
    }

    containers {
      image = var.placeholder_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "staging"
      }

      env {
        name  = "ENVIRONMENT"
        value = "staging"
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_service_account.runtime
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "production_secondary_public" {
  for_each = var.enable_multi_region_cloud_run ? google_cloud_run_v2_service.production_secondary : {}
  location = each.value.location
  name     = each.value.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "staging_secondary_public" {
  for_each = var.enable_multi_region_cloud_run ? google_cloud_run_v2_service.staging_secondary : {}
  location = each.value.location
  name     = each.value.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
