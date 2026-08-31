#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - Fly.io Secrets + Supabase Hook Sync
# =============================================================================
# Usage:
#   ./setup-fly-secrets.sh               # sync both envs
#   ./setup-fly-secrets.sh --env staging # sync staging only
#   ./setup-fly-secrets.sh --env prod    # sync production only
#   ./setup-fly-secrets.sh --verify      # read-only: check current state
#   ./setup-fly-secrets.sh --stage       # stage secrets, apply on next deploy
#   ./setup-fly-secrets.sh --help        # show this help
#
# Values come from .env.development at the repo root when it exists, and from
# the process environment when it does not - which is how CI supplies them.
# Each name is looked up suffixed first (DATABASE_URL_PROD, the local file's
# convention) and then bare (DATABASE_URL, what a GitHub Environment holds), so
# both callers read the same script.
#
# Syncs:
#   1. Fly.io app secrets (fly secrets set)
#   2. Supabase send_email hook URI + secret (via Management API)
#
# --verify is a gate, not a report: it exits non-zero when a secret is missing
# or the live hook URI does not match APPLICATION_URL.
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
# Staged secrets land on the app without restarting it; the next deploy applies
# them. Keeps a routine rotation from bouncing production.
STAGE_ONLY=false

show_help() {
  grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \{0,2\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify) MODE="verify"; shift ;;
    --stage)  STAGE_ONLY=true; shift ;;
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
  # `fly auth login` opens a browser and blocks. There is nobody to answer it in
  # CI, so fail with the thing that would have fixed it instead of hanging.
  if [[ -n "${CI:-}" ]] || [[ ! -t 0 ]]; then
    err "Not authenticated and no terminal to log in from."
    printf "\n  Set FLY_API_TOKEN in the environment.\n"
    exit 1
  fi
  warn "Not authenticated - launching fly auth login..."
  fly auth login || { err "Authentication failed"; exit 1; }
fi
ok "Authenticated: $(fly auth whoami)"

ENV_FILE="$REPO_ROOT/.env.development"
section "Values"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ok "$ENV_FILE loaded"
else
  # Not an error. CI has no such file and supplies the values directly, which is
  # the whole point of moving this into a workflow.
  ok "no .env.development - reading the process environment"
fi

# Suffixed first, then bare. The local file namespaces every value by
# environment in one flat file; a GitHub Environment does the namespacing
# itself and holds the bare name. Shared values have no suffix either way.
resolve() {
  local name="$1" env_upper="${2:-}"
  local suffixed="${name}_${env_upper}"
  if [[ -n "$env_upper" && -n "${!suffixed:-}" ]]; then
    printf '%s' "${!suffixed}"
  else
    printf '%s' "${!name:-}"
  fi
}

section "Validating required variables"

# Logical names, not spellings. `resolve` decides whether a value arrives as
# DATABASE_URL_PROD or as DATABASE_URL in a production Environment.
REQUIRED_SHARED=(
  "FROM_EMAIL"
  "CONTACT_INBOX_EMAIL"
  "SUPABASE_ACCESS_TOKEN"
)
REQUIRED_PER_ENV=(
  "SUPABASE_PROJECT_REF"
  "DATABASE_URL"
  "SUPABASE_URL"
  "SUPABASE_KEY"
  "SUPABASE_SECRET_KEY"
  "APPLICATION_URL"
  "CSRF_SECRET"
  "STRIPE_SECRET_KEY"
  "SEND_EMAIL_HOOK_SECRET"
  "CLOUDFLARE_TURNSTILE_SITE_KEY"
  "CLOUDFLARE_TURNSTILE_SECRET_KEY"
  "RESEND_API_KEY"
  "EMBED_TOKEN_ENCRYPTION_KEY"
)

MISSING=()
check_shared() {
  for var in "$@"; do [[ -z "$(resolve "$var")" ]] && MISSING+=("$var"); done
}
check_env_vars() {
  local env_upper="$1"; shift
  for var in "$@"; do
    [[ -z "$(resolve "$var" "$env_upper")" ]] && MISSING+=("${var} (${env_upper})")
  done
}

