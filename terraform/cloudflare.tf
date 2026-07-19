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
  cloudflare_api_token_min_length = 20
  cloudflare_api_token_normalized = trimspace(var.cloudflare_api_token)
  cloudflare_api_token_is_valid   = length(local.cloudflare_api_token_normalized) >= local.cloudflare_api_token_min_length
  enable_cloudflare               = var.cloudflare_account_id != "" && local.cloudflare_api_token_is_valid
}

provider "cloudflare" {
  api_token = local.cloudflare_api_token_normalized
}

resource "cloudflare_turnstile_widget" "production" {
  count      = local.enable_cloudflare ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-platform-production"
  domains    = [var.turnstile_production_hostname]
  mode       = "managed"
}

resource "cloudflare_turnstile_widget" "staging" {
  count      = local.enable_cloudflare ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "vectreal-platform-staging"
  domains    = [var.turnstile_staging_hostname]
  mode       = "managed"
}

# =============================================================================
# DNS Records — Cloudflare proxies to Fly.io
# =============================================================================

resource "cloudflare_record" "vectreal_com" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "@"
  type            = "CNAME"
  content         = "vectreal-platform.fly.dev"
  proxied         = true
}

resource "cloudflare_record" "www" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "www"
  type            = "CNAME"
  content         = "vectreal-platform.fly.dev"
  proxied         = true
}

resource "cloudflare_record" "staging" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "staging"
  type            = "CNAME"
  content         = "vectreal-platform-staging.fly.dev"
  proxied         = true
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

  # Host guard shared by every rule.
  # Keep in sync with the app allowlist in
  # apps/vectreal-platform/app/lib/http/cacheable-public-paths.server.ts
  # (enforced by the cloudflare-cache-parity vitest test).

  # Rule 1 — Immutable hashed assets served by Fly.io: cache at edge for 1 year.
  rules {
    description = "Immutable hashed assets — cache 1 year"
    expression  = "((http.host eq \"vectreal.com\") or (http.host eq \"www.vectreal.com\") or (http.host eq \"staging.vectreal.com\")) and starts_with(http.request.uri.path, \"/assets/\")"
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

  # Rule 2 — Public allowlist documents and their single-fetch .data variants:
  # cacheable, honoring origin Cache-Control for BOTH edge and browser TTL so
  # the zone-default 4h Browser Cache TTL never rewrites the origin's max-age=0.
  # Cache key stays cookie-free (Cloudflare default). respect_origin means an
  # authenticated request (origin answers no-store) is still never stored.
  rules {
    description = "Public allowlist pages — respect origin cache headers"
    expression  = "((http.host eq \"vectreal.com\") or (http.host eq \"www.vectreal.com\") or (http.host eq \"staging.vectreal.com\")) and (http.request.uri.path in {\"/\" \"/home\" \"/about\" \"/changelog\" \"/code-of-conduct\" \"/contact\" \"/privacy-policy\" \"/terms-of-service\" \"/imprint\" \"/robots.txt\" \"/sitemap.xml\" \"/llms.txt\" \"/.data\" \"/home.data\" \"/about.data\" \"/changelog.data\" \"/code-of-conduct.data\" \"/contact.data\" \"/privacy-policy.data\" \"/terms-of-service.data\" \"/imprint.data\"} or starts_with(http.request.uri.path, \"/docs\") or starts_with(http.request.uri.path, \"/news-room\"))"
    action      = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode = "respect_origin"
      }
      browser_ttl {
        mode = "respect_origin"
      }
    }
  }

  # Rule 3 — Fail-closed catch-all: everything not matched above is never
  # edge-cached, regardless of origin headers. .data (except the allowlist
  # variants above), /api/*, /auth/*, dashboard, publisher, preview, onboarding.
  rules {
    description = "Fail-closed: bypass cache for everything else"
    expression  = "((http.host eq \"vectreal.com\") or (http.host eq \"www.vectreal.com\") or (http.host eq \"staging.vectreal.com\")) and not starts_with(http.request.uri.path, \"/assets/\") and not (http.request.uri.path in {\"/\" \"/home\" \"/about\" \"/changelog\" \"/code-of-conduct\" \"/contact\" \"/privacy-policy\" \"/terms-of-service\" \"/imprint\" \"/robots.txt\" \"/sitemap.xml\" \"/llms.txt\" \"/.data\" \"/home.data\" \"/about.data\" \"/changelog.data\" \"/code-of-conduct.data\" \"/contact.data\" \"/privacy-policy.data\" \"/terms-of-service.data\" \"/imprint.data\"} or starts_with(http.request.uri.path, \"/docs\") or starts_with(http.request.uri.path, \"/news-room\"))"
    action      = "set_cache_settings"
    action_parameters {
      cache = false
    }
  }
}

# =============================================================================
# Redirect: core.vectreal.com → vectreal.com (legacy domain retirement)
# Dummy A record is required for Cloudflare to intercept traffic via the proxy.
# =============================================================================

resource "cloudflare_record" "core" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "core"
  type            = "A"
  content         = "192.0.2.1"
  proxied         = true
}

resource "cloudflare_page_rule" "core_redirect" {
  count    = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id  = var.cloudflare_zone_id
  target   = "core.vectreal.com/*"
  priority = 1

  actions {
    forwarding_url {
      url         = "https://vectreal.com/$1"
      status_code = 301
    }
  }
}

# =============================================================================
# Fly.io TLS Certificate Validation
# Required because Cloudflare proxy (orange cloud) blocks HTTP-01 ACME challenge.
# DNS-01 challenge + ownership TXT allow Fly.io to issue certs for custom domains.
# =============================================================================

