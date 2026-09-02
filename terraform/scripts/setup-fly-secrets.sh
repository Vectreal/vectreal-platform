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
# --verify is a gate, not a report: it exits non-zero when a *required* secret
# is missing or the live hook URI does not match APPLICATION_URL. An optional
# one that is unset warns and passes, which is what the sync does with it.
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

# ---------------------------------------------------------------------------
# The manifest
# ---------------------------------------------------------------------------
# Every runtime secret is named once, here. Validation, --verify and sync all
# read these arrays, so a name added here reaches all three at once.
#
# It used to be four hand-written lists - two REQUIRED_* arrays, the --verify
# field list, and the arguments to `fly secrets set` - and nothing compared them
# to each other or to what the app reads. That is how STRIPE_WEBHOOK_SECRET,
# VITE_PUBLIC_POSTHOG_TOKEN and BILLING_RECONCILE_SECRET reached production
# unset: the app read all three at runtime, no list here mentioned any of them,
# so validation had nothing to require and --verify had nothing to check. The
# lists had drifted from each other too - --verify hard-failed on
# CONTACT_DATA_ENCRYPTION_KEY and RESEND_WEBHOOK_SECRET while sync treated both
# as optional.
#
# Logical names, not spellings. `resolve` decides whether a value arrives as
# DATABASE_URL_PROD or as DATABASE_URL in a production Environment.
#
# One enumeration this cannot absorb: the `env:` block in
# cd-platform-secrets.yaml, because a GitHub Actions job only sees the secrets
# it maps by hand. For a required name that drift is loud - `resolve` returns
# empty and validation exits 1 - but for an optional one it is silent, so a
# name added to FLY_SECRETS_OPTIONAL needs a line there in the same change.
#
# This file is the authoritative list. The Dockerfile and .env.development.example
# point here rather than restating it, because the copy that used to live in the
# Dockerfile went stale and nothing compared them.

# Sent to Fly. Resolved per environment, and the sync refuses to run without
# them.
FLY_SECRETS_REQUIRED=(
  "DATABASE_URL"
  "SUPABASE_URL"
  "SUPABASE_KEY"
  "SUPABASE_SECRET_KEY"
  "APPLICATION_URL"
  "CSRF_SECRET"
  "STRIPE_SECRET_KEY"
  # Without this the webhook route rejects every delivery with a 400, and
  # `billing_state` loses every backward transition - cancellation, payment
  # failure, dunning, expiry. Nothing else carries them automatically:
  # cancelSubscription is called only from the webhook processor, and the one
  # other writer, reconcileStripeSubscriptions, is reachable only through
  # /api/billing/reconcile, which needs BILLING_RECONCILE_SECRET below and has
  # therefore never run. Unset in production until 2026-09, over which time
  # `billing_webhook_events` recorded zero rows.
  "STRIPE_WEBHOOK_SECRET"
  "SEND_EMAIL_HOOK_SECRET"
  "CLOUDFLARE_TURNSTILE_SITE_KEY"
  "CLOUDFLARE_TURNSTILE_SECRET_KEY"
  "RESEND_API_KEY"
  "EMBED_TOKEN_ENCRYPTION_KEY"
  # Read at runtime by posthog-client.server.ts. The VITE_ prefix is a
  # misnomer here and reads like a build-time-only name, which is part of why
  # these were never provisioned: the Dockerfile sets them as build-stage ENV
  # for the client bundle, the runner stage does not inherit that, and without
  # them getPosthogClient() returns null - taking the server error sink, all
  # server analytics and the billing-checkout kill switch down with it.
  "VITE_PUBLIC_POSTHOG_TOKEN"
  "VITE_PUBLIC_POSTHOG_HOST"
)

# Sent to Fly when a value exists, skipped when it does not, and --verify warns
# rather than failing on one. This list is the sync's existing behaviour made
# explicit, not a judgement that absence is harmless - it is per-secret:
FLY_SECRETS_OPTIONAL=(
  # Genuinely degrades: pii-encryption.server.ts falls back to CSRF_SECRET.
  "CONTACT_DATA_ENCRYPTION_KEY"
  # Does NOT degrade. resend-webhook-processor.server.ts throws when it is
  # unset, so the route breaks rather than switching off. Optional only because
  # the sync has always treated it that way; promoting it to required would
  # fail the next run for any environment that has never had a value.
  "RESEND_WEBHOOK_SECRET"
  # Genuinely degrades: /api/billing/reconcile is fail-closed and 401s
  # everything, which leaves the drift detector off but breaks nothing.
  "BILLING_RECONCILE_SECRET"
)

