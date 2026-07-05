#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - Modal Secrets Setup
# =============================================================================
# Creates the "img-to-3d-runtime-secret" in Modal and, optionally, pushes the
# Modal CI token to GitHub Actions secrets.
#
# Prerequisites:
#   uv sync --directory apps/img-to-3d-runtime --extra dev   (installs modal)
#   uv run --directory apps/img-to-3d-runtime modal setup    (authenticate)
#   gh auth login (for --github flag)
#
# Usage:
#   ./setup-modal-secrets.sh             # Modal secret only
#   ./setup-modal-secrets.sh --github    # Modal secret + GitHub Actions secrets
#   ./setup-modal-secrets.sh --help
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC}  %s\n" "$*"; }
warn() { printf "  ${YELLOW}⚠${NC}  %s\n" "$*"; }
err()  { printf "  ${RED}✗${NC}  %s\n" "$*"; }

show_help() {
  grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \{0,2\}//'
  exit 0
}

WITH_GITHUB=false
for arg in "$@"; do
  case "$arg" in
    --github) WITH_GITHUB=true ;;
    --help|-h) show_help ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/apps/img-to-3d-runtime"
ENV_FILE="$REPO_ROOT/.env.development"

[[ -f "$ENV_FILE" ]] || { err ".env.development not found at $REPO_ROOT"; exit 1; }

# ---------------------------------------------------------------------------
# Resolve the modal command.
# Prefer a PATH-installed modal (e.g. via uv tool install modal), then fall
# back to the project venv via uv run so users don't need a global install.
# ---------------------------------------------------------------------------

if command -v modal &>/dev/null; then
  MODAL="modal"
elif command -v uv &>/dev/null && uv run --directory "$RUNTIME_DIR" modal --version &>/dev/null 2>&1; then
  MODAL="uv run --directory $RUNTIME_DIR modal"
else
  err "Modal CLI not found."
  err "Install it into the project venv with:"
  err "  uv sync --directory apps/img-to-3d-runtime --extra dev"
  err "Then authenticate: uv run --directory apps/img-to-3d-runtime modal setup"
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from .env.development are CI credentials
# meant to be pushed to GitHub Actions — not for authenticating this script.
# Unset them so modal falls back to ~/.modal.toml (written by `modal setup`).
unset MODAL_TOKEN_ID MODAL_TOKEN_SECRET

# ---------------------------------------------------------------------------
# 1. Modal runtime secret
# ---------------------------------------------------------------------------

printf "\n${BOLD}1. Modal — img-to-3d-runtime-secret${NC}\n"

[[ -n "$IMG_TO_3D_RUNTIME_AUTH_SECRET_PROD" ]] \
  || { err "IMG_TO_3D_RUNTIME_AUTH_SECRET_PROD is not set in .env.development"; exit 1; }

MODAL_ARGS=(
  IMG_TO_3D_RUNTIME_AUTH_SECRET="$IMG_TO_3D_RUNTIME_AUTH_SECRET_PROD"
)

if [[ -n "$HF_TOKEN" ]]; then
  MODAL_ARGS+=(HF_TOKEN="$HF_TOKEN")
else
  warn "HF_TOKEN not set — required if the model is gated on HuggingFace"
fi

$MODAL secret create --force img-to-3d-runtime-secret "${MODAL_ARGS[@]}" \
  && ok "img-to-3d-runtime-secret created" \
  || { err "Failed to create Modal secret"; exit 1; }

# ---------------------------------------------------------------------------
# 2. GitHub Actions secrets (optional, --github flag)
# ---------------------------------------------------------------------------

if [[ "$WITH_GITHUB" == "true" ]]; then
  printf "\n${BOLD}2. GitHub Actions secrets${NC}\n"

  command -v gh &>/dev/null || { err "GitHub CLI not found — install: brew install gh"; exit 1; }
  gh auth status &>/dev/null   || { err "Not authenticated with GitHub — run: gh auth login"; exit 1; }

  if [[ -n "$MODAL_TOKEN_ID" && -n "$MODAL_TOKEN_SECRET" ]]; then
    gh secret set MODAL_TOKEN_ID     --body "$MODAL_TOKEN_ID"     && ok "MODAL_TOKEN_ID set"
    gh secret set MODAL_TOKEN_SECRET --body "$MODAL_TOKEN_SECRET" && ok "MODAL_TOKEN_SECRET set"
  else
    warn "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set in .env.development"
    warn "Generate a CI token with:  $MODAL token new --name 'GitHub Actions'"
    warn "Then add to .env.development and re-run with --github"
  fi
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

printf "\n${BOLD}Next steps:${NC}\n"
printf "  Deploy:  pnpm nx run img-to-3d-runtime:modal-deploy\n"
printf "  Serve:   pnpm nx run img-to-3d-runtime:modal-serve\n"
printf "  Logs:    pnpm nx run img-to-3d-runtime:modal-logs\n\n"
