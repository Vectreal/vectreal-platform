#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - Fly.io Secrets + Supabase Hook Sync
# =============================================================================
# Usage:
#   ./setup-fly-secrets.sh               # sync both envs
#   ./setup-fly-secrets.sh --env staging # sync staging only
#   ./setup-fly-secrets.sh --env prod    # sync production only
#   ./setup-fly-secrets.sh --verify      # read-only: check current state
#   ./setup-fly-secrets.sh --help        # show this help
#
# Reads from .env.development at the repo root.
# Syncs:
#   1. Fly.io app secrets (fly secrets set)
#   2. Supabase send_email hook URI + secret (via Management API)
# =============================================================================

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

SECRETS_SET=()
SECRETS_FAILED=()
HOOKS_SYNCED=()
HOOKS_FAILED=()

MODE="sync"
ENV_FILTER=""

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

printf "\n${BOLD}Vectreal Platform - Fly.io Secrets Sync${NC}\n"
printf "=========================================\n"
[[ "$MODE" == "verify" ]] && printf "  Mode: ${CYAN}verify (read-only)${NC}\n"
[[ -n "$ENV_FILTER" ]]    && printf "  Env:  ${CYAN}%s only${NC}\n" "$ENV_FILTER"

section "Prerequisites"
PREREQ_FAILED=false
for cmd in fly curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "$cmd is not installed"
    PREREQ_FAILED=true
  else
    ok "$cmd"
  fi
done
if [[ "$PREREQ_FAILED" == "true" ]]; then
  printf "\n"
  err "Install missing tools: brew install flyctl curl jq"
  exit 1
fi

section "Fly.io authentication"
if ! fly auth whoami &>/dev/null; then
  warn "Not authenticated - launching fly auth login..."
  fly auth login || { err "Authentication failed"; exit 1; }
fi
ok "Authenticated: $(fly auth whoami)"

ENV_FILE="$REPO_ROOT/.env.development"
section "Environment file"
if [[ ! -f "$ENV_FILE" ]]; then
  err "$ENV_FILE not found"
  printf "\n  Create it: cp .env.development.example .env.development\n"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
ok "$ENV_FILE loaded"

section "Validating required variables"

REQUIRED_SHARED=(
  "FROM_EMAIL"
  "CONTACT_INBOX_EMAIL"
  "SUPABASE_ACCESS_TOKEN"
)
REQUIRED_STAGING=(
  "SUPABASE_PROJECT_REF_STAGING"
  "DATABASE_URL_STAGING"
  "SUPABASE_URL_STAGING"
  "SUPABASE_KEY_STAGING"
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
  "APPLICATION_URL_PROD"
  "CSRF_SECRET_PROD"
  "STRIPE_SECRET_KEY_PROD"
  "SEND_EMAIL_HOOK_SECRET_PROD"
  "CLOUDFLARE_TURNSTILE_SITE_KEY_PROD"
  "CLOUDFLARE_TURNSTILE_SECRET_KEY_PROD"
  "RESEND_API_KEY_PROD"
)

MISSING=()
check_vars() { for var in "$@"; do [[ -z "${!var}" ]] && MISSING+=("$var"); done; }

check_vars "${REQUIRED_SHARED[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && check_vars "${REQUIRED_STAGING[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod"    ]] && check_vars "${REQUIRED_PROD[@]}"

if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Missing required variables:"
  for v in "${MISSING[@]}"; do printf "      %s\n" "$v"; done
  exit 1
fi
ok "All required variables present"

# Strip "v1,whsec_" prefix from hook secrets before storing in Fly.io.
# Fly.io env values must not contain commas (used as delimiter).
strip_hook_prefix() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/^v1,whsec_//' -e 's/^whsec_//' | tr -d ' '
}

# ===========================================================================
# VERIFY MODE
# ===========================================================================
if [[ "$MODE" == "verify" ]]; then
  section "Fly.io secrets (existence check)"

  check_fly_secret() {
    local app="$1" name="$2"
    if fly secrets list --app "$app" 2>/dev/null | grep -qw "$name"; then
      ok "$app / $name"
    else
      warn "$app / $name NOT FOUND"
    fi
  }

  check_env_secrets() {
    local env="$1" app="$2"
    local ENV
    ENV=$(printf '%s' "$env" | tr '[:lower:]' '[:upper:]')
    for field in DATABASE_URL SUPABASE_URL SUPABASE_KEY CSRF_SECRET STRIPE_SECRET_KEY \
                 APPLICATION_URL SEND_EMAIL_HOOK_SECRET CLOUDFLARE_TURNSTILE_SITE_KEY \
                 CLOUDFLARE_TURNSTILE_SECRET_KEY RESEND_API_KEY CONTACT_DATA_ENCRYPTION_KEY \
                 RESEND_WEBHOOK_SECRET CONTACT_INBOX_EMAIL FROM_EMAIL; do
      check_fly_secret "$app" "$field"
    done
  }

  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
    check_env_secrets staging "vectreal-platform-staging"
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
    check_env_secrets prod "vectreal-platform"

  printf "\n${GREEN}Verify complete. No changes made.${NC}\n\n"
  exit 0
fi

# ===========================================================================
# SYNC MODE
# ===========================================================================

sync_fly_secrets() {
  local env="$1" app="$2"
  local ENV
  ENV=$(printf '%s' "$env" | tr '[:lower:]' '[:upper:]')

  local env_title
  env_title="$(printf '%s' "$env" | sed 's/\(.\)/\u\1/')"
  section "${env_title} → $app"

  local db_url; db_url="$(eval echo "\${DATABASE_URL_${ENV}}")"
  local sb_url; sb_url="$(eval echo "\${SUPABASE_URL_${ENV}}")"
  local sb_key; sb_key="$(eval echo "\${SUPABASE_KEY_${ENV}}")"
  local app_url; app_url="$(eval echo "\${APPLICATION_URL_${ENV}}")"
  local csrf;    csrf="$(eval echo "\${CSRF_SECRET_${ENV}}")"
  local stripe;  stripe="$(eval echo "\${STRIPE_SECRET_KEY_${ENV}}")"
  local ts_site; ts_site="$(eval echo "\${CLOUDFLARE_TURNSTILE_SITE_KEY_${ENV}}")"
  local ts_sec;  ts_sec="$(eval echo "\${CLOUDFLARE_TURNSTILE_SECRET_KEY_${ENV}}")"
  local resend;  resend="$(eval echo "\${RESEND_API_KEY_${ENV}}")"
  local hook_raw; hook_raw="$(eval echo "\${SEND_EMAIL_HOOK_SECRET_${ENV}}")"
  local hook; hook="$(strip_hook_prefix "$hook_raw")"
  local enc_key;  enc_key="$(eval echo "\${CONTACT_DATA_ENCRYPTION_KEY_${ENV}:-}")"
  local resend_wh; resend_wh="$(eval echo "\${RESEND_WEBHOOK_SECRET_${ENV}:-}")"

  if fly secrets set \
      DATABASE_URL="$db_url" \
      SUPABASE_URL="$sb_url" \
      SUPABASE_KEY="$sb_key" \
      APPLICATION_URL="$app_url" \
      CSRF_SECRET="$csrf" \
      STRIPE_SECRET_KEY="$stripe" \
      CLOUDFLARE_TURNSTILE_SITE_KEY="$ts_site" \
      CLOUDFLARE_TURNSTILE_SECRET_KEY="$ts_sec" \
      RESEND_API_KEY="$resend" \
      SEND_EMAIL_HOOK_SECRET="$hook" \
      CONTACT_INBOX_EMAIL="$CONTACT_INBOX_EMAIL" \
      FROM_EMAIL="$FROM_EMAIL" \
      NODE_ENV=production \
      ENVIRONMENT="$env" \
      ${enc_key:+CONTACT_DATA_ENCRYPTION_KEY="$enc_key"} \
      ${resend_wh:+RESEND_WEBHOOK_SECRET="$resend_wh"} \
      --app "$app" 2>/dev/null; then
    SECRETS_SET+=("$app")
    ok "Secrets set for $app"
  else
    SECRETS_FAILED+=("$app")
    err "Failed to set secrets for $app"
  fi
}

sync_supabase_hook() {
  local project_ref="$1" hook_secret_raw="$2" app_url="$3" label="$4"
  local hook_uri="${app_url}/auth/send-email"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X PATCH \
    "https://api.supabase.com/v1/projects/${project_ref}/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"hook_send_email_enabled\":true,\"hook_send_email_uri\":\"${hook_uri}\",\"hook_send_email_secrets\":\"${hook_secret_raw}\"}" 2>&1)
  http_code=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')
  if [[ "$http_code" =~ ^2 ]]; then
    HOOKS_SYNCED+=("$label")
    ok "$label - URI: $hook_uri"
  else
    HOOKS_FAILED+=("$label")
    err "$label - HTTP ${http_code}: $body"
  fi
}

[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  sync_fly_secrets staging "vectreal-platform-staging"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
  sync_fly_secrets prod "vectreal-platform"

section "Supabase auth hook sync"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  sync_supabase_hook "$SUPABASE_PROJECT_REF_STAGING" \
    "$SEND_EMAIL_HOOK_SECRET_STAGING" "$APPLICATION_URL_STAGING" "staging"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
  sync_supabase_hook "$SUPABASE_PROJECT_REF_PROD" \
    "$SEND_EMAIL_HOOK_SECRET_PROD" "$APPLICATION_URL_PROD" "prod"

printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
printf "  Fly.io apps updated: ${GREEN}%d${NC}\n" "${#SECRETS_SET[@]}"
printf "  Supabase hooks synced: ${GREEN}%d${NC}\n" "${#HOOKS_SYNCED[@]}"
[[ ${#SECRETS_FAILED[@]} -gt 0 ]] && printf "  Failed: ${RED}%s${NC}\n" "${SECRETS_FAILED[*]}"
[[ ${#HOOKS_FAILED[@]} -gt 0 ]]   && printf "  Hook failures: ${RED}%s${NC}\n" "${HOOKS_FAILED[*]}"
printf "\n${BOLD}Next steps${NC}\n"
printf "  Verify: ./setup-fly-secrets.sh --verify\n\n"
[[ ${#SECRETS_FAILED[@]} -gt 0 || ${#HOOKS_FAILED[@]} -gt 0 ]] && exit 1
exit 0