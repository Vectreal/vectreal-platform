output "turnstile_production_site_key" {
  description = "Cloudflare Turnstile site key for production (CLOUDFLARE_TURNSTILE_SITE_KEY_PROD)"
  value       = local.enable_cloudflare ? cloudflare_turnstile_widget.production[0].id : ""
  sensitive   = true
}

output "turnstile_staging_site_key" {
  description = "Cloudflare Turnstile site key for staging (CLOUDFLARE_TURNSTILE_SITE_KEY_STAGING)"
  value       = local.enable_cloudflare ? cloudflare_turnstile_widget.staging[0].id : ""
  sensitive   = true
}
