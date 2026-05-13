#!/bin/bash

set -e

echo "🗄️  Vectreal Platform - Bootstrap Local GCS Credentials"
echo "======================================================="
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================
echo "📋 Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it first:"
    echo "   brew install terraform"
    exit 1
fi

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
# Verify terraform.tfvars exists
# ============================================================================
if [ ! -f terraform.tfvars ]; then
    echo "❌ terraform.tfvars not found!"
    echo ""
    echo "Run the full infrastructure setup first:"
    echo "   pnpm nx run terraform:apply-infrastructure"
    echo ""
    echo "Or create terraform.tfvars from the example:"
    echo "   cp terraform.tfvars.example terraform.tfvars"
    echo "   # Edit with your GCP project details"
    exit 1
fi

# ============================================================================
# Initialize Terraform (if needed)
# ============================================================================
if [ ! -d ".terraform" ]; then
    echo "🔧 Initializing Terraform..."
    terraform init
    echo ""
fi

# ============================================================================
# Create credentials directory
# ============================================================================
mkdir -p ../credentials

# ============================================================================
# Apply targeted resources for local dev storage key
# ============================================================================
echo "🔑 Generating local dev storage service account key..."
echo ""

terraform apply \
    -var="create_service_account_keys=true" \
    -target="google_service_account_key.local_dev_storage_key" \
    -target="local_sensitive_file.local_dev_storage_key" \
    -auto-approve

echo ""
echo "✅ Local GCS credentials bootstrapped successfully!"
echo ""
echo "📁 Key saved to: credentials/google-storage-local-dev-sa.json"
echo ""
echo "📋 Next Steps:"
echo "  1. Add the following to your .env.development:"
echo "     GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-storage-local-dev-sa.json"
echo "     GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET=<your-local-dev-bucket-name>"
echo ""
echo "⚠️  Keep credentials/google-storage-local-dev-sa.json secret — it is git-ignored."
echo ""
