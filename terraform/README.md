# Vectreal Platform - Infrastructure as Code

This directory contains Terraform configurations for provisioning and managing the Google Cloud Platform infrastructure for the Vectreal Platform.

## Architecture Overview

The infrastructure follows a clean separation of concerns:

- **Terraform** manages GCP foundation: APIs, Artifact Registry, Cloud Storage buckets, Service Accounts, and IAM
- **GitHub Actions** manages deployments: Docker builds, Cloud Run services, and secrets injection
- **GitHub Secrets** stores all application secrets (no GCP Secret Manager needed)

This approach eliminates circular dependencies and reduces infrastructure complexity and costs.

## Quick Start

### Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (gcloud CLI)
- [GitHub CLI](https://cli.github.com/) (gh) - optional, for automated secrets setup
- GCP project with billing enabled

### Two-Step Setup

**Step 1: Apply Infrastructure**

```bash
cd terraform
./scripts/apply-infrastructure.sh
```

This script will:

1. ✅ Check prerequisites (terraform, gcloud)
2. ✅ Authenticate with Google Cloud
3. ✅ Help create terraform.tfvars
4. ✅ Initialize and validate Terraform
5. ✅ Show plan and apply infrastructure

**Step 2: Configure GitHub Secrets**

```bash
./scripts/setup-github-secrets.sh
```

This script will:

1. ✅ Check GitHub CLI authentication
2. ✅ Load secrets from `.env.development`
3. ✅ Validate all required variables
4. ✅ Set all 16 GitHub secrets automatically

### Manual Setup

If you prefer step-by-step control:

#### 1. Authenticate with GCP

```bash
gcloud auth application-default login
```

#### 2. Configure Terraform

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values:
# - project_id: Your GCP project ID
# - region: GCP region (default: us-central1)
# - github_org: Your GitHub organization or username
```

#### 3. Apply Infrastructure

```bash
terraform init
terraform plan
terraform apply
```

#### 4. Set GitHub Secrets

Create your secrets file:

```bash
cd ..
cp .env.development.example .env.development
# Edit .env.development with your actual values
```

Then set the secrets (choose one method):

**Option A: Using the setup script (recommended)**

```bash
cd ../../terraform
./scripts/setup-github-secrets.sh
```

**Option B: Manual using gh CLI**

```bash
# GCP credentials
gh secret set GCP_CREDENTIALS < terraform/credentials/gcp-prod-deployer-key.json
gh secret set GCP_CREDENTIALS_STAGING < terraform/credentials/gcp-staging-deployer-key.json
gh secret set GCP_PROJECT_ID --body "your-project-id"
gh secret set GCP_PROJECT_ID_STAGING --body "your-project-id"

# Load from .env.development
source .env.development
gh secret set DATABASE_URL_PROD --body "$DATABASE_URL_PROD"
gh secret set SUPABASE_URL_PROD --body "$SUPABASE_URL_PROD"
# ... (repeat for all secrets)
```

#### 5. Deploy

```bash
git push origin main                                 # Deploy to staging
gh workflow run "CD - Deploy Platform to Production" # Deploy to production
```

## What Gets Created

### GCP Resources

| Resource                    | Purpose                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Artifact Registry**       | Docker image storage (`vectreal-platform` repository)                                                            |
| **Private GCS Buckets**     | Environment-isolated buckets: production, staging, local development                                             |
| **Staging Edge (optional)** | Global HTTPS Load Balancer + Cloud CDN + public static assets bucket for low-latency staging rollout             |
| **Service Accounts**        | `vectreal-prod-deployer`, `vectreal-staging-deployer`, `vectreal-platform-runtime`, `vectreal-local-dev-storage` |
| **IAM Roles**               | Cloud Run Admin, Artifact Registry Writer, Storage Object Admin/Viewer                                           |
| **Enabled APIs**            | Cloud Run, IAM, Artifact Registry, Container Registry, Cloud Storage                                             |
| **Service Account Keys**    | Saved to `credentials/`                                                                                          |

### What is NOT Created by Terraform

- ❌ Secret Manager resources (using GitHub Secrets instead)
- ❌ Application secrets (stored in GitHub Secrets)

Cloud Run services are managed by Terraform in this repository by default (`manage_cloud_run_services = true`).
GitHub Actions deploys new revisions by updating image and runtime env vars on those services.

## Required GitHub Secrets

Set these via the setup script or manually:

### GCP Authentication (4 secrets)

- `GCP_CREDENTIALS` - Production deployer service account key
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_CREDENTIALS_STAGING` - Staging deployer service account key
- `GCP_PROJECT_ID_STAGING` - GCP project ID (typically same as prod)

### Production Secrets (6 secrets)

- `DATABASE_URL_PROD` - PostgreSQL connection string
- `SUPABASE_URL_PROD` - Supabase project URL
- `SUPABASE_KEY_PROD` - Supabase anonymous public key
- `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD` - Google Cloud Storage private bucket name
- `APPLICATION_URL_PROD` - Your production domain
- `CSRF_SECRET_PROD` - CSRF/session cookie signing secret

### Staging Secrets (6 secrets)

- `DATABASE_URL_STAGING` - Staging PostgreSQL connection string
- `SUPABASE_URL_STAGING` - Staging Supabase project URL
- `SUPABASE_KEY_STAGING` - Staging Supabase anonymous key
- `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING` - Staging private GCS bucket name
- `APPLICATION_URL_STAGING` - Staging domain
- `CSRF_SECRET_STAGING` - CSRF/session cookie signing secret

**Total: 16 GitHub Secrets**

## Configuration

### terraform.tfvars

```hcl
project_id = "your-gcp-project-id"
region     = "us-central1"
# Optional: keep staging in a dedicated region (for example Frankfurt)
# staging_region = "europe-west3"
github_org = "your-github-org"

# Optional: customize bucket names
# production_private_bucket_name = "vectreal-private-bucket"
# staging_private_bucket_name    = "vectreal-private-bucket-staging"
# local_dev_private_bucket_name  = "vectreal-private-bucket-dev"

# Optional: Bootstrap mode where GitHub Actions creates Cloud Run services
# manage_cloud_run_services = false  # default is true

# Optional: Staging-first latency quick wins
# enable_staging_edge = true
# staging_edge_host   = "staging.example.com"
# staging_static_host = "static-staging.example.com"
# staging_managed_certificate_domains = ["staging.example.com", "static-staging.example.com"]

# Optional: Secondary Cloud Run regions
# enable_multi_region_cloud_run = true
# staging_secondary_regions     = ["us-east1"]
# production_secondary_regions  = ["us-east1"]
```

### Staging-first latency rollout

1. Enable `enable_staging_edge` and set staging edge/static hosts and managed cert domains.
2. Apply Terraform to create:

- Global HTTPS Load Balancer frontend
- Cloud CDN-enabled backend bucket for static assets
- Cloud Run serverless NEGs for primary and optional secondary staging regions

3. Set GitHub Repository Variables (staging workflow):

- `STAGING_STATIC_BUCKET` (for example `vectreal-static-staging`)
- `STAGING_STATIC_CACHE_CONTROL` (optional, defaults to immutable assets)

4. Deploy to staging and validate cache hits before rolling the same pattern to production.

### State Backend

The Terraform state is stored in a GCS bucket. Create it once:

```bash
gcloud storage buckets create gs://your-project-id-terraform-state \
  --location=us-central1 \
  --project=your-project-id

gcloud storage buckets update gs://your-project-id-terraform-state \
  --versioning \
  --project=your-project-id
```

Then update `main.tf`:

```hcl
backend "gcs" {
  bucket = "your-project-id-terraform-state"
  prefix = "terraform/state"
}
```

## Deployment Workflow

```
Developer Push
      ↓
GitHub Actions
      ↓
   Build Docker Image
      ↓
 Push to Artifact Registry
      ↓
Create/Update Cloud Run Service
      ↓
   Inject Secrets from GitHub
      ↓
  Run Health Checks
      ↓
   Service Live
```

### Environments

Configure these manually in GitHub:

- **staging** - No protection rules, deploys from `main` branch
- **production** - Requires approvers, deploys via manual workflow dispatch
- **chromatic-publishing** - For Storybook deployments
- **packages-releasing** - For NPM package releases

## Common Operations

### View Infrastructure

```bash
terraform output                    # Show all outputs
terraform show                      # Show full state
terraform state list                # List all resources
```

### Update Secrets

1. Edit `.env.development`
2. Run: `./scripts/setup-github-secrets.sh`
3. Or manually: `gh secret set SECRET_NAME --body "new-value"`
4. Redeploy: `git push origin main`

### Destroy Infrastructure

```bash
terraform destroy
```

⚠️ **Warning**: This will delete all GCP resources but NOT the service account keys in `credentials/`. Remove those manually if needed.

## Troubleshooting

### "Error: API not enabled"

Enable the required APIs:

```bash
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  --project=your-project-id
```

### "Error: Permission denied"

Ensure you have the required IAM roles:

- `roles/owner` or `roles/editor` on the GCP project
- Admin access to the GitHub repository

### "Secret not found in GitHub Actions"

```bash
# Verify secrets are set
gh secret list

# Re-run secrets setup
cd terraform
./scripts/setup-github-secrets.sh
```

### Service Account Key Rotation

```bash
# Apply Terraform again (creates new keys)
terraform apply

# Update GitHub secrets
./scripts/setup-github-secrets.sh
```

## File Structure

```
terraform/
├── README.md                    # This file
├── main.tf                      # Provider and backend config
├── variables.tf                 # Input variables
├── outputs.tf                   # Output values
├── api-services.tf              # GCP API enablement
├── storage.tf                   # Private GCS buckets (prod/staging/local-dev)
├── static-assets.tf             # Public staging static bucket for CDN
├── service-accounts.tf          # Service accounts and IAM
├── cloud-run.tf                 # Cloud Run (optional)
├── cdn-lb.tf                    # Staging edge Global HTTPS LB + Cloud CDN
├── terraform.tfvars.example     # Configuration template
├── terraform.tfvars             # Your configuration (git-ignored)
├── scripts/                     # Setup automation scripts
│   ├── apply-infrastructure.sh  # Infrastructure setup script
│   └── setup-github-secrets.sh  # GitHub secrets configuration script
├── credentials/                 # Deployer service account keys (git-ignored)
    ├── gcp-prod-deployer-key.json
    └── gcp-staging-deployer-key.json
└── ../credentials/
    └── google-storage-local-dev-sa.json  # Local dev storage key generated by Terraform
```

## Security Best Practices

1. ✅ Never commit `terraform.tfvars` or `credentials/` to git (already in `.gitignore`)
2. ✅ Rotate service account keys quarterly
3. ✅ Store `.env.development` backup in secure vault (1Password, etc.)
4. ✅ Use least-privilege IAM roles
5. ✅ Enable GCP audit logging
6. ✅ Review GitHub Actions logs for security issues

## Cost Optimization

This infrastructure is designed to be cost-effective:

- ✅ No Secret Manager costs (~$1-5/month saved by using GitHub Secrets)
- ✅ Cloud Run scales to zero when not in use
- ✅ Artifact Registry storage only for active images
- ✅ No always-on compute resources

**Estimated monthly cost**: $0-20 depending on usage

## Support

- 📖 [Terraform Documentation](https://www.terraform.io/docs)
- 📖 [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- 📖 [GitHub Actions Documentation](https://docs.github.com/en/actions)
- 💬 [Vectreal Discord](https://discord.gg/A9a3nPkZw7)

For infrastructure issues, check the [GitHub Issues](https://github.com/YOUR-ORG/vectreal-platform/issues).
