variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "github_org" {
  description = "GitHub organization or user name"
  type        = string
  default     = "vectreal"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "vectreal-platform"
}

variable "production_service_name" {
  description = "Name of the production Cloud Run service"
  type        = string
  default     = "vectreal-platform"
}

variable "staging_service_name" {
  description = "Name of the staging Cloud Run service"
  type        = string
  default     = "vectreal-platform-staging"
}

variable "production_private_bucket_name" {
  description = "Name of the production private Cloud Storage bucket"
  type        = string
  default     = "vectreal-private-bucket"
}

variable "staging_private_bucket_name" {
  description = "Name of the staging private Cloud Storage bucket"
  type        = string
  default     = "vectreal-private-bucket-staging"
}

variable "local_dev_private_bucket_name" {
  description = "Name of the local development private Cloud Storage bucket"
  type        = string
  default     = "vectreal-private-bucket-dev"
}

variable "production_min_instances" {
  description = "Minimum number of instances for production"
  type        = number
  default     = 0
}

variable "production_max_instances" {
  description = "Maximum number of instances for production"
  type        = number
  default     = 50
}

variable "staging_min_instances" {
  description = "Minimum number of instances for staging"
  type        = number
  default     = 0
}

variable "staging_max_instances" {
  description = "Maximum number of instances for staging"
  type        = number
  default     = 10
}

variable "memory" {
  description = "Memory allocation for Cloud Run services"
  type        = string
  default     = "2Gi"
}

variable "cpu" {
  description = "CPU allocation for Cloud Run services"
  type        = string
  default     = "2"
}

variable "production_memory" {
  description = "Memory allocation for production Cloud Run service"
  type        = string
  default     = "4Gi"
}

variable "production_cpu" {
  description = "CPU allocation for production Cloud Run service"
  type        = string
  default     = "4"
}

variable "allowed_ingress" {
  description = "Ingress settings for Cloud Run services"
  type        = string
  default     = "all" # Options: "all", "internal", "internal-and-cloud-load-balancing"
}

variable "manage_cloud_run_services" {
  description = "Whether to manage Cloud Run services via Terraform. Set to false for initial setup, true after first GitHub Actions deployment."
  type        = bool
  default     = true
}

variable "placeholder_image" {
  description = "Placeholder Docker image for initial Cloud Run service creation (only used if manage_cloud_run_services=true)"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "enable_staging_edge" {
  description = "Whether to provision a staging Global HTTPS Load Balancer with Cloud CDN"
  type        = bool
  default     = false
}

variable "staging_edge_host" {
  description = "Staging hostname served by the edge load balancer (for example, staging.example.com)"
  type        = string
  default     = ""
}

variable "staging_static_host" {
  description = "Optional dedicated static hostname for staging assets (for example, static-staging.example.com)"
  type        = string
  default     = ""
}

variable "staging_managed_certificate_domains" {
  description = "Domains to include in the Google-managed SSL certificate for staging edge"
  type        = list(string)
  default     = []
}

variable "staging_edge_enable_http_redirect" {
  description = "Whether to create an HTTP forwarding rule that redirects to HTTPS for staging edge"
  type        = bool
  default     = true
}

variable "staging_static_bucket_name" {
  description = "Name of the public staging static assets bucket used by Cloud CDN"
  type        = string
  default     = "vectreal-static-staging"
}

variable "staging_static_cache_control" {
  description = "Default Cache-Control header applied to uploaded staging static assets"
  type        = string
  default     = "public, max-age=31536000, immutable"
}

variable "staging_app_default_ttl_seconds" {
  description = "Default CDN TTL for staging app backend responses when cacheable"
  type        = number
  default     = 0
}

variable "staging_app_max_ttl_seconds" {
  description = "Maximum CDN TTL for staging app backend responses when cacheable"
  type        = number
  default     = 60
}

variable "staging_static_default_ttl_seconds" {
  description = "Default CDN TTL for staging static backend bucket"
  type        = number
  default     = 3600
}

variable "staging_static_max_ttl_seconds" {
  description = "Maximum CDN TTL for staging static backend bucket"
  type        = number
  default     = 31536000
}

variable "enable_multi_region_cloud_run" {
  description = "Whether to provision secondary-region Cloud Run services for latency optimization"
  type        = bool
  default     = false
}

variable "staging_secondary_regions" {
  description = "Additional regions for staging Cloud Run service replicas"
  type        = list(string)
  default     = []
}

variable "production_secondary_regions" {
  description = "Additional regions for production Cloud Run service replicas"
  type        = list(string)
  default     = []
}
