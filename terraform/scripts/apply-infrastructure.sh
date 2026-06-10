#!/bin/bash

set -e

echo "🚀 Vectreal Platform - Cloudflare Infrastructure"
echo "================================================"
echo ""

if ! command -v terraform &> /dev/null; then
  echo "❌ Terraform is not installed: brew install terraform"
  exit 1
fi

echo "✅ Prerequisites OK"
echo ""

if [ ! -f terraform.tfvars ]; then
  echo "❌ terraform.tfvars not found!"
  echo ""
  echo "  cp terraform.tfvars.example terraform.tfvars"
  echo "  # Fill in cloudflare_account_id, cloudflare_api_token, cloudflare_zone_id"
  echo ""
  read -r -p "Create from example now? (y/n): " CREATE_VARS
  if [[ "$CREATE_VARS" == "y" ]]; then
    cp terraform.tfvars.example terraform.tfvars
    echo "✅ Created terraform.tfvars — edit it before continuing."
    exit 0
  else
    exit 1
  fi
fi

echo "🔧 Initializing Terraform..."
terraform init

echo "📐 Formatting..."
terraform fmt

echo "✅ Validating..."
terraform validate

echo ""
echo "📋 Terraform Plan:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform plan

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "Apply these changes? (yes/no): " APPLY

if [[ "$APPLY" != "yes" ]]; then
  echo "⏭️  Skipping. Run 'terraform apply' manually when ready."
  exit 0
fi

terraform apply

echo ""
echo "✅ Cloudflare infrastructure updated!"
echo ""
echo "📋 Outputs:"
terraform output

echo ""
echo "📋 Next Steps:"
echo "  Set Fly.io runtime secrets:"
echo "    pnpm nx run terraform:setup-fly-secrets-staging"
echo "    pnpm nx run terraform:setup-fly-secrets-prod"
echo ""
echo "  Verify:"
echo "    pnpm nx run terraform:verify-fly-secrets"
