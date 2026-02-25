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

locals {
  cloud_run_ingress_by_value = {
    all                               = "INGRESS_TRAFFIC_ALL"
    internal                          = "INGRESS_TRAFFIC_INTERNAL_ONLY"
    internal-and-cloud-load-balancing = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  }

  cloud_run_ingress              = lookup(local.cloud_run_ingress_by_value, var.allowed_ingress, "INGRESS_TRAFFIC_ALL")
  staging_region                 = var.staging_region != "" ? var.staging_region : var.region
  allow_public_invoker_effective = var.allow_public_cloud_run_invoker && !var.enable_edge
}

# Production Cloud Run Service (Optional - managed by GitHub Actions by default)
resource "google_cloud_run_v2_service" "production" {
  count               = var.manage_cloud_run_services ? 1 : 0
  name                = var.production_service_name
  location            = var.region
  ingress             = local.cloud_run_ingress
  deletion_protection = false

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
  count               = var.manage_cloud_run_services ? 1 : 0
  name                = var.staging_service_name
  location            = local.staging_region
  ingress             = local.cloud_run_ingress
  deletion_protection = false

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
  count    = var.manage_cloud_run_services && local.allow_public_invoker_effective ? 1 : 0
  location = google_cloud_run_v2_service.production[0].location
  name     = google_cloud_run_v2_service.production[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Public access for staging (only if managed by Terraform)
resource "google_cloud_run_v2_service_iam_member" "staging_public" {
  count    = var.manage_cloud_run_services && local.allow_public_invoker_effective ? 1 : 0
  location = google_cloud_run_v2_service.staging[0].location
  name     = google_cloud_run_v2_service.staging[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}