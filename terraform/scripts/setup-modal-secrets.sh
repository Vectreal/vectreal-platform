#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - Modal secret for the image-to-3D runtime
# =============================================================================
# Creates "img-to-3d-runtime-secret" in Modal and, with --github, stores the
# Modal CI token in the GitHub "production" environment that
# cd-img-to-3d-runtime-production.yaml deploys from.
#
# The secret holds one value, HF_TOKEN, and it is required: TRELLIS.2
# conditions on facebook/dinov3, which is gated on Hugging Face. Accept its
# license with the account the token belongs to, or the first cold start fails.
#
# Nothing here authenticates the platform to the runtime. That is a Modal proxy
# token (`modal workspace proxy-tokens create`), which the platform holds.
#
# Prerequisites:
#   uv run --directory apps/img-to-3d-runtime --group dev modal setup
#   gh auth login                     (for --github)
#
# Values come from .env.development at the repo root when it exists, and from
# the process environment otherwise.
#
# Usage:
#   ./setup-modal-secrets.sh             # Modal secret only
#   ./setup-modal-secrets.sh --github    # and MODAL_TOKEN_ID/SECRET to GitHub
#   ./setup-modal-secrets.sh --help
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC}  %s\n" "$*"; }
warn() { printf "  ${YELLOW}⚠${NC}  %s\n" "$*"; }
err()  { printf "  ${RED}✗${NC}  %s\n" "$*"; }

WITH_GITHUB=false
for arg in "$@"; do
  case "$arg" in
    --github) WITH_GITHUB=true ;;
    --help|-h) grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \{0,2\}//'; exit 0 ;;
    *) err "Unknown argument: $arg"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/apps/img-to-3d-runtime"
ENV_FILE="$REPO_ROOT/.env.development"

# One value from .env.development, without the quotes a dotenv file may carry.
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true
}

if [[ -f "$ENV_FILE" ]]; then
  CI_TOKEN_ID="$(env_value MODAL_TOKEN_ID)"
  CI_TOKEN_SECRET="$(env_value MODAL_TOKEN_SECRET)"
  HF_TOKEN="${HF_TOKEN:-$(env_value HF_TOKEN)}"
else
  CI_TOKEN_ID="${MODAL_TOKEN_ID:-}"
  CI_TOKEN_SECRET="${MODAL_TOKEN_SECRET:-}"
fi

# MODAL_TOKEN_ID/SECRET are the CI token, only ever passed on to GitHub. Unset
# them so the modal CLI below authenticates as the developer, from the
# ~/.modal.toml that `modal setup` wrote, not as CI.
unset MODAL_TOKEN_ID MODAL_TOKEN_SECRET

MODAL=(uv run --directory "$RUNTIME_DIR" --frozen --group dev modal)

printf "\n${BOLD}1. Modal - img-to-3d-runtime-secret${NC}\n"

if [[ -z "${HF_TOKEN:-}" ]]; then
  err "HF_TOKEN is not set. It is required: facebook/dinov3 is gated on Hugging Face."
  exit 1
fi

"${MODAL[@]}" secret create --force img-to-3d-runtime-secret HF_TOKEN="$HF_TOKEN" >/dev/null
ok "img-to-3d-runtime-secret created"

if [[ "$WITH_GITHUB" == "true" ]]; then
  printf "\n${BOLD}2. GitHub - production environment${NC}\n"

  command -v gh &>/dev/null || { err "GitHub CLI not found: brew install gh"; exit 1; }
  gh auth status &>/dev/null || { err "Not authenticated with GitHub: gh auth login"; exit 1; }

  if [[ -n "$CI_TOKEN_ID" && -n "$CI_TOKEN_SECRET" ]]; then
    gh secret set MODAL_TOKEN_ID --env production --body "$CI_TOKEN_ID" && ok "MODAL_TOKEN_ID set"
    gh secret set MODAL_TOKEN_SECRET --env production --body "$CI_TOKEN_SECRET" && ok "MODAL_TOKEN_SECRET set"
  else
    warn "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET are not set."
    warn "Create a CI token with: ${MODAL[*]} token new --profile ci --no-activate"
    warn "then add both to .env.development and re-run with --github."
  fi
fi

printf "\n${BOLD}Next:${NC}\n"
printf "  Deploy:      pnpm nx run img-to-3d-runtime:modal-deploy\n"
printf "  Bake check:  pnpm nx run img-to-3d-runtime:modal-check\n"
printf "  Logs:        pnpm nx run img-to-3d-runtime:modal-logs\n\n"
