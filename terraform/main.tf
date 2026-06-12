terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Remote state in GCS — bucket was created manually, keep as-is
  backend "gcs" {
    bucket = "vectreal-terraform-state"
    prefix = "terraform/state"
  }
}
