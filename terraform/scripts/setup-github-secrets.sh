#!/usr/bin/env bash

# =============================================================================
# Vectreal Platform — GitHub Secrets + Supabase Hook Sync
# =============================================================================
# Usage:
#   ./setup-github-secrets.sh               # sync everything (both envs)
#   ./setup-github-secrets.sh --env staging # sync staging only
#   ./setup-github-secrets.sh --env prod    # sync production only
#   ./setup-github-secrets.sh --verify      # read-only: check current state
#   ./setup-github-secrets.sh --help        # show this help
#
# Reads from .env.development at the repo root.
# Syncs:
#   1. GitHub Actions secrets
#   2. Supabase send_email hook URI + secret (via Management API)
# =============================================================================

# ---------------------------------------------------------------------------
# Colours (printf-based, portable across bash and zsh)
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()      { printf "  ${GREEN}✓${NC}  %s\n" "$*"; }
warn()    { printf "  ${YELLOW}⚠${NC}  %s\n" "$*"; }
err()     { printf "  ${RED}✗${NC}  %s\n" "$*"; }
section() { printf "\n${BOLD}%s${NC}\n" "$*"; }

# ---------------------------------------------------------------------------
# Bookkeeping
# ---------------------------------------------------------------------------
SECRETS_SET=()
SECRETS_FAILED=()
SECRETS_SKIPPED=()
HOOKS_SYNCED=()
HOOKS_FAILED=()

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
MODE="sync"   # sync | verify
ENV_FILTER="" # "" | staging | prod

show_help() {
  grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \{0,2\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify) MODE="verify"; shift ;;
    --env)
      shift
      case "$1" in
        staging|prod) ENV_FILTER="$1"; shift ;;
        *) printf "${RED}Error:${NC} --env must be 'staging' or 'prod'\n"; exit 1 ;;
      esac
      ;;
    --help|-h) show_help ;;
    *) printf "${RED}Error:${NC} Unknown flag: $1\n"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

printf "\n${BOLD}Vectreal Platform — Secrets Sync${NC}\n"
printf "==================================\n"
[[ "$MODE" == "verify" ]] && printf "  Mode: ${CYAN}verify (read-only)${NC}\n"
[[ -n "$ENV_FILTER" ]]    && printf "  Env:  ${CYAN}%s only${NC}\n" "$ENV_FILTER"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
section "Prerequisites"

PREREQ_FAILED=false
for cmd in gh curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "$cmd is not installed"
    PREREQ_FAILED=true
  else
    ok "$cmd"
  fi
done

if [[ "$PREREQ_FAILED" == "true" ]]; then
  printf "\n"
  err "Install missing tools before continuing (brew install gh curl jq)"
  exit 1
fi

# ---------------------------------------------------------------------------
# GitHub auth
# ---------------------------------------------------------------------------
section "GitHub authentication"

if ! gh auth status &>/dev/null; then
  warn "Not authenticated — launching gh auth login..."
  gh auth login || { err "Authentication failed"; exit 1; }
fi
ok "Authenticated"

# ---------------------------------------------------------------------------
# Load .env.development
# ---------------------------------------------------------------------------
ENV_FILE="$REPO_ROOT/.env.development"

section "Environment file"

if [[ ! -f "$ENV_FILE" ]]; then
  err "$ENV_FILE not found"
  printf "\n"
  printf "  Create it from the example:\n"
  printf "    cp .env.development.example .env.development\n"
  printf "    # then fill in your values\n"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ok "$ENV_FILE loaded"

# ---------------------------------------------------------------------------
# Validate required variables
# ---------------------------------------------------------------------------
section "Validating required variables"

REQUIRED_SHARED=(
  "GCP_PROJECT_ID"
  "FROM_EMAIL"
  "CONTACT_INBOX_EMAIL"
  "SUPABASE_ACCESS_TOKEN"
)