resource "cloudflare_record" "fly_ownership_staging" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_fly-ownership.staging"
  type            = "TXT"
  content         = "app-qjogpwp"
  proxied         = false
}

resource "cloudflare_record" "fly_acme_staging" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_acme-challenge.staging"
  type            = "CNAME"
  content         = "staging.vectreal.com.qjogpwp.flydns.net"
  proxied         = false
}

resource "cloudflare_record" "fly_ownership_prod" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_fly-ownership"
  type            = "TXT"
  content         = "app-9385eyy"
  proxied         = false
}

resource "cloudflare_record" "fly_acme_prod" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_acme-challenge"
  type            = "CNAME"
  content         = "vectreal.com.9385eyy.flydns.net"
  proxied         = false
}

resource "cloudflare_record" "fly_ownership_www" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_fly-ownership.www"
  type            = "TXT"
  content         = "app-9385eyy"
  proxied         = false
}

resource "cloudflare_record" "fly_acme_www" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_acme-challenge.www"
  type            = "CNAME"
  content         = "www.vectreal.com.9385eyy.flydns.net"
  proxied         = false
}

# =============================================================================
# MX Records
# =============================================================================

resource "cloudflare_record" "mx_google_primary" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "vectreal.com"
  type            = "MX"
  content         = "aspmx.l.google.com"
  priority        = 1
  proxied         = false
}

resource "cloudflare_record" "mx_google_alt1" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "vectreal.com"
  type            = "MX"
  content         = "alt1.aspmx.l.google.com"
  priority        = 5
  proxied         = false
}

resource "cloudflare_record" "mx_google_alt2" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "vectreal.com"
  type            = "MX"
  content         = "alt2.aspmx.l.google.com"
  priority        = 5
  proxied         = false
}

resource "cloudflare_record" "mx_google_alt3" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "vectreal.com"
  type            = "MX"
  content         = "alt3.aspmx.l.google.com"
  priority        = 10
  proxied         = false
}

resource "cloudflare_record" "mx_google_alt4" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "vectreal.com"
  type            = "MX"
  content         = "alt4.aspmx.l.google.com"
  priority        = 10
  proxied         = false
}

resource "cloudflare_record" "mx_ses_inbound" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "mail"
  type            = "MX"
  content         = "inbound-smtp.eu-west-1.amazonaws.com"
  priority        = 10
  proxied         = false
}

resource "cloudflare_record" "mx_ses_feedback" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "send.mail"
  type            = "MX"
  content         = "feedback-smtp.eu-west-1.amazonses.com"
  priority        = 10
  proxied         = false
}

# =============================================================================
# CNAME Records (infrastructure / verification)
# =============================================================================

resource "cloudflare_record" "google_site_verification_cname" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "2vrtxzfgvoc7"
  type            = "CNAME"
  content         = "gv-4tric6ghpyq5gr.dv.googlehosted.com"
  proxied         = false
}

resource "cloudflare_record" "domainconnect" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_domainconnect"
  type            = "CNAME"
  content         = "_domainconnect.domains.squarespace.com"
  proxied         = true
}

resource "cloudflare_record" "firebase_dkim1" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "firebase1._domainkey"
  type            = "CNAME"
  content         = "mail-vectreal-com.dkim1._domainkey.firebasemail.com"
  proxied         = false
}

resource "cloudflare_record" "firebase_dkim2" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "firebase2._domainkey"
  type            = "CNAME"
  content         = "mail-vectreal-com.dkim2._domainkey.firebasemail.com"
  proxied         = false
}

resource "cloudflare_record" "posthog_proxy" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "go"
  type            = "CNAME"
  content         = "b748e11b6bbb0c1c6303.cf-prod-eu-proxy.europehog.com"
  proxied         = true
}

# =============================================================================
# TXT Records (SPF, DKIM, DMARC, verification)
# =============================================================================

resource "cloudflare_record" "spf" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "@"
  type            = "TXT"
  content         = "v=spf1 include:_spf.google.com include:_spf.firebasemail.com ~all"
  proxied         = false
}

resource "cloudflare_record" "google_site_verification" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "@"
  type            = "TXT"
  content         = "google-site-verification=XPvO5u7EGXIMpX9t58UISEq0081eyiqLOYXOArJb38Q"
  proxied         = false
}

resource "cloudflare_record" "dmarc" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_dmarc"
  type            = "TXT"
  content         = "v=DMARC1; p=none;"
  proxied         = false
}

resource "cloudflare_record" "github_org_verification" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "_gh-vectreal-o"
  type            = "TXT"
  content         = "6ee506eb76"
  proxied         = false
}

resource "cloudflare_record" "google_dkim" {
  count           = local.enable_cloudflare && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  allow_overwrite = true
  name            = "google._domainkey"
  type            = "TXT"
  content         = "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqFG2z6CciKGe0s8ZYly+tvafMps9NUsqAkYXsk087+yPCAojr+Z9y5MxUHYiOvq1eIoxuKfPImfv5/4QWYmJ7lf4Ogk8GuZ0tNi7FNBtdKusjoMWfxlC7mqACQU2gx1JZgASCiZ4p0HNFe72Luzy6HYwUrCxpnTN4k9jQilcjg6revFThizw8uLfKxU75SLdVPLYUIUTGkQeJnof60fx+F63L6r1GI1FPS+Y97TphFj1jMePQzPJAyg9tqaqzWFG1h3EnDluFgC1TkHE39RMaSpAdw6Q+iAOQeHbXv6yJEFsqxT0pbkzkTu/uDCMoDZbzXJE9BelCn3aQXHkuIodywIDAQAB"
  proxied         = false
}