check_shared "${REQUIRED_SHARED[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  check_env_vars STAGING "${REQUIRED_PER_ENV[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod"    ]] && \
  check_env_vars PROD "${REQUIRED_PER_ENV[@]}"

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
  VERIFY_FAILED=()

  section "Fly.io secrets (existence check)"

  # Presence only. `fly secrets list` reports digests, never values, so nothing
  # here can tell a correct secret from a wrong one - only a missing one.
  check_fly_secret() {
    local app="$1" name="$2"
    if fly secrets list --app "$app" 2>/dev/null | grep -qw "$name"; then
      ok "$app / $name"
    else
      err "$app / $name NOT FOUND"
      VERIFY_FAILED+=("$app/$name")
    fi
  }

  check_env_secrets() {
    local env="$1" app="$2"
    for field in DATABASE_URL SUPABASE_URL SUPABASE_KEY SUPABASE_SECRET_KEY \
                 CSRF_SECRET STRIPE_SECRET_KEY APPLICATION_URL SEND_EMAIL_HOOK_SECRET \
                 CLOUDFLARE_TURNSTILE_SITE_KEY CLOUDFLARE_TURNSTILE_SECRET_KEY \
                 RESEND_API_KEY CONTACT_DATA_ENCRYPTION_KEY RESEND_WEBHOOK_SECRET \
                 EMBED_TOKEN_ENCRYPTION_KEY \
                 CONTACT_INBOX_EMAIL FROM_EMAIL; do
      check_fly_secret "$app" "$field"
    done
  }

  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
    check_env_secrets staging "vectreal-platform-staging"
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
    check_env_secrets prod "vectreal-platform"

  section "Supabase auth hook (live value)"

  # The one thing here that is a real drift check rather than a presence check.
  # The hook URI is what decides whether confirmation emails are delivered at
  # all, and it lives in Supabase's project config - editable in a dashboard,
  # invisible to this repo. Reading it back is the only way the repo learns that
  # someone changed it.
  check_hook_uri() {
    local project_ref="$1" expected_url="$2" label="$3"
    local expected="${expected_url}/auth/send-email"

    if [[ -z "$project_ref" || -z "$expected_url" ]]; then
      err "$label - cannot check: project ref or APPLICATION_URL is unset"
      VERIFY_FAILED+=("$label/hook-inputs")
      return
    fi

    local response http_code body
    response=$(curl -s -w "\n%{http_code}" \
      "https://api.supabase.com/v1/projects/${project_ref}/config/auth" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" 2>&1)
    http_code=$(printf '%s' "$response" | tail -n1)
    body=$(printf '%s' "$response" | sed '$d')

    if [[ ! "$http_code" =~ ^2 ]]; then
      err "$label - HTTP ${http_code} reading auth config"
      VERIFY_FAILED+=("$label/hook-read")
      return
    fi

    local enabled actual
    enabled=$(printf '%s' "$body" | jq -r '.hook_send_email_enabled // false')
    actual=$(printf '%s' "$body" | jq -r '.hook_send_email_uri // ""')

    if [[ "$enabled" != "true" ]]; then
      err "$label - send_email hook is DISABLED; no auth email is delivered"
      VERIFY_FAILED+=("$label/hook-disabled")
    elif [[ "$actual" != "$expected" ]]; then
      err "$label - hook URI drifted"
      printf "      expected: %s\n      actual:   %s\n" "$expected" "$actual"
      VERIFY_FAILED+=("$label/hook-uri")
    else
      ok "$label - $actual"
    fi
  }

  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
    check_hook_uri "$(resolve SUPABASE_PROJECT_REF STAGING)" \
      "$(resolve APPLICATION_URL STAGING)" "staging"
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
    check_hook_uri "$(resolve SUPABASE_PROJECT_REF PROD)" \
      "$(resolve APPLICATION_URL PROD)" "prod"

  printf "\n"
  if [[ ${#VERIFY_FAILED[@]} -gt 0 ]]; then
    err "Verify failed: ${VERIFY_FAILED[*]}"
    printf "\n"
    exit 1
  fi
  printf "${GREEN}Verify passed. No changes made.${NC}\n\n"
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

  local db_url;   db_url="$(resolve DATABASE_URL "$ENV")"
  local sb_url;   sb_url="$(resolve SUPABASE_URL "$ENV")"
  local sb_key;   sb_key="$(resolve SUPABASE_KEY "$ENV")"
  local sb_secret_key; sb_secret_key="$(resolve SUPABASE_SECRET_KEY "$ENV")"
  local app_url;  app_url="$(resolve APPLICATION_URL "$ENV")"
  local csrf;     csrf="$(resolve CSRF_SECRET "$ENV")"
  local stripe;   stripe="$(resolve STRIPE_SECRET_KEY "$ENV")"
  local ts_site;  ts_site="$(resolve CLOUDFLARE_TURNSTILE_SITE_KEY "$ENV")"
  local ts_sec;   ts_sec="$(resolve CLOUDFLARE_TURNSTILE_SECRET_KEY "$ENV")"
  local resend;   resend="$(resolve RESEND_API_KEY "$ENV")"
  local hook_raw; hook_raw="$(resolve SEND_EMAIL_HOOK_SECRET "$ENV")"
  local hook; hook="$(strip_hook_prefix "$hook_raw")"
  local enc_key;  enc_key="$(resolve CONTACT_DATA_ENCRYPTION_KEY "$ENV")"
  local emb_key;  emb_key="$(resolve EMBED_TOKEN_ENCRYPTION_KEY "$ENV")"
  local resend_wh; resend_wh="$(resolve RESEND_WEBHOOK_SECRET "$ENV")"

  local stage_flag=()
  if [[ "$STAGE_ONLY" == "true" ]]; then
    stage_flag=(--stage)
    warn "staged only - the next deploy applies these"
  fi

  if fly secrets set \
      DATABASE_URL="$db_url" \
      SUPABASE_URL="$sb_url" \
      SUPABASE_KEY="$sb_key" \
      SUPABASE_SECRET_KEY="$sb_secret_key" \
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
      EMBED_TOKEN_ENCRYPTION_KEY="$emb_key" \
      ${resend_wh:+RESEND_WEBHOOK_SECRET="$resend_wh"} \
      "${stage_flag[@]}" \
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
  sync_supabase_hook "$(resolve SUPABASE_PROJECT_REF STAGING)" \
    "$(resolve SEND_EMAIL_HOOK_SECRET STAGING)" \
    "$(resolve APPLICATION_URL STAGING)" "staging"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
  sync_supabase_hook "$(resolve SUPABASE_PROJECT_REF PROD)" \
    "$(resolve SEND_EMAIL_HOOK_SECRET PROD)" \
    "$(resolve APPLICATION_URL PROD)" "prod"

printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
printf "  Fly.io apps updated: ${GREEN}%d${NC}\n" "${#SECRETS_SET[@]}"
printf "  Supabase hooks synced: ${GREEN}%d${NC}\n" "${#HOOKS_SYNCED[@]}"
[[ ${#SECRETS_FAILED[@]} -gt 0 ]] && printf "  Failed: ${RED}%s${NC}\n" "${SECRETS_FAILED[*]}"
[[ ${#HOOKS_FAILED[@]} -gt 0 ]]   && printf "  Hook failures: ${RED}%s${NC}\n" "${HOOKS_FAILED[*]}"
printf "\n${BOLD}Next steps${NC}\n"
printf "  Verify: ./setup-fly-secrets.sh --verify\n\n"
[[ ${#SECRETS_FAILED[@]} -gt 0 || ${#HOOKS_FAILED[@]} -gt 0 ]] && exit 1
exit 0