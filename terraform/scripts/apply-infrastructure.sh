#!/bin/bash

set -e

echo "🚀 Vectreal Platform - GCP Infrastructure Setup"
echo "================================================"
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================
echo "📋 Checking prerequisites..."

# Check terraform
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it first:"
    echo "   brew install terraform"
    exit 1
fi

# Check gcloud
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK is not installed. Please install it first:"
    echo "   brew install google-cloud-sdk"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# ============================================================================
# Authenticate with Google Cloud
# ============================================================================
echo "🔐 Checking Google Cloud authentication..."

if ! gcloud auth application-default print-access-token &> /dev/null; then
    echo "⚠️  Not authenticated with Google Cloud. Authenticating..."
    gcloud auth application-default login
else
    echo "✅ Already authenticated"
fi
echo ""

# ============================================================================
# Configure Terraform
# ============================================================================
echo "⚙️  Configuring Terraform..."

if [ ! -f terraform.tfvars ]; then
    echo "❌ terraform.tfvars not found!"
    echo ""
    echo "Create it from the example:"
    echo "   cp terraform.tfvars.example terraform.tfvars"
    echo "   # Edit terraform.tfvars with your GCP project details"
    echo ""
    read -p "Create terraform.tfvars now? (y/n): " CREATE_VARS
    
    if [[ "$CREATE_VARS" == "y" ]]; then
        cp terraform.tfvars.example terraform.tfvars
        echo "✅ Created terraform.tfvars"
        echo ""
        echo "Please edit terraform.tfvars with your values:"
        echo "   - project_id: Your GCP project ID"
        echo "   - region: GCP region (default: us-central1)"
        echo "   - github_org: Your GitHub organization or username"
        echo ""
        read -p "Press Enter after you've edited terraform.tfvars..."
    else
        exit 1
    fi
fi

# ============================================================================
# Initialize Terraform
# ============================================================================
echo ""
echo "🔧 Initializing Terraform..."
terraform init

echo "📐 Formatting Terraform files..."
terraform fmt

echo "✅ Validating Terraform configuration..."
terraform validate

# ============================================================================
# Plan & Apply
# ============================================================================
echo ""
echo "📋 Terraform Plan:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform plan

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Apply these changes? (yes/no): " APPLY

if [[ "$APPLY" != "yes" ]]; then
    echo "⏭️  Skipping apply. Run 'terraform apply' manually when ready."
    exit 0
fi

echo ""
echo "🚀 Applying Terraform configuration..."
terraform apply

echo ""
echo "✅ Infrastructure provisioned successfully!"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Infrastructure Setup Complete!"
echo ""
echo "📊 Terraform Outputs:"
terraform output
echo ""
echo "📋 Next Steps:"
echo "  0. Local development storage key is generated at:"
echo "     credentials/google-storage-local-dev-sa.json"
echo ""
echo "  1. Set up GitHub secrets:"
echo "     ./setup-github-secrets.sh"
echo ""
echo "  2. Configure GitHub Environments (if not already done):"
echo "     Settings → Environments → Create: staging, production"
echo ""
echo "  3. Deploy your application:"
echo "     git push origin develop  # Deploy to staging"
echo "     GitHub Actions → CD - Deploy Platform to Production → Run workflow"
echo "     # Provide image-uri from the staging deployment artifact"
echo ""
echo "🔗 Useful Commands:"
echo "  terraform output           # View outputs"
echo "  terraform destroy          # Tear down infrastructure"
echo ""
