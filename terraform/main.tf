terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Remote state in GCS - IMPORTANT: Create this bucket manually before using
  # To create: gcloud storage buckets create gs://YOUR-PROJECT-ID-terraform-state --location=us-central1
  backend "gcs" {
    bucket = "vectreal-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
