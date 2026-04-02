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
# Load Secrets from .env.development
# ============================================================================
ENV_FILE="../.env.development"

echo "📂 Checking for secrets file..."

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    echo ""
    echo "Create it from the example:"
    echo "   cp .env.development.example .env.development"
    echo "   # Then edit with your actual values"
    echo ""
    echo "Required variables:"
    echo "  - GCP_PROJECT_ID"
    echo "  - DATABASE_URL_PROD / DATABASE_URL_STAGING"
    echo "  - SUPABASE_URL_PROD / SUPABASE_URL_STAGING"
    echo "  - SUPABASE_KEY_PROD / SUPABASE_KEY_STAGING"
    echo "  - GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD / GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING"
    echo "  - APPLICATION_URL_PROD / APPLICATION_URL_STAGING"
    echo "  - CSRF_SECRET_PROD / CSRF_SECRET_STAGING"
    echo "  - STRIPE_SECRET_KEY_PROD / STRIPE_SECRET_KEY_STAGING"
    echo "Optional variables:"
    echo "  - RELEASE_APP_ID"
    echo "  - RELEASE_APP_PRIVATE_KEY"
    exit 1
fi

echo "✅ Found secrets file"
echo ""
echo "📦 Loading secrets from .env.development..."

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
    "GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD"
    "APPLICATION_URL_PROD"
    "CSRF_SECRET_PROD"
    "STRIPE_SECRET_KEY_PROD"
    "DATABASE_URL_STAGING"
    "SUPABASE_URL_STAGING"
    "SUPABASE_KEY_STAGING"
    "GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING"
    "APPLICATION_URL_STAGING"
    "CSRF_SECRET_STAGING"
    "STRIPE_SECRET_KEY_STAGING"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "❌ Error: Missing required variables in .env.development:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please edit .env.development and add all required values"
    exit 1
fi

echo "✅ All required variables present"
echo ""

RELEASE_APP_SECRETS_READY=true
if [ -z "$RELEASE_APP_ID" ] || [ -z "$RELEASE_APP_PRIVATE_KEY" ]; then
    RELEASE_APP_SECRETS_READY=false
fi

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

# Release workflow GitHub App secrets (optional)
if [ "$RELEASE_APP_SECRETS_READY" = true ]; then
    echo "→ Setting release workflow app secrets..."
    gh secret set RELEASE_APP_ID --body "$RELEASE_APP_ID"
    gh secret set RELEASE_APP_PRIVATE_KEY --body "$RELEASE_APP_PRIVATE_KEY"
    echo "  ✅ Release app secrets (2)"
else
    echo "⚠️  Skipping release app secrets"
    echo "   Set RELEASE_APP_ID and RELEASE_APP_PRIVATE_KEY in .env.development to enable app-based release automation"
fi

# Production secrets
echo "→ Setting production secrets..."
gh secret set DATABASE_URL_PROD --body "$DATABASE_URL_PROD"
gh secret set SUPABASE_URL_PROD --body "$SUPABASE_URL_PROD"
gh secret set SUPABASE_KEY_PROD --body "$SUPABASE_KEY_PROD"
gh secret set GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD --body "$GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD"
gh secret set APPLICATION_URL_PROD --body "$APPLICATION_URL_PROD"
gh secret set CSRF_SECRET_PROD --body "$CSRF_SECRET_PROD"
gh secret set STRIPE_SECRET_KEY_PROD --body "$STRIPE_SECRET_KEY_PROD"
echo "  ✅ Production secrets (7)"

# Staging secrets
echo "→ Setting staging secrets..."
gh secret set DATABASE_URL_STAGING --body "$DATABASE_URL_STAGING"
gh secret set SUPABASE_URL_STAGING --body "$SUPABASE_URL_STAGING"
gh secret set SUPABASE_KEY_STAGING --body "$SUPABASE_KEY_STAGING"
gh secret set GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING --body "$GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING"
gh secret set APPLICATION_URL_STAGING --body "$APPLICATION_URL_STAGING"
gh secret set CSRF_SECRET_STAGING --body "$CSRF_SECRET_STAGING"
gh secret set STRIPE_SECRET_KEY_STAGING --body "$STRIPE_SECRET_KEY_STAGING"
echo "  ✅ Staging secrets (7)"

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
echo "   1. Edit .env.development"
echo "   2. Run this script again: ./setup-github-secrets.sh"
echo "   3. Redeploy: git commit --allow-empty -m 'Rotate secrets' && git push"
echo ""
echo "🚀 Next Steps:"
echo "   Deploy your application:"
echo "   git push origin main                                 # Deploy to staging"
echo "   gh workflow run \"CD - Deploy Platform to Production\" # Deploy to production"
echo ""
