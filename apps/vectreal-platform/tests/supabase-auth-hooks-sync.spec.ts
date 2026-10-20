/**
 * Hosted Supabase auth hooks have one owner: `setup-fly-secrets.sh`, which
 * syncs both through the Management API and fails `--verify` on drift.
 *
 * The send_email hook was always owned there. The custom_access_token hook
 * (migration 0028) was a manual dashboard step nothing could check, which is
 * the gap these assertions keep closed. A script cannot be run here without
 * live projects, so this reads it, scoped to the function that does each job.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const SCRIPT = read('terraform/scripts/setup-fly-secrets.sh')
// The CLI client's constants and functions, shared with the local registration.
const CLI_LIB = read('terraform/scripts/lib/cli-oauth-client.sh')

function between(source: string, from: string, to: string): string {
	const start = source.indexOf(from)
	const end = source.indexOf(to, start)
	expect(start, from).toBeGreaterThanOrEqual(0)
	expect(end, to).toBeGreaterThan(start)
	return source.slice(start, end)
}

const sync = between(SCRIPT, 'sync_supabase_auth_hooks() {', '\n}\n')
const verify = between(SCRIPT, 'check_auth_hooks() {', '\n  }\n')

describe('the hosted auth hook sync', () => {
	it('enables the token hook only in the branch where its function exists', () => {
		const present = between(sync, '    0)', '    1)')

		expect(present).toContain('token_hook_ready=true')
		expect(present).toContain('hook_custom_access_token_enabled: true')
		expect(present).toContain('hook_custom_access_token_uri: $uri,')
		expect(present).toContain('--arg uri "$CUSTOM_ACCESS_TOKEN_HOOK_URI"')

		// Nowhere else in the sync may switch it on.
		expect(
			sync.split('hook_custom_access_token_enabled: true').length - 1
		).toBe(1)
	})

	it('switches the token hook off where its function is missing', () => {
		const absent = between(sync, '    1)', '    *)')

		expect(absent).toContain('hook_custom_access_token_enabled: false')
		expect(absent).not.toContain('token_hook_ready=true')
	})

	it('checks for the function before it sends the PATCH', () => {
		const guard = sync.indexOf(
			'custom_access_token_function_exists "$project_ref"'
		)
		const patch = sync.indexOf('-X PATCH')

		expect(guard).toBeGreaterThanOrEqual(0)
		expect(patch).toBeGreaterThan(guard)
		expect(sync).toContain('-d "$payload"')
	})

	it('still syncs send_email, and reports the token hook as failed when it is not ready', () => {
		expect(sync).toContain(
			'{hook_send_email_enabled: true, hook_send_email_uri: $uri, hook_send_email_secrets: $secrets}'
		)
		expect(sync).toMatch(
			/if \[\[ "\$token_hook_ready" == "true" \]\]; then[\s\S]*else\s*\n\s*HOOKS_FAILED\+=\("\$label\/custom_access_token"\)/
		)
	})
})

describe('the hosted OAuth server and CLI client', () => {
	it('turns the OAuth server on only where the token hook goes on', () => {
		const present = between(sync, '    0)', '    1)')
		const absent = between(sync, '    1)', '    *)')

		expect(present).toContain('oauth_server_enabled: true')
		expect(present).toContain('oauth_server_authorization_path: $path')
		expect(present).toContain('--arg path "$OAUTH_AUTHORIZATION_PATH"')
		expect(present).toContain('oauth_server_allow_dynamic_registration: false')
		expect(absent).toContain('oauth_server_enabled: false')
		expect(sync.split('oauth_server_enabled: true').length - 1).toBe(1)
	})

	it('consents at the page the app serves', () => {
		expect(SCRIPT).toMatch(/^OAUTH_AUTHORIZATION_PATH="\/oauth\/consent"$/m)
		expect(read('apps/vectreal-platform/app/routes.tsx')).toContain(
			"route('oauth/consent',"
		)
	})

	it('ensures the CLI client only once the OAuth server is on', () => {
		const ready = between(
			sync,
			'if [[ "$token_hook_ready" == "true" ]]; then',
			'\n  else\n'
		)

		expect(ready).toContain(
			'if ensure_cli_client "$supabase_url" "$secret_key" "$label"; then'
		)
		expect(ready).toContain('HOOKS_FAILED+=("$label/cli_client")')
		expect(sync.split('ensure_cli_client').length - 1).toBe(1)
	})

	it('registers the CLI as a public client with no secret', () => {
		const ensure = between(CLI_LIB, 'ensure_cli_client() {', '\n}\n')

		expect(ensure).toContain('client_type: "public"')
		expect(ensure).toContain('token_endpoint_auth_method: "none"')
		expect(ensure).toContain(
			'grant_types: ["authorization_code", "refresh_token"]'
		)
		// A confidential client of the same name is refused, not trusted.
		expect(ensure).toMatch(
			/! cli_client_is_public "\$client"; then\n\s*err [^\n]*\n\s*return 1\n/
		)
		// Puts drifted redirect URIs back rather than leaving them.
		expect(ensure).toMatch(/method=PUT[\s\S]*redirect_uris: \$uris/)
	})

	it.each([
		[{ client_type: 'public', token_endpoint_auth_method: 'none' }, 0],
		[
			{
				client_type: 'confidential',
				token_endpoint_auth_method: 'client_secret_basic'
			},
			1
		],
		[
			{
				client_type: 'public',
				token_endpoint_auth_method: 'client_secret_post'
			},
			1
		]
	])('judges %j public with no secret: exit %i', (client, status) => {
		// Run, not read: the predicate decides whether sync trusts the client.
		const predicate = between(CLI_LIB, 'cli_client_is_public() {', '\n}\n')
		const result = spawnSync(
			'bash',
			[
				'-c',
				`${predicate}\n}\ncli_client_is_public "$1"`,
				'_',
				JSON.stringify(client)
			],
			{ encoding: 'utf8' }
		)

		expect(result.status).toBe(status)
	})

	it('reads the CLI client from the shared lib, as the local registration does', () => {
		const source =
			'source "$(dirname "${BASH_SOURCE[0]}")/lib/cli-oauth-client.sh"'
		expect(SCRIPT).toContain(source)
		// Sourced before the sync and verify functions that call into it run.
		expect(SCRIPT.indexOf(source)).toBeLessThan(
			SCRIPT.indexOf('sync_supabase_auth_hooks() {')
		)
		expect(
			read('apps/vectreal-platform/scripts/register-local-cli-client.sh')
		).toContain('terraform/scripts/lib/cli-oauth-client.sh')
	})

	it('finds the client by the name the app looks it up by', () => {
		const scriptName = CLI_LIB.match(
			/^CLI_OAUTH_CLIENT_NAME="([^"\n]+)"$/m
		)?.[1]
		const appName = read(
			'apps/vectreal-platform/app/lib/domain/agent/agent-cli-client.server.ts'
		).match(/export const CLI_OAUTH_CLIENT_NAME = '([^'\n]+)'/)?.[1]

		expect(scriptName).toBe('Vectreal CLI')
		expect(appName).toBe(scriptName)
		expect(between(CLI_LIB, 'find_cli_client() {', '\n}\n')).toContain(
			'select(.client_name == $name)'
		)
	})
})

describe('the CLI client step after the PATCH', () => {
	// Hosted Auth applies the PATCH a few seconds after it returns, and until
	// then the clients endpoint answers as it does with the OAuth server off
	// (reproduced on a local GoTrue v2.196.0). Run, not read: the stubs stand in
	// for curl and sleep, each response consumed in order, the last one repeated.
	const DISABLED = [
		'{"code":404,"error_code":"feature_disabled","msg":"OAuth server is disabled"}',
		404
	] as const
	const CLIENT = {
		client_id: 'cli-id',
		client_name: 'Vectreal CLI',
		client_type: 'public',
		token_endpoint_auth_method: 'none',
		redirect_uris: JSON.parse(
			CLI_LIB.match(/^CLI_REDIRECT_URIS='([^'\n]+)'$/m)?.[1] ?? 'null'
		)
	}

	function runEnsure(responses: ReadonlyArray<readonly [string, number]>) {
		const dir = mkdtempSync(join(tmpdir(), 'cli-client-'))
		try {
			writeFileSync(
				join(dir, 'responses'),
				JSON.stringify(responses.map(([body, code]) => `${body}\n${code}`))
			)
			writeFileSync(join(dir, 'calls'), '0')
			const constants = CLI_LIB.match(
				/^(CLI_OAUTH_CLIENT_NAME|CLI_REDIRECT_URIS|CLI_CLIENT_LIST_ATTEMPTS|CLI_CLIENT_LIST_DELAY)=.*$/gm
			)
			const stubs = `
curl() {
  local n; n=$(( $(cat "$DIR/calls") + 1 )); echo "$n" > "$DIR/calls"
  jq -r --argjson i "$n" '.[([$i, length] | min) - 1]' "$DIR/responses"
}
sleep() { echo "$1" >> "$DIR/sleeps"; }
# jq 1.6 exits 2 on a parse error, the status find_cli_client reserves for
# feature_disabled; 1.7 exits 5. Answer as 1.6 does whatever is installed.
jq() { command jq "$@"; local s=$?; (( s == 5 )) && return 2; return "$s"; }
ok() { echo "ok: $*"; }
err() { echo "err: $*"; }`
			const result = spawnSync(
				'bash',
				[
					'-c',
					[
						...(constants ?? []),
						stubs,
						between(CLI_LIB, 'find_cli_client() {', '\n}\n') + '\n}',
						between(CLI_LIB, 'cli_client_is_public() {', '\n}\n') + '\n}',
						between(CLI_LIB, 'ensure_cli_client() {', '\n}\n') + '\n}',
						'ensure_cli_client https://auth.test key staging'
					].join('\n')
				],
				{ encoding: 'utf8', env: { ...process.env, DIR: dir } }
			)
			const sleeps = (() => {
				try {
					return readFileSync(join(dir, 'sleeps'), 'utf8').trim().split('\n')
				} catch {
					return []
				}
			})()
			return {
				status: result.status,
				stdout: result.stdout,
				calls: Number(readFileSync(join(dir, 'calls'), 'utf8')),
				sleeps
			}
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	}

	it('waits while Auth still reports the OAuth server disabled', () => {
		const run = runEnsure([
			DISABLED,
			DISABLED,
			[JSON.stringify({ clients: [CLIENT] }), 200]
		])

		expect(run.stdout).toContain('ok: staging - CLI client: cli-id')
		expect(run.status).toBe(0)
		expect(run.calls).toBe(3)
		expect(run.sleeps).toEqual(['3', '3'])
	})

	it('gives up after a bounded wait', () => {
		const run = runEnsure([DISABLED])

		expect(run.status).toBe(1)
		expect(run.stdout).toContain('OAuth server disabled after 10 tries')
		expect(run.calls).toBe(10)
		expect(run.sleeps).toHaveLength(9)
	})

	it.each([
		['{"code":401,"error_code":"no_authorization"}', 401],
		['{"code":404,"error_code":"not_found"}', 404],
		['<html>Bad Gateway</html>', 502],
		['<html>Proxy</html>', 200]
	] as const)('fails at once on any other error: %s', (body, code) => {
		const run = runEnsure([[body, code]])

		expect(run.status).toBe(1)
		expect(run.stdout).toContain('err: staging - could not list OAuth clients')
		expect(run.calls).toBe(1)
		expect(run.sleeps).toEqual([])
	})

	it('waits only in the sync, never in --verify', () => {
		const ensure = between(CLI_LIB, 'ensure_cli_client() {', '\n}\n')

		// The wait lives in ensure_cli_client alone, and only the sync calls it.
		expect(ensure).toContain('sleep "$CLI_CLIENT_LIST_DELAY"')
		expect(
			CLI_LIB.replace(ensure, '').match(/CLI_CLIENT_LIST_(ATTEMPTS|DELAY)\b/g)
		).toEqual(['CLI_CLIENT_LIST_ATTEMPTS', 'CLI_CLIENT_LIST_DELAY'])
		expect(SCRIPT).not.toMatch(/CLI_CLIENT_LIST_(ATTEMPTS|DELAY)\b/)
		expect(SCRIPT.match(/ensure_cli_client\b/g)).toHaveLength(1)
		expect(verify).not.toContain('sleep')
	})
})

describe('verify mode for the auth hooks', () => {
	it.each([
		'token-hook-disabled',
		'token-hook-uri',
		'token-hook-function',
		'token-hook-function-read',
		'oauth-disabled',
		'oauth-path',
		'oauth-dcr',
		'cli-client-read',
		'cli-client-missing',
		'cli-client-shape',
		'cli-client-uris'
	])('fails the gate on %s', (key) => {
		expect(verify).toContain(`VERIFY_FAILED+=("$label/${key}")`)
	})

	it('looks the function up itself before reading the result', () => {
		// Without the call, `case $?` reads whatever ran last - an `ok` or
		// `err`, both 0 - and reports the function present on every run.
		expect(verify).toMatch(
			/custom_access_token_function_exists "\$project_ref"\n\s*case \$\? in/
		)
	})

	it('compares the live URI with the one the sync writes', () => {
		expect(verify).toContain(
			'elif [[ "$actual" != "$CUSTOM_ACCESS_TOKEN_HOOK_URI" ]]; then'
		)
	})

	it('runs for both deployed environments', () => {
		for (const env of ['STAGING', 'PROD']) {
			expect(SCRIPT, env).toContain(
				`check_auth_hooks "$(resolve SUPABASE_PROJECT_REF ${env})"`
			)
			expect(SCRIPT, env).toContain(
				`sync_supabase_auth_hooks "$(resolve SUPABASE_PROJECT_REF ${env})"`
			)
		}
	})
})

it('names the same function the local stack uses', () => {
	const hosted = SCRIPT.match(
		/^CUSTOM_ACCESS_TOKEN_HOOK_URI="([^"\n]+)"$/m
	)?.[1]
	const local = between(
		read('apps/vectreal-platform/supabase/config.toml'),
		'[auth.hook.custom_access_token]',
		'\n\n'
	).match(/^uri = "([^"\n]+)"$/m)?.[1]

	expect(hosted).toBe('pg-functions://postgres/public/custom_access_token_hook')
	expect(local).toBe(hosted)
})
