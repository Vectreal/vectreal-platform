# =============================================================================
# Cloudflare Turnstile Widgets (optional - set cloudflare_account_id to enable)
# =============================================================================

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID. Leave empty to skip Turnstile widget provisioning."
  type        = string
  default     = ""
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Turnstile:Edit permission. Leave empty to skip."
  type        = string
  default     = ""
  sensitive   = true
}

variable "turnstile_production_hostname" {
  description = "Allowed hostname for the production Turnstile widget (e.g. vectreal.com)"
  type        = string
  default     = "vectreal.com"
}

variable "turnstile_staging_hostname" {
  description = "Allowed hostname for the staging Turnstile widget (e.g. staging.vectreal.com)"
  type        = string
  default     = "staging.vectreal.com"
}

locals {
  enable_turnstile = var.cloudflare_account_id != "" && var.cloudflare_api_token != ""
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_turnstile_widget" "production" {
  count      = local.enable_turnstile ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-platform-production"
  domains    = [var.turnstile_production_hostname]
  mode       = "managed"
}

resource "cloudflare_turnstile_widget" "staging" {
  count      = local.enable_turnstile ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-platform-staging"
  domains    = [var.turnstile_staging_hostname]
  mode       = "managed"
}
