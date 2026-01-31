#!/bin/bash

set -e

echo "🔐 Vectreal Platform - GitHub Secrets Setup"
echo "============================================"
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================
echo "📋 Checking prerequisites..."

# Check gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI is not installed. Please install it first:"
    echo "   brew install gh"
    echo "   # or visit: https://cli.github.com/"
    exit 1
fi

echo "✅ GitHub CLI found"
echo ""

# ============================================================================
# Check GitHub Authentication
# ============================================================================
echo "🔐 Checking GitHub authentication..."

if ! gh auth status &>/dev/null; then
    echo "⚠️  Not authenticated with GitHub CLI"
    echo ""
    read -p "Authenticate now? (y/n): " DO_AUTH
    if [[ "$DO_AUTH" == "y" ]]; then
        gh auth login
    else
        echo "❌ GitHub authentication required. Please run: gh auth login"
        exit 1
    fi
else
    echo "✅ Already authenticated"
fi
echo ""

# ============================================================================
# Load Secrets from .env.secrets.local
# ============================================================================
ENV_FILE="../apps/vectreal-platform/.env.secrets.local"

echo "📂 Checking for secrets file..."

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    echo ""
    echo "Create it from the example:"
    echo "   cp apps/vectreal-platform/.env.secrets.local.example apps/vectreal-platform/.env.secrets.local"
    echo "   # Then edit with your actual values"
    echo ""
    echo "Required variables:"
    echo "  - GCP_PROJECT_ID"
    echo "  - DATABASE_URL_PROD / DATABASE_URL_STAGING"
    echo "  - SUPABASE_URL_PROD / SUPABASE_URL_STAGING"
    echo "  - SUPABASE_KEY_PROD / SUPABASE_KEY_STAGING"
    echo "  - GCS_BUCKET_NAME_PROD / GCS_BUCKET_NAME_STAGING"
    echo "  - APPLICATION_URL_PROD / APPLICATION_URL_STAGING"
    exit 1
fi

echo "✅ Found secrets file"
echo ""
echo "📦 Loading secrets from .env.secrets.local..."

# Source the env file
set -a
source "$ENV_FILE"
set +a

# ============================================================================
# Validate Required Variables
# ============================================================================
echo "✓ Validating required variables..."

REQUIRED_VARS=(
    "GCP_PROJECT_ID"
    "DATABASE_URL_PROD"
    "SUPABASE_URL_PROD"
    "SUPABASE_KEY_PROD"
    "GCS_BUCKET_NAME_PROD"
    "APPLICATION_URL_PROD"
    "DATABASE_URL_STAGING"
    "SUPABASE_URL_STAGING"
    "SUPABASE_KEY_STAGING"
    "GCS_BUCKET_NAME_STAGING"
    "APPLICATION_URL_STAGING"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "❌ Error: Missing required variables in .env.secrets.local:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please edit apps/vectreal-platform/.env.secrets.local and add all required values"
    exit 1
fi

echo "✅ All required variables present"
echo ""

# ============================================================================
# Set GitHub Secrets
# ============================================================================
echo "🔑 Setting GitHub Secrets..."
echo ""

# GCP credentials (if they exist)
PROD_KEY="../credentials/gcp-prod-deployer-key.json"
STAGING_KEY="../credentials/gcp-staging-deployer-key.json"

if [ -f "$PROD_KEY" ] && [ -f "$STAGING_KEY" ]; then
    echo "→ Setting GCP credentials..."
    gh secret set GCP_CREDENTIALS < "$PROD_KEY"
    gh secret set GCP_CREDENTIALS_STAGING < "$STAGING_KEY"
    echo "  ✅ GCP credentials"
else
    echo "⚠️  Skipping GCP credentials (files not found)"
    echo "   Run './apply-infrastructure.sh' first to generate them"
fi

# GCP Project ID
echo "→ Setting GCP project IDs..."
gh secret set GCP_PROJECT_ID --body "$GCP_PROJECT_ID"
gh secret set GCP_PROJECT_ID_STAGING --body "$GCP_PROJECT_ID"
echo "  ✅ GCP project IDs"

# Production secrets
echo "→ Setting production secrets..."
gh secret set DATABASE_URL_PROD --body "$DATABASE_URL_PROD"
gh secret set SUPABASE_URL_PROD --body "$SUPABASE_URL_PROD"
gh secret set SUPABASE_KEY_PROD --body "$SUPABASE_KEY_PROD"
gh secret set GCS_BUCKET_NAME_PROD --body "$GCS_BUCKET_NAME_PROD"
gh secret set APPLICATION_URL_PROD --body "$APPLICATION_URL_PROD"
echo "  ✅ Production secrets (5)"

# Staging secrets
echo "→ Setting staging secrets..."
gh secret set DATABASE_URL_STAGING --body "$DATABASE_URL_STAGING"
gh secret set SUPABASE_URL_STAGING --body "$SUPABASE_URL_STAGING"
gh secret set SUPABASE_KEY_STAGING --body "$SUPABASE_KEY_STAGING"
gh secret set GCS_BUCKET_NAME_STAGING --body "$GCS_BUCKET_NAME_STAGING"
gh secret set APPLICATION_URL_STAGING --body "$APPLICATION_URL_STAGING"
echo "  ✅ Staging secrets (5)"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All GitHub secrets configured!"
echo ""
echo "📋 Verify secrets:"
echo "   gh secret list"
echo ""
echo "🔄 To rotate secrets:"
echo "   1. Edit apps/vectreal-platform/.env.secrets.local"
echo "   2. Run this script again: ./setup-github-secrets.sh"
echo "   3. Redeploy: git commit --allow-empty -m 'Rotate secrets' && git push"
echo ""
echo "🚀 Next Steps:"
echo "   Deploy your application:"
echo "   git push origin develop  # Deploy to staging"
echo "   git push origin main     # Deploy to production"
echo ""
