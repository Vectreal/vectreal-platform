#!/usr/bin/env bash
# The CLI's OAuth client: its name, its redirect URIs, and the functions that
# find and register it through a project's Auth admin API. Sourced by
# setup-fly-secrets.sh for the hosted projects and by
# apps/vectreal-platform/scripts/register-local-cli-client.sh for a local
# stack, so the redirect URIs have one owner.
#
# Needs curl and jq, and `ok` and `err` from the sourcing script.

# The CLI's pre-registered public client. The app finds it by this name to
# serve GET /api/v1/cli/client (CLI_OAUTH_CLIENT_NAME in
# app/lib/domain/agent/agent-cli-client.server.ts), so the id Supabase generates
# is never copied anywhere. Auth matches redirect URIs exactly, so the CLI
# listens on the first free one of these fixed ports.
CLI_OAUTH_CLIENT_NAME="Vectreal CLI"
CLI_REDIRECT_URIS='["http://127.0.0.1:51730/callback","http://127.0.0.1:51731/callback","http://127.0.0.1:51732/callback"]'

# The PATCH that turns the OAuth server on returns before Auth serves it: for a
# few seconds the clients endpoint still answers 404 feature_disabled, as it
# does wherever the server is off. The sync waits that answer out, and only that
# one, for up to this many tries this many seconds apart.
CLI_CLIENT_LIST_ATTEMPTS=10
CLI_CLIENT_LIST_DELAY=3

# Prints the CLI client as JSON, or nothing when it is not registered.
# Returns 0 when the lookup itself worked, 2 when Auth reports the OAuth server
# disabled, 1 when it failed any other way.
find_cli_client() {
  local supabase_url="$1" secret_key="$2"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    "${supabase_url}/auth/v1/admin/oauth/clients?per_page=100" \
    -H "apikey: $secret_key" -H "Authorization: Bearer $secret_key" 2>&1)
  http_code=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')
  if [[ "$http_code" == 404 && "$(printf '%s' "$body" | jq -r '.error_code?' 2>/dev/null)" == feature_disabled ]]; then
    return 2
  fi
  [[ "$http_code" =~ ^2 ]] || return 1
  printf '%s' "$body" | jq -c --arg name "$CLI_OAUTH_CLIENT_NAME" \
    'first(.clients[]? | select(.client_name == $name)) // empty' || return 1
}

# Whether a CLI client is public with no secret, as the CLI's PKCE exchange
# needs. A confidential one cannot be turned public in place, so a wrong shape
# is reported, never repaired: delete the client and run the sync again.
cli_client_is_public() {
  [[ "$(printf '%s' "$1" | jq -r '"\(.client_type) \(.token_endpoint_auth_method)"')" == "public none" ]]
}

# Registers the CLI client when it is missing and puts its redirect URIs back
# when they drifted. Idempotent: a run that finds it as it should be sends
# nothing. Returns 0 when the client is as it should be afterwards.
ensure_cli_client() {
  local supabase_url="$1" secret_key="$2" label="$3"
  local client status attempt
  for (( attempt = 1; ; attempt++ )); do
    client=$(find_cli_client "$supabase_url" "$secret_key") && status=0 || status=$?
    (( status == 2 && attempt < CLI_CLIENT_LIST_ATTEMPTS )) || break
    sleep "$CLI_CLIENT_LIST_DELAY"
  done
  if (( status == 2 )); then
    err "$label - Auth still reports the OAuth server disabled after ${CLI_CLIENT_LIST_ATTEMPTS} tries"
    return 1
  elif (( status != 0 )); then
    err "$label - could not list OAuth clients"
    return 1
  fi

  local method url payload
  if [[ -n "$client" ]] && ! cli_client_is_public "$client"; then
    err "$label - the \"$CLI_OAUTH_CLIENT_NAME\" client is not public with no secret; delete it and sync again"
    return 1
  elif [[ -z "$client" ]]; then
    method=POST
    url="${supabase_url}/auth/v1/admin/oauth/clients"
    payload=$(jq -n --arg name "$CLI_OAUTH_CLIENT_NAME" --argjson uris "$CLI_REDIRECT_URIS" \
      '{client_name: $name, redirect_uris: $uris, client_type: "public",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"]}')
  elif [[ "$(printf '%s' "$client" | jq -c '.redirect_uris | sort')" != "$(printf '%s' "$CLI_REDIRECT_URIS" | jq -c 'sort')" ]]; then
    method=PUT
    url="${supabase_url}/auth/v1/admin/oauth/clients/$(printf '%s' "$client" | jq -r .client_id)"
    payload=$(jq -n --argjson uris "$CLI_REDIRECT_URIS" '{redirect_uris: $uris}')
  else
    ok "$label - CLI client: $(printf '%s' "$client" | jq -r .client_id)"
    return 0
  fi

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "apikey: $secret_key" -H "Authorization: Bearer $secret_key" \
    -H "Content-Type: application/json" -d "$payload" 2>&1)
  http_code=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')
  if [[ ! "$http_code" =~ ^2 ]]; then
    err "$label - HTTP ${http_code} ${method} CLI client: $body"
    return 1
  fi
  ok "$label - CLI client ${method}: $(printf '%s' "$body" | jq -r .client_id)"
}
