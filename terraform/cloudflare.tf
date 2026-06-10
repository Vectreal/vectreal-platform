# =============================================================================
# Cloudflare Turnstile Widgets (optional - set cloudflare_account_id to enable)
# =============================================================================

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

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for vectreal.com (from zone overview sidebar)"
  type        = string
  default     = ""
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
  # Must satisfy Cloudflare provider api_token validation even when disabled.
  cloudflare_disabled_placeholder_token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  cloudflare_api_token_min_length       = 20
  cloudflare_api_token_normalized       = trimspace(var.cloudflare_api_token)
  cloudflare_api_token_is_valid         = can(regex("^[A-Za-z0-9_-]+$", local.cloudflare_api_token_normalized)) && length(local.cloudflare_api_token_normalized) >= local.cloudflare_api_token_min_length
  enable_cloudflare                     = var.cloudflare_account_id != "" && local.cloudflare_api_token_is_valid
  enable_turnstile                      = local.enable_cloudflare
}

provider "cloudflare" {
  api_token = local.enable_turnstile ? local.cloudflare_api_token_normalized : local.cloudflare_disabled_placeholder_token
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

# =============================================================================
# DNS Records — Cloudflare proxies to Fly.io
# static.* served directly from R2 via Custom Domain (no DNS record needed here)
# =============================================================================

resource "cloudflare_record" "vectreal_com" {
  count   = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "CNAME"
  content = "vectreal-platform.fly.dev"
  proxied = true
}

resource "cloudflare_record" "www" {
  count   = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = "vectreal-platform.fly.dev"
  proxied = true
}

resource "cloudflare_record" "staging" {
  count   = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "staging"
  type    = "CNAME"
  content = "vectreal-platform-staging.fly.dev"
  proxied = true
}

# =============================================================================
# R2 Static Asset Buckets
# Custom domains are connected via Cloudflare dashboard:
#   R2 → bucket → Settings → Custom Domains → Connect Domain
#   prod:    static.vectreal.com
#   staging: static-staging.vectreal.com
# =============================================================================

resource "cloudflare_r2_bucket" "static_prod" {
  count      = local.enable_cloudflare ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-static-prod"
  location   = "EEUR"
}

resource "cloudflare_r2_bucket" "static_staging" {
  count      = local.enable_cloudflare ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-static-staging"
  location   = "EEUR"
}

# =============================================================================
# Cache Rules
# =============================================================================

resource "cloudflare_ruleset" "cache_rules" {
  count   = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "vectreal-cache-rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules {
    description = "Immutable static assets (R2)"
    expression  = "(http.host eq \"static.vectreal.com\") or (http.host eq \"static-staging.vectreal.com\")"
    action      = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
  }

  rules {
    description = "SSR app pages — respect origin headers"
    expression  = "(http.host eq \"vectreal.com\") or (http.host eq \"www.vectreal.com\") or (http.host eq \"staging.vectreal.com\")"
    action      = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "respect_origin"
        default = 1
      }
    }
  }
}
