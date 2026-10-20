#!/usr/bin/env bash
# Registers the CLI's OAuth client on the local Supabase stack, as
# terraform/scripts/setup-fly-secrets.sh does on the hosted projects, so
# `vectreal login --origin http://localhost:<port>` finds it through
# GET /api/v1/cli/client. Idempotent: a second run sends nothing.
#
# Run from apps/vectreal-platform with the stack started:
#   pnpm nx run vectreal-platform:supabase-register-cli-client
set -euo pipefail

ok()  { printf "  ✓  %s\n" "$*"; }
err() { printf "  ✗  %s\n" "$*" >&2; }

# shellcheck source=../../../terraform/scripts/lib/cli-oauth-client.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../../terraform/scripts/lib/cli-oauth-client.sh"

status=$(pnpm exec supabase status -o env 2>/dev/null) || {
	err "The local Supabase stack is not running: pnpm nx run vectreal-platform:supabase-start"
	exit 1
}
read_status() { printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p"; }

api_url=$(read_status API_URL)
secret_key=$(read_status SECRET_KEY)
if [[ -z "$api_url" || -z "$secret_key" ]]; then
	err "supabase status did not report API_URL and SECRET_KEY"
	exit 1
fi

ensure_cli_client "$api_url" "$secret_key" "local"