REQUIRED_STAGING=(
  "SUPABASE_PROJECT_REF_STAGING"
  "DATABASE_URL_STAGING"
  "SUPABASE_URL_STAGING"
  "SUPABASE_KEY_STAGING"
  "GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_STAGING"
  "APPLICATION_URL_STAGING"
  "CSRF_SECRET_STAGING"
  "STRIPE_SECRET_KEY_STAGING"
  "SEND_EMAIL_HOOK_SECRET_STAGING"
  "CLOUDFLARE_TURNSTILE_SITE_KEY_STAGING"
  "CLOUDFLARE_TURNSTILE_SECRET_KEY_STAGING"
  "RESEND_API_KEY_STAGING"
)

REQUIRED_PROD=(
  "SUPABASE_PROJECT_REF_PROD"
  "DATABASE_URL_PROD"
  "SUPABASE_URL_PROD"
  "SUPABASE_KEY_PROD"
  "GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET_PROD"
  "APPLICATION_URL_PROD"
  "CSRF_SECRET_PROD"
  "STRIPE_SECRET_KEY_PROD"
  "SEND_EMAIL_HOOK_SECRET_PROD"
  "CLOUDFLARE_TURNSTILE_SITE_KEY_PROD"
  "CLOUDFLARE_TURNSTILE_SECRET_KEY_PROD"
  "RESEND_API_KEY_PROD"
)

MISSING=()
check_vars() {
  for var in "$@"; do
    [[ -z "${!var}" ]] && MISSING+=("$var")
  done
}

