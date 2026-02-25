locals {
  enable_edge_ready = (
    var.enable_edge &&
    var.staging_edge_host != "" &&
    var.production_edge_host != "" &&
    length(var.managed_certificate_domains) > 0
  )

  staging_primary_region = var.staging_region != "" ? var.staging_region : var.region

  static_asset_paths = [
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
}

resource "google_compute_global_address" "edge" {
  count        = local.enable_edge_ready ? 1 : 0
  name         = "${var.production_service_name}-edge-ip"
  address_type = "EXTERNAL"

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_managed_ssl_certificate" "edge" {
  count = local.enable_edge_ready ? 1 : 0
  name  = "${var.production_service_name}-edge-cert"

  managed {
    domains = var.managed_certificate_domains
  }

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_region_network_endpoint_group" "staging_app" {
  count                 = local.enable_edge_ready ? 1 : 0
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

resource "google_compute_region_network_endpoint_group" "production_app" {
  count                 = local.enable_edge_ready ? 1 : 0
  name                  = "${var.production_service_name}-${var.region}-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.production_service_name
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.run
  ]
}

resource "google_compute_backend_bucket" "staging_static" {
  count       = local.enable_edge_ready ? 1 : 0
  name        = "${var.staging_service_name}-static-backend"
  bucket_name = google_storage_bucket.staging_static.name
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

resource "google_compute_backend_bucket" "production_static" {
  count       = local.enable_edge_ready ? 1 : 0
  name        = "${var.production_service_name}-static-backend"
  bucket_name = google_storage_bucket.production_static.name
  enable_cdn  = true

  cdn_policy {
    cache_mode  = "CACHE_ALL_STATIC"
    default_ttl = var.production_static_default_ttl_seconds
    max_ttl     = var.production_static_max_ttl_seconds
  }

  depends_on = [
    google_project_service.compute,
    google_storage_bucket.production_static
  ]
}

resource "google_compute_backend_service" "staging_app" {
  count                 = local.enable_edge_ready ? 1 : 0
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

  backend {
    group = google_compute_region_network_endpoint_group.staging_app[0].id
  }

  depends_on = [
    google_project_service.compute,
    google_compute_region_network_endpoint_group.staging_app
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_backend_service" "production_app" {
  count                 = local.enable_edge_ready ? 1 : 0
  name                  = "${var.production_service_name}-app-backend-managed"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  timeout_sec           = 30
  enable_cdn            = true

  cdn_policy {
    cache_mode  = "USE_ORIGIN_HEADERS"
    default_ttl = var.production_app_default_ttl_seconds
    max_ttl     = var.production_app_max_ttl_seconds
    client_ttl  = 0

    serve_while_stale = 60

    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false
    }
  }

  backend {
    group = google_compute_region_network_endpoint_group.production_app[0].id
  }

  depends_on = [
    google_project_service.compute,
    google_compute_region_network_endpoint_group.production_app
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_url_map" "edge" {
  count = local.enable_edge_ready ? 1 : 0
  name  = "${var.production_service_name}-edge-url-map"

  default_service = google_compute_backend_service.production_app[0].id

  host_rule {
    hosts        = [var.staging_edge_host]
    path_matcher = "staging-app"
  }

  host_rule {
    hosts        = [var.production_edge_host]
    path_matcher = "production-app"
  }

  path_matcher {
    name            = "staging-app"
    default_service = google_compute_backend_service.staging_app[0].id

    path_rule {
      paths   = local.static_asset_paths
      service = google_compute_backend_bucket.staging_static[0].id
    }
  }

  path_matcher {
    name            = "production-app"
    default_service = google_compute_backend_service.production_app[0].id

    path_rule {
      paths   = local.static_asset_paths
      service = google_compute_backend_bucket.production_static[0].id
    }
  }

  dynamic "host_rule" {
    for_each = var.staging_static_host != "" ? [1] : []
    content {
      hosts        = [var.staging_static_host]
      path_matcher = "staging-static"
    }
  }

  dynamic "path_matcher" {
    for_each = var.staging_static_host != "" ? [1] : []
    content {
      name            = "staging-static"
      default_service = google_compute_backend_bucket.staging_static[0].id
    }
  }

  dynamic "host_rule" {
    for_each = var.production_static_host != "" ? [1] : []
    content {
      hosts        = [var.production_static_host]
      path_matcher = "production-static"
    }
  }

  dynamic "path_matcher" {
    for_each = var.production_static_host != "" ? [1] : []
    content {
      name            = "production-static"
      default_service = google_compute_backend_bucket.production_static[0].id
    }
  }

  depends_on = [
    google_project_service.compute,
    google_compute_backend_service.staging_app,
    google_compute_backend_service.production_app,
    google_compute_backend_bucket.staging_static,
    google_compute_backend_bucket.production_static
  ]
}

resource "google_compute_target_https_proxy" "edge" {
  count            = local.enable_edge_ready ? 1 : 0
  name             = "${var.production_service_name}-edge-https-proxy"
  url_map          = google_compute_url_map.edge[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.edge[0].id]

  depends_on = [
    google_project_service.compute,
    google_compute_managed_ssl_certificate.edge
  ]
}

resource "google_compute_global_forwarding_rule" "edge_https" {
  count                 = local.enable_edge_ready ? 1 : 0
  name                  = "${var.production_service_name}-edge-https"
  target                = google_compute_target_https_proxy.edge[0].id
  ip_address            = google_compute_global_address.edge[0].address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [
    google_project_service.compute,
    google_compute_target_https_proxy.edge
  ]
}

resource "google_compute_url_map" "edge_http_redirect" {
  count = local.enable_edge_ready && var.edge_enable_http_redirect ? 1 : 0
  name  = "${var.production_service_name}-edge-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }

  depends_on = [
    google_project_service.compute
  ]
}

resource "google_compute_target_http_proxy" "edge_http_redirect" {
  count   = local.enable_edge_ready && var.edge_enable_http_redirect ? 1 : 0
  name    = "${var.production_service_name}-edge-http-proxy"
  url_map = google_compute_url_map.edge_http_redirect[0].id

  depends_on = [
    google_project_service.compute,
    google_compute_url_map.edge_http_redirect
  ]
}

resource "google_compute_global_forwarding_rule" "edge_http" {
  count                 = local.enable_edge_ready && var.edge_enable_http_redirect ? 1 : 0
  name                  = "${var.production_service_name}-edge-http"
  target                = google_compute_target_http_proxy.edge_http_redirect[0].id
  ip_address            = google_compute_global_address.edge[0].address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [
    google_project_service.compute,
    google_compute_target_http_proxy.edge_http_redirect
  ]
}