# Sent to Fly. One value covers both environments.
FLY_SECRETS_SHARED=(
  "CONTACT_INBOX_EMAIL"
  "FROM_EMAIL"
)

# Required by this script, never sent to Fly.
SCRIPT_ONLY_SHARED=(
  "SUPABASE_ACCESS_TOKEN"
)
SCRIPT_ONLY_PER_ENV=(
  "SUPABASE_PROJECT_REF"
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

check_shared "${FLY_SECRETS_SHARED[@]}" "${SCRIPT_ONLY_SHARED[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
  check_env_vars STAGING "${FLY_SECRETS_REQUIRED[@]}" "${SCRIPT_ONLY_PER_ENV[@]}"
[[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod"    ]] && \
  check_env_vars PROD "${FLY_SECRETS_REQUIRED[@]}" "${SCRIPT_ONLY_PER_ENV[@]}"

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

  # One listing per app, held for the whole check. This used to make a network
  # round trip per secret name, and the manifest is longer than the list it
  # replaced.
  FLY_SECRETS_LISTING=""

  # Presence only. `fly secrets list` reports digests, never values, so nothing
  # here can tell a correct secret from a wrong one - only a missing one.
  #
  # `$app` is for the message. The answer comes from FLY_SECRETS_LISTING, which
  # check_env_secrets loads for the app it is about to check, so these two must
  # not be called from anywhere that has not just set it.
  check_fly_secret() {
    local app="$1" name="$2"
    if printf '%s' "$FLY_SECRETS_LISTING" | grep -qw "$name"; then
      ok "$app / $name"
    else
      err "$app / $name NOT FOUND"
      VERIFY_FAILED+=("$app/$name")
    fi
  }

  # Optional secrets are reported but never fail the gate. Their absence turns a
  # feature off by design; treating that as a failure is what made the old list
  # disagree with the sync it was supposed to be checking.
  warn_fly_secret() {
    local app="$1" name="$2"
    if printf '%s' "$FLY_SECRETS_LISTING" | grep -qw "$name"; then
      ok "$app / $name"
    else
      warn "$app / $name not set - optional in the manifest; see its entry there for what that costs"
    fi
  }

  check_env_secrets() {
    local app="$1"
    local name

    FLY_SECRETS_LISTING="$(fly secrets list --app "$app" 2>/dev/null)"
    if [[ -z "$FLY_SECRETS_LISTING" ]]; then
      err "$app - could not read the secret list"
      VERIFY_FAILED+=("$app/listing")
      return
    fi

    for name in "${FLY_SECRETS_REQUIRED[@]}" "${FLY_SECRETS_SHARED[@]}"; do
      check_fly_secret "$app" "$name"
    done
    for name in "${FLY_SECRETS_OPTIONAL[@]}"; do
      warn_fly_secret "$app" "$name"
    done
  }

  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "staging" ]] && \
    check_env_secrets "vectreal-platform-staging"
  [[ -z "$ENV_FILTER" || "$ENV_FILTER" == "prod" ]] && \
    check_env_secrets "vectreal-platform"

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

  local stage_flag=()
  if [[ "$STAGE_ONLY" == "true" ]]; then
    stage_flag=(--stage)
    warn "staged only - the next deploy applies these"
  fi

  # Built from the manifest rather than spelled out a second time. A name added
  # up there is validated, verified and set without another edit down here,
  # which is the only reason the three can no longer disagree.
  local args=()
  local name value
  for name in "${FLY_SECRETS_REQUIRED[@]}"; do
    value="$(resolve "$name" "$ENV")"
    case "$name" in
      # Supabase issues this one as "v1,whsec_…" and Fly reads a comma as its
      # own argument delimiter, so the prefix comes off before it is sent.
      SEND_EMAIL_HOOK_SECRET) value="$(strip_hook_prefix "$value")" ;;
    esac
    args+=("${name}=${value}")
  done
  for name in "${FLY_SECRETS_SHARED[@]}"; do
    args+=("${name}=$(resolve "$name")")
  done
  for name in "${FLY_SECRETS_OPTIONAL[@]}"; do
    value="$(resolve "$name" "$ENV")"
    if [[ -n "$value" ]]; then
      args+=("${name}=${value}")
    else
      warn "$name has no value - skipping; see its manifest entry for what that costs"
    fi
  done

  # Derived here rather than resolved: neither is a secret, and ENVIRONMENT is
  # this script's own label for which app it is writing to.
  args+=("NODE_ENV=production" "ENVIRONMENT=${env}")

  if fly secrets set \
      "${args[@]}" \
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