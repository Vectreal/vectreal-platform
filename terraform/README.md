# Vectreal Platform - Infrastructure as Code

This directory contains the Terraform configuration for the Vectreal Platform. Terraform manages the **Cloudflare** side of the stack; the application itself runs on **Fly.io** and its data/storage lives in **Supabase**.

## What Terraform manages

All resources live in `cloudflare.tf` and are gated behind the `enable_cloudflare` flag (set `cloudflare_account_id` and a valid `cloudflare_api_token` to enable):

| Resource              | Purpose                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Turnstile widgets** | Bot-protection widgets for production and staging (`cloudflare_turnstile_widget`)                                                                                                                                                    |
| **DNS records**       | CNAMEs pointing `vectreal.com`, `www`, and `staging` at the Fly.io apps; MX records (Google Workspace + SES); SPF/DKIM/DMARC and verification TXT records; Fly.io `_acme-challenge` / `_fly-ownership` records for custom-domain TLS |
| **Cache rules**       | Edge caching ruleset - immutable `/assets/*` cached for 1 year, anonymous public SSR pages respect origin cache headers, all app/auth routes fail-closed                                                                             |
| **Legacy redirect**   | `core.vectreal.com` → `vectreal.com` (301)                                                                                                                                                                                           |

DNS records additionally require `cloudflare_zone_id` to be set.

### What Terraform does NOT manage

- Fly.io apps and deployments (see `apps/vectreal-platform/fly.toml` and the [Deployment docs](https://vectreal.com/docs/operations/deployment))
- Supabase project, database, and storage
- Application secrets (synced to Fly.io by `scripts/setup-fly-secrets.sh`)

There are no GCP resources (Cloud Run, GCS buckets, Artifact Registry, IAM, service accounts) provisioned by this configuration.

## Quick Start

### Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- A Cloudflare account managing the `vectreal.com` zone, with an API token that has `Turnstile:Edit` and DNS edit permissions
- A populated `.env.development` at the repo root (for the Fly.io secret sync)

### 1. Configure variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Fill in:
#   cloudflare_account_id
#   cloudflare_api_token   (>= 20 chars, or Turnstile/DNS provisioning stays disabled)
#   cloudflare_zone_id     (required for DNS records)
```

### 2. Apply the Cloudflare configuration

```bash
pnpm nx run terraform:plan-infrastructure    # init + validate + plan
pnpm nx run terraform:apply-infrastructure   # runs scripts/apply-infrastructure.sh
```

### 3. Sync Fly.io app secrets

`scripts/setup-fly-secrets.sh` reads `.env.development` and (a) sets Fly.io app secrets via `fly secrets set` and (b) syncs the Supabase `send_email` hook via the Management API:

```bash
pnpm nx run terraform:setup-fly-secrets-staging
pnpm nx run terraform:setup-fly-secrets-prod
pnpm nx run terraform:verify-fly-secrets      # read-only check
```

## Variables

| Variable                        | Default                | Description                                                        |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `cloudflare_account_id`         | `""`                   | Cloudflare account ID. Empty disables all Cloudflare provisioning. |
| `cloudflare_api_token`          | `""`                   | API token (min 20 chars) with Turnstile + DNS edit permissions.    |
| `cloudflare_zone_id`            | `""`                   | Zone ID for `vectreal.com`. Required for DNS records.              |
| `turnstile_production_hostname` | `vectreal.com`         | Allowed hostname for the production Turnstile widget.              |
| `turnstile_staging_hostname`    | `staging.vectreal.com` | Allowed hostname for the staging Turnstile widget.                 |

## Outputs

| Output                          | Description                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| `turnstile_production_site_key` | Turnstile site key for production (`CLOUDFLARE_TURNSTILE_SITE_KEY_PROD`) |
| `turnstile_staging_site_key`    | Turnstile site key for staging (`CLOUDFLARE_TURNSTILE_SITE_KEY_STAGING`) |

Both are marked `sensitive`. Read them with `terraform output -raw <name>`.

## State backend

Terraform state is stored in the GCS bucket `vectreal-terraform-state` (created manually, versioning enabled). The backend is configured in `main.tf`:

```hcl
backend "gcs" {
  bucket = "vectreal-terraform-state"
  prefix = "terraform/state"
}
```

## File structure

```
terraform/
├── README.md                   # This file
├── main.tf                     # Provider + GCS state backend
├── cloudflare.tf               # Turnstile widgets, DNS, cache rules, redirects
├── outputs.tf                  # Turnstile site key outputs
├── terraform.tfvars.example    # Configuration template
├── project.json                # Nx targets
└── scripts/
    ├── apply-infrastructure.sh # terraform init/validate/apply wrapper
    └── setup-fly-secrets.sh    # Fly.io secrets + Supabase email hook sync
```

## Nx targets

| Target                                                 | Command                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| `plan-infrastructure`                                  | `terraform init + validate + plan`           |
| `apply-infrastructure`                                 | Runs `scripts/apply-infrastructure.sh`       |
| `apply-infrastructure-auto-approve`                    | `terraform apply -auto-approve`              |
| `setup-fly-secrets-staging` / `setup-fly-secrets-prod` | Sync Fly.io secrets for one environment      |
| `verify-fly-secrets`                                   | Read-only check of current secret/hook state |

## Cache policy maintenance

Cloudflare Rule 2 literals are intentionally static in Terraform, but they are validated against the application cache policy source of truth:

- Policy source: `apps/vectreal-platform/app/lib/http/cdn-cache-policy.server.ts`
- Parity guard: `apps/vectreal-platform/tests/cloudflare-cache-parity.test.ts`

Update the policy module first, then align `terraform/cloudflare.tf` Rule 2, and run the parity test through Nx before applying infrastructure changes.

## Notes

- Turnstile is bypassed automatically outside production when the secret key is not set, so `CLOUDFLARE_TURNSTILE_SITE_KEY` and `CLOUDFLARE_TURNSTILE_SECRET_KEY` can be omitted for local development.
- Never commit `terraform.tfvars` (it holds the Cloudflare API token) - it is already git-ignored.

## Support

- [Terraform Documentation](https://www.terraform.io/docs)
- [Cloudflare Terraform Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Fly.io Docs](https://fly.io/docs/)
- [Vectreal Discord](https://discord.gg/A9a3nPkZw7)

For infrastructure issues, check the [GitHub Issues](https://github.com/vectreal/vectreal-platform/issues).
