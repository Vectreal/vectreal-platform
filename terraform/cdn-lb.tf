locals {
  enable_staging_edge_ready = var.enable_staging_edge && var.staging_edge_host != "" && length(var.staging_managed_certificate_domains) > 0
  staging_primary_region    = var.staging_region != "" ? var.staging_region : var.region

  staging_secondary_regions_enabled = local.enable_staging_edge_ready && var.enable_multi_region_cloud_run ? toset(var.staging_secondary_regions) : toset([])

  staging_app_neg_ids = local.enable_staging_edge_ready ? concat(
    [google_compute_region_network_endpoint_group.staging_app_primary[0].id],
    [for neg in values(google_compute_region_network_endpoint_group.staging_app_secondary) : neg.id]
  ) : []

  staging_edge_hosts   = compact([var.staging_edge_host])
  staging_static_hosts = compact([var.staging_static_host])
}

resource "google_compute_global_address" "staging_edge" {
  count        = local.enable_staging_edge_ready ? 1 : 0
  name         = "${var.staging_service_name}-edge-ip"
  address_type = "EXTERNAL"

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_managed_ssl_certificate" "staging_edge" {
  count = local.enable_staging_edge_ready ? 1 : 0
  name  = "${var.staging_service_name}-edge-cert"

  managed {
    domains = var.staging_managed_certificate_domains
  }

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_region_network_endpoint_group" "staging_app_primary" {
  count                 = local.enable_staging_edge_ready ? 1 : 0
  name                  = "${var.staging_service_name}-${local.staging_primary_region}-neg"
  region                = local.staging_primary_region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.staging_service_name
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.run
  ]
}

resource "google_compute_region_network_endpoint_group" "staging_app_secondary" {
  for_each              = local.staging_secondary_regions_enabled
  name                  = "${var.staging_service_name}-${each.value}-neg"
  region                = each.value
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = "${var.staging_service_name}-${each.value}"
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.run
  ]
}

resource "google_compute_backend_bucket" "staging_static" {
  count       = local.enable_staging_edge_ready ? 1 : 0
  name        = "${var.staging_service_name}-static-backend"
  bucket_name = google_storage_bucket.staging_static[0].name
  enable_cdn  = true

  cdn_policy {
    cache_mode  = "CACHE_ALL_STATIC"
    default_ttl = var.staging_static_default_ttl_seconds
    max_ttl     = var.staging_static_max_ttl_seconds
  }

  depends_on = [
    google_project_service.compute,
    google_storage_bucket.staging_static
  ]
}

resource "google_compute_backend_service" "staging_app" {
  count                 = local.enable_staging_edge_ready ? 1 : 0
  name                  = "${var.staging_service_name}-app-backend-managed"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  timeout_sec           = 30
  enable_cdn            = true

  cdn_policy {
    cache_mode  = "USE_ORIGIN_HEADERS"
    default_ttl = var.staging_app_default_ttl_seconds
    max_ttl     = var.staging_app_max_ttl_seconds
    client_ttl  = 0

    serve_while_stale = 60

    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false
    }
  }

  dynamic "backend" {
    for_each = local.staging_app_neg_ids
    content {
      group = backend.value
    }
  }

  depends_on = [
    google_project_service.compute,
    google_compute_region_network_endpoint_group.staging_app_primary
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_url_map" "staging_edge" {
  count           = local.enable_staging_edge_ready ? 1 : 0
  name            = "${var.staging_service_name}-edge-url-map"
  default_service = google_compute_backend_service.staging_app[0].id

  host_rule {
    hosts        = local.staging_edge_hosts
    path_matcher = "staging-app"
  }

  path_matcher {
    name            = "staging-app"
    default_service = google_compute_backend_service.staging_app[0].id

    path_rule {
      paths = [
        "/assets/*",
        "/build/*",
        "/draco/*",
        "/.well-known/*",
        "/favicon.ico",
        "/favicon-*",
        "/android-chrome-*",
        "/apple-touch-icon*",
        "/mstile-*",
        "/safari-pinned-tab.svg",
        "/site.webmanifest",
        "/browserconfig.xml"
      ]
      service = google_compute_backend_bucket.staging_static[0].id
    }
  }

  dynamic "host_rule" {
    for_each = length(local.staging_static_hosts) > 0 ? [1] : []
    content {
      hosts        = local.staging_static_hosts
      path_matcher = "staging-static"
    }
  }

  dynamic "path_matcher" {
    for_each = length(local.staging_static_hosts) > 0 ? [1] : []
    content {
      name            = "staging-static"
      default_service = google_compute_backend_service.staging_app[0].id

      path_rule {
        paths = [
          "/assets/*",
          "/build/*",
          "/draco/*",
          "/.well-known/*",
          "/favicon.ico",
          "/favicon-*",
          "/android-chrome-*",
          "/apple-touch-icon*",
          "/mstile-*",
          "/safari-pinned-tab.svg",
          "/site.webmanifest",
          "/browserconfig.xml"
        ]
        service = google_compute_backend_bucket.staging_static[0].id
      }
    }
  }

  depends_on = [
    google_project_service.compute,
    google_compute_backend_service.staging_app,
    google_compute_backend_bucket.staging_static
  ]
}

resource "google_compute_target_https_proxy" "staging_edge" {
  count            = local.enable_staging_edge_ready ? 1 : 0
  name             = "${var.staging_service_name}-edge-https-proxy"
  url_map          = google_compute_url_map.staging_edge[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.staging_edge[0].id]

  depends_on = [
    google_project_service.compute,
    google_compute_managed_ssl_certificate.staging_edge
  ]
}

resource "google_compute_global_forwarding_rule" "staging_edge_https" {
  count                 = local.enable_staging_edge_ready ? 1 : 0
  name                  = "${var.staging_service_name}-edge-https"
  target                = google_compute_target_https_proxy.staging_edge[0].id
  ip_address            = google_compute_global_address.staging_edge[0].address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [
    google_project_service.compute,
    google_compute_target_https_proxy.staging_edge
  ]
}

resource "google_compute_url_map" "staging_edge_http_redirect" {
  count = local.enable_staging_edge_ready && var.staging_edge_enable_http_redirect ? 1 : 0
  name  = "${var.staging_service_name}-edge-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_target_http_proxy" "staging_edge_http_redirect" {
  count   = local.enable_staging_edge_ready && var.staging_edge_enable_http_redirect ? 1 : 0
  name    = "${var.staging_service_name}-edge-http-proxy"
  url_map = google_compute_url_map.staging_edge_http_redirect[0].id

  depends_on = [
    google_project_service.compute,
    google_compute_url_map.staging_edge_http_redirect
  ]
}

resource "google_compute_global_forwarding_rule" "staging_edge_http" {
  count                 = local.enable_staging_edge_ready && var.staging_edge_enable_http_redirect ? 1 : 0
  name                  = "${var.staging_service_name}-edge-http"
  target                = google_compute_target_http_proxy.staging_edge_http_redirect[0].id
  ip_address            = google_compute_global_address.staging_edge[0].address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [
    google_project_service.compute,
    google_compute_target_http_proxy.staging_edge_http_redirect
  ]
}