check_vars "${REQUIRED_SHARED[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && check_vars "${REQUIRED_STAGING[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod"    ]] && check_vars "${REQUIRED_PROD[@]}"

if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Missing required variables in .env.development:"
  for v in "${MISSING[@]}"; do printf "      %s\n" "$v"; done
  printf "\n"
  printf "  Tip: SUPABASE_ACCESS_TOKEN — generate at https://supabase.com/dashboard/account/tokens\n"
  exit 1
fi

ok "All required variables present"

# Hook secret format check
check_hook_secret_format() {
  local val=$1 label=$2
  # Accept both the full Supabase dashboard format ("v1,whsec_<b64>") and a
  # plain base64 payload (already stripped). Reject obviously empty or
  # whitespace-only values.
  local stripped
  stripped=$(printf '%s' "$val" | sed -e 's/^v1,whsec_//' -e 's/^whsec_//' | tr -d ' \r\n')
  [[ -z "$stripped" ]] && warn "$label appears empty after stripping known prefixes"
}

[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  check_hook_secret_format "$SEND_EMAIL_HOOK_SECRET_STAGING" "SEND_EMAIL_HOOK_SECRET_STAGING"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
  check_hook_secret_format "$SEND_EMAIL_HOOK_SECRET_PROD" "SEND_EMAIL_HOOK_SECRET_PROD"

# ---------------------------------------------------------------------------
# Helper: extract a field from Supabase API JSON
# The auth config response may contain raw control chars in jwt_secret etc.
# Strip them before feeding to jq, then fall back to grep if jq still fails.
# ---------------------------------------------------------------------------
supabase_json_field() {
  local json="$1" field="$2" default="${3:-}"
  local cleaned value

  # Remove ASCII control chars except tab (\x09) and newline (\x0a)
  cleaned=$(printf '%s' "$json" | LC_ALL=C tr -d '\000-\010\013-\037')

  value=$(printf '%s' "$cleaned" | jq -r ".$field // empty" 2>/dev/null)

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    # Fallback: extract with grep for simple string/bool fields
    printf '%s' "$json" | grep -o "\"${field}\":[^,}]*" | head -1 | sed 's/.*: *//' | tr -d '"' || printf '%s' "$default"
  fi
}

# ===========================================================================
# VERIFY MODE
# ===========================================================================
if [[ "$MODE" == "verify" ]]; then

  section "GitHub Secrets (existence check)"

  check_gh_secret() {
    local name=$1
    if gh secret list 2>/dev/null | grep -q "^${name}[[:space:]]"; then
      ok "$name exists"
    else
      warn "$name NOT FOUND"
    fi
  }

  check_gh_secret "FROM_EMAIL"
  check_gh_secret "CONTACT_INBOX_EMAIL"
  check_gh_secret "GCP_PROJECT_ID"
  # For GCP project IDs we can show the expected value from .env.development
  # since they're not sensitive — helpful for catching the "-" type of mistake.
  printf "       (expected: %s)\n" "$GCP_PROJECT_ID"
  check_gh_secret "GCP_PROJECT_ID_STAGING"
  printf "       (expected: %s; derived from GCP_PROJECT_ID in this script)\n" "$GCP_PROJECT_ID"

  if [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]]; then
    printf "\n  ${CYAN}staging:${NC}\n"
    for v in DATABASE_URL SUPABASE_URL SUPABASE_KEY CSRF_SECRET STRIPE_SECRET_KEY \
              SEND_EMAIL_HOOK_SECRET RESEND_API_KEY CONTACT_DATA_ENCRYPTION_KEY \
              CLOUDFLARE_TURNSTILE_SITE_KEY CLOUDFLARE_TURNSTILE_SECRET_KEY \
              RESEND_WEBHOOK_SECRET; do
      check_gh_secret "${v}_STAGING"
    done
  fi

  if [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]]; then
    printf "\n  ${CYAN}production:${NC}\n"
    for v in DATABASE_URL SUPABASE_URL SUPABASE_KEY CSRF_SECRET STRIPE_SECRET_KEY \
              SEND_EMAIL_HOOK_SECRET RESEND_API_KEY CONTACT_DATA_ENCRYPTION_KEY \
              CLOUDFLARE_TURNSTILE_SITE_KEY CLOUDFLARE_TURNSTILE_SECRET_KEY \
              RESEND_WEBHOOK_SECRET; do
      check_gh_secret "${v}_PROD"
    done
  fi

  section "Supabase send_email hook (URI check)"
  printf "  ${YELLOW}Note:${NC} Supabase does not expose secret values via API — only URI + enabled state can be verified.\n\n"

  verify_supabase_hook() {
    local project_ref=$1 expected_url=$2 label=$3
    local expected_uri="${expected_url}/auth/send-email"

    local response
    response=$(curl -sf \
      "https://api.supabase.com/v1/projects/${project_ref}/config/auth" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" 2>&1)

    if [[ $? -ne 0 ]]; then
      err "$label — API call failed (check SUPABASE_ACCESS_TOKEN)"
      return
    fi

    local enabled uri
    enabled=$(supabase_json_field "$response" "hook_send_email_enabled" "false")
    uri=$(supabase_json_field "$response" "hook_send_email_uri" "")

    if [[ "$enabled" != "true" ]]; then
      warn "$label — hook is DISABLED in Supabase project"
    elif [[ "$uri" == "$expected_uri" ]]; then
      ok "$label — enabled, URI matches"
      printf "       %s\n" "$uri"
    else
      err "$label — URI mismatch"
      printf "       expected: %s\n" "$expected_uri"
      printf "       actual:   %s\n" "$uri"
    fi
  }

  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
    verify_supabase_hook "$SUPABASE_PROJECT_REF_STAGING" "$APPLICATION_URL_STAGING" "staging"
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
    verify_supabase_hook "$SUPABASE_PROJECT_REF_PROD" "$APPLICATION_URL_PROD" "prod"

  printf "\n${GREEN}Verify complete. No changes made.${NC}\n\n"
  exit 0
fi

# ===========================================================================
# SYNC MODE
# ===========================================================================

# ---------------------------------------------------------------------------
# Helper: set_secret <name> <value>
# ---------------------------------------------------------------------------
set_secret() {
  local name=$1 value=$2

  # Normalize single-line ID secrets to prevent hidden whitespace issues.
  case "$name" in
    GCP_PROJECT_ID|GCP_PROJECT_ID_STAGING)
      value=$(printf '%s' "$value" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
      ;;
    # Strip the "v1,whsec_" or "whsec_" Supabase dashboard prefix before
    # storing. Cloud Run env_vars uses comma as a KEY=VALUE delimiter, so a
    # value containing "v1,whsec_..." is silently truncated to just "v1".
    # The runtime verifier strips the prefix itself, so storing only the
    # base64 payload is correct and safe. The full prefixed value is still
    # sent to Supabase via sync_supabase_hook (called separately).
    SEND_EMAIL_HOOK_SECRET|SEND_EMAIL_HOOK_SECRET_STAGING|SEND_EMAIL_HOOK_SECRET_PROD)
      value=$(printf '%s' "$value" | tr -d '\r\n' | sed -e 's/^v1,whsec_//' -e 's/^whsec_//' | tr -d ' ')
      ;;
  esac

  if [[ -z "$value" ]]; then
    SECRETS_SKIPPED+=("$name")
    return
  fi

  case "$name" in
    GCP_PROJECT_ID|GCP_PROJECT_ID_STAGING)
      if [[ ! "$value" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
        SECRETS_FAILED+=("$name")
        err "$name (invalid format; expected 6-30 chars, lowercase letters/numbers/hyphens, start letter, end letter/number)"
        return
      fi
      ;;
  esac

  if printf '%s' "$value" | gh secret set "$name" 2>/dev/null; then
    SECRETS_SET+=("$name")
    ok "$name"
  else
    SECRETS_FAILED+=("$name")
    err "$name (failed)"
  fi
}

# ---------------------------------------------------------------------------
# GCP Workload Identity Federation (from Terraform outputs)
# ---------------------------------------------------------------------------
section "GCP Workload Identity Federation"

TF_DIR="$SCRIPT_DIR/.."
WIF_PROVIDER=$(terraform -chdir="$TF_DIR" output -raw workload_identity_provider 2>/dev/null || true)
PROD_SA_EMAIL=$(terraform -chdir="$TF_DIR" output -raw prod_deployer_sa_email 2>/dev/null || true)
STAGING_SA_EMAIL=$(terraform -chdir="$TF_DIR" output -raw staging_deployer_sa_email 2>/dev/null || true)

if [[ -n "$WIF_PROVIDER" && -n "$PROD_SA_EMAIL" && -n "$STAGING_SA_EMAIL" ]]; then
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && {
    set_secret "GCP_WIF_PROVIDER_STAGING" "$WIF_PROVIDER"
    set_secret "GCP_SA_EMAIL_STAGING" "$STAGING_SA_EMAIL"
  }
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && {
    set_secret "GCP_WIF_PROVIDER_PROD" "$WIF_PROVIDER"
    set_secret "GCP_SA_EMAIL_PROD" "$PROD_SA_EMAIL"
  }
else
  warn "Terraform outputs unavailable — skipping WIF secrets"
  printf "       Run 'terraform apply' in ./terraform, then re-run this script.\n"
  printf "       Or set manually:\n"
  printf "         GCP_WIF_PROVIDER_{PROD,STAGING}  — terraform output workload_identity_provider\n"
  printf "         GCP_SA_EMAIL_PROD                — terraform output prod_deployer_sa_email\n"
  printf "         GCP_SA_EMAIL_STAGING             — terraform output staging_deployer_sa_email\n"
fi

# ---------------------------------------------------------------------------
# Shared secrets
# ---------------------------------------------------------------------------
section "Shared secrets"
set_secret "GCP_PROJECT_ID"         "$GCP_PROJECT_ID"
# Staging intentionally inherits the same GCP project ID as production.
# If you later split projects, set GCP_PROJECT_ID_STAGING manually in GitHub
# or extend this script to source a dedicated env variable.
set_secret "GCP_PROJECT_ID_STAGING" "$GCP_PROJECT_ID"
set_secret "FROM_EMAIL"             "$FROM_EMAIL"
set_secret "CONTACT_INBOX_EMAIL"    "$CONTACT_INBOX_EMAIL"

if [[ -n "$VITE_PUBLIC_POSTHOG_TOKEN" ]]; then
  set_secret "VITE_PUBLIC_POSTHOG_TOKEN"   "$VITE_PUBLIC_POSTHOG_TOKEN"
  set_secret "VITE_PUBLIC_POSTHOG_HOST"    "${VITE_PUBLIC_POSTHOG_HOST:-https://us.i.posthog.com}"
  set_secret "VITE_PUBLIC_POSTHOG_UI_HOST" "${VITE_PUBLIC_POSTHOG_UI_HOST:-https://eu.posthog.com}"
else
  warn "VITE_PUBLIC_POSTHOG_TOKEN not set — skipping PostHog secrets"
fi

# ---------------------------------------------------------------------------
# Release app secrets (optional)
# ---------------------------------------------------------------------------
if [[ -n "$RELEASE_APP_ID" ]]; then
  section "Release app secrets"
  set_secret "RELEASE_APP_ID" "$RELEASE_APP_ID"

  KEY_FILE="$RELEASE_APP_PRIVATE_KEY_FILE"
  [[ -n "$KEY_FILE" && "$KEY_FILE" != /* ]] && KEY_FILE="$REPO_ROOT/$KEY_FILE"

  if [[ -n "$KEY_FILE" && -f "$KEY_FILE" ]]; then
    if gh secret set RELEASE_APP_PRIVATE_KEY < "$KEY_FILE" 2>/dev/null; then
      SECRETS_SET+=("RELEASE_APP_PRIVATE_KEY")
      ok "RELEASE_APP_PRIVATE_KEY (from $RELEASE_APP_PRIVATE_KEY_FILE)"
    else
      SECRETS_FAILED+=("RELEASE_APP_PRIVATE_KEY")
      err "RELEASE_APP_PRIVATE_KEY"
    fi
  elif [[ -n "$RELEASE_APP_PRIVATE_KEY" ]]; then
    if printf '%b' "$RELEASE_APP_PRIVATE_KEY" | gh secret set RELEASE_APP_PRIVATE_KEY 2>/dev/null; then
      SECRETS_SET+=("RELEASE_APP_PRIVATE_KEY"); ok "RELEASE_APP_PRIVATE_KEY"
    else
      SECRETS_FAILED+=("RELEASE_APP_PRIVATE_KEY"); err "RELEASE_APP_PRIVATE_KEY"
    fi
  else
    warn "RELEASE_APP_PRIVATE_KEY_FILE not found — skipping key"
  fi
fi

# ---------------------------------------------------------------------------
# Environment-specific secrets
# ---------------------------------------------------------------------------
sync_env_secrets() {
  local env=$1
  local ENV varname
  ENV=$(printf '%s' "$env" | tr '[:lower:]' '[:upper:]')

  local env_label
  env_label="$(printf '%s' "$env" | sed 's/./\u&/')"
  section "${env_label} secrets"

  # ${!varname} is single indirection: expand the variable whose NAME is stored
  # in $varname. Build the name first, then look it up — the nested form
  # ${!FIELD_${ENV}} would be double-indirection and silently return empty.
  for field in \
    DATABASE_URL \
    SUPABASE_URL \
    SUPABASE_KEY \
    GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET \
    APPLICATION_URL \
    CSRF_SECRET \
    STRIPE_SECRET_KEY \
    SEND_EMAIL_HOOK_SECRET \
    CLOUDFLARE_TURNSTILE_SITE_KEY \
    CLOUDFLARE_TURNSTILE_SECRET_KEY \
    RESEND_API_KEY
  do
    varname="${field}_${ENV}"
    set_secret "$varname" "${!varname}"
  done

  # Optional — only set when the value is non-empty
  for field in RESEND_WEBHOOK_SECRET CONTACT_DATA_ENCRYPTION_KEY; do
    varname="${field}_${ENV}"
    [[ -n "${!varname}" ]] && set_secret "$varname" "${!varname}"
  done
}

[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && sync_env_secrets "staging"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod"    ]] && sync_env_secrets "prod"

# ---------------------------------------------------------------------------
# Supabase auth hook sync
# ---------------------------------------------------------------------------
sync_supabase_hook() {
  local project_ref=$1 hook_secret=$2 app_url=$3 label=$4
  local hook_uri="${app_url}/auth/send-email"

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X PATCH \
    "https://api.supabase.com/v1/projects/${project_ref}/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"hook_send_email_enabled\":true,\"hook_send_email_uri\":\"${hook_uri}\",\"hook_send_email_secrets\":\"${hook_secret}\"}" 2>&1)

  http_code=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  if [[ "$http_code" =~ ^2 ]]; then
    HOOKS_SYNCED+=("$label")
    ok "$label — URI: $hook_uri"
  else
    HOOKS_FAILED+=("$label")
    err "$label — HTTP ${http_code}"
    printf "       Manually update in Supabase dashboard:\n"
    printf "         Project: %s\n" "$project_ref"
    printf "         Auth → Hooks → send_email\n"
    printf "         URI:    %s\n" "$hook_uri"
    printf "         Secret: %s\n" "$hook_secret"
    [[ -n "$body" && "$body" != "null" ]] && printf "         API response: %s\n" "$body"
  fi
}

section "Supabase auth hook sync"
printf "  ${YELLOW}Note:${NC} Hook URI and secret are set atomically — Supabase project always matches the GitHub secret.\n\n"

[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  sync_supabase_hook "$SUPABASE_PROJECT_REF_STAGING" "$SEND_EMAIL_HOOK_SECRET_STAGING" "$APPLICATION_URL_STAGING" "staging"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
  sync_supabase_hook "$SUPABASE_PROJECT_REF_PROD" "$SEND_EMAIL_HOOK_SECRET_PROD" "$APPLICATION_URL_PROD" "prod"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL_SET=${#SECRETS_SET[@]}
TOTAL_FAILED=${#SECRETS_FAILED[@]}
TOTAL_SKIPPED=${#SECRETS_SKIPPED[@]}
TOTAL_HOOKS_OK=${#HOOKS_SYNCED[@]}
TOTAL_HOOKS_FAIL=${#HOOKS_FAILED[@]}

printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
printf "  GitHub secrets set:      ${GREEN}%d${NC}\n" "$TOTAL_SET"
[[ $TOTAL_SKIPPED -gt 0 ]] && printf "  GitHub secrets skipped:  ${YELLOW}%d${NC} (empty values)\n" "$TOTAL_SKIPPED"
[[ $TOTAL_FAILED  -gt 0 ]] && printf "  GitHub secrets failed:   ${RED}%d${NC}\n"    "$TOTAL_FAILED"
printf "  Supabase hooks synced:   ${GREEN}%d${NC}\n" "$TOTAL_HOOKS_OK"
[[ $TOTAL_HOOKS_FAIL -gt 0 ]] && printf "  Supabase hooks failed:   ${RED}%d${NC}\n" "$TOTAL_HOOKS_FAIL"
printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

if [[ ${#SECRETS_FAILED[@]} -gt 0 ]]; then
  printf "\n"
  warn "Failed secrets: ${SECRETS_FAILED[*]}"
  printf "  Check your GitHub token permissions: gh auth status\n"
fi

if [[ ${#HOOKS_FAILED[@]} -gt 0 ]]; then
  printf "\n"
  warn "Hook sync failed for: ${HOOKS_FAILED[*]}"
  printf "  Check SUPABASE_ACCESS_TOKEN is valid: https://supabase.com/dashboard/account/tokens\n"
fi

printf "\n${BOLD}Next steps${NC}\n"
printf "  Verify current state:\n"
printf "    ./setup-github-secrets.sh --verify\n\n"
printf "  Deploy staging (automatic on push to main):\n"
printf "    git push origin main\n\n"
printf "  Deploy production:\n"
printf "    gh workflow run 'CD - Deploy Platform to Production'\n\n"

[[ $TOTAL_FAILED -gt 0 || $TOTAL_HOOKS_FAIL -gt 0 ]] && exit 1
exit 0
