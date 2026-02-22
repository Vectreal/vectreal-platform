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
