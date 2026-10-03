/**
 * Scene delivery wiring that no behavioural test can reach.
 *
 * Each guard here sits in a `.server.ts` module or a route, both of which call
 * `getDbClient()` at import and so cannot be loaded by a spec. The rules they
 * call are tested beside the rules; these assertions prove the rules are
 * called. Renaming a call is meant to fail this - re-point the guard rather
 * than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, '..', 'app', path), 'utf8')

describe('embed key use', () => {
	const auth = read('lib/domain/auth/preview-api-key-auth.server.ts')

	it('writes lastUsedAt only when the stored value has gone stale', () => {
		expect(auth).toMatch(
			/if \(hashedToken && shouldRecordKeyUse\(match\?\.lastUsedAt \?\? null, now\)\) \{\s*await db\s*\.update\(apiKeys\)/
		)
	})
})
