import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { embedRefusal } from './embed-refusal'
import { EMBED_RESPONSE_HEADERS } from './embed-response-headers'

describe('embedRefusal', () => {
	it.each([
		['not_available', 404],
		['domain_not_allowed', 403],
		['busy', 429]
	] as const)('answers %s with %i', (reason, status) => {
		expect(embedRefusal(reason).init?.status).toBe(status)
	})

	it('answers a malformed URL with the same body as every 404', () => {
		/*
		  No credential, a key that matched nothing, an unpublished scene and a
		  malformed URL must stay indistinguishable: telling them apart would tell
		  an unknown visitor whether a scene or key exists.
		*/
		const malformed = embedRefusal('not_available', 400)
		expect(malformed.init?.status).toBe(400)
		expect(malformed.data).toEqual(embedRefusal('not_available').data)
	})

	it.each(['not_available', 'domain_not_allowed', 'busy'] as const)(
		'puts nothing in a %s body but the reason',
		(reason) => {
			expect(embedRefusal(reason).data).toEqual({ reason })
		}
	)

	it('carries the embed header contract', () => {
		expect(
			Object.fromEntries(new Headers(embedRefusal('busy').init?.headers))
		).toEqual(Object.fromEntries(new Headers(EMBED_RESPONSE_HEADERS)))
	})
})

describe('the embed loader', () => {
	/*
	  Read from source, because the loader reaches `getDbClient()` on import;
	  the integration spec drives it for real. A returned refusal is data to
	  React Router: no boundary runs and the viewer boots into a spinner, then
	  fails its own fetch. So every refusal is thrown, and built one way.
	*/
	const layout = readFileSync(
		join(
			dirname(fileURLToPath(import.meta.url)),
			'../../../routes/layouts/embed-layout.tsx'
		),
		'utf8'
	)

	it('throws every refusal and returns none', () => {
		expect(layout).not.toMatch(/return\s+embedRefusal/)
		expect(layout.match(/throw embedRefusal\(/g)?.length).toBeGreaterThan(4)
	})

	/*
	  The two refusals that are not "not available" each say so from their own
	  branch. Swapping either for `not_available` would hide a transient 429's
	  retry, or the owner's one actionable message.
	*/
	it.each([
		["'rate_limited'", 'busy'],
		["'domain_not_allowed'", 'domain_not_allowed']
	])('answers %s with %s', (error, reason) => {
		expect(layout).toMatch(
			new RegExp(
				`authResult\\.error === ${error}\\) \\{[^}]*throw embedRefusal\\('${reason}'\\)`
			)
		)
	})

	it('builds no refusal any other way', () => {
		expect(layout).not.toMatch(/ApiResponse|status:\s*4\d\d/)
	})
})
