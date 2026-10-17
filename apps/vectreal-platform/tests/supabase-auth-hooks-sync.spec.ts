/**
 * Hosted Supabase auth hooks have one owner: `setup-fly-secrets.sh`, which
 * syncs both through the Management API and fails `--verify` on drift.
 *
 * The send_email hook was always owned there. The custom_access_token hook
 * (migration 0028) was a manual dashboard step nothing could check, which is
 * the gap these assertions keep closed. A script cannot be run here without
 * live projects, so this reads it, scoped to the function that does each job.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const SCRIPT = read('terraform/scripts/setup-fly-secrets.sh')

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
		expect(present).toContain('hook_custom_access_token_uri: $uri}')
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

describe('verify mode for the auth hooks', () => {
	it.each([
		'token-hook-disabled',
		'token-hook-uri',
		'token-hook-function',
		'token-hook-function-read'
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
