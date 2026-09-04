/**
 * A hotspot column has to be named twice in `replaceHotspots`: once in the
 * `values` list that writes it, and again in `onConflictDoUpdate.set` so a
 * surviving row takes the new value. Rows that survive a save are updated in
 * place rather than deleted and reinserted, to keep `createdAt` recording when
 * the hotspot was authored, so the second list is not optional.
 *
 * A column present in the first list and absent from the second writes
 * correctly on the save that creates the hotspot and silently no-ops on every
 * save after it. Nothing fails: no type error, no Postgres error, no failing
 * insert-only test. To the author it looks like an edit that will not stick.
 *
 * `tests/integration/scene-hotspots.integration.spec.ts` proves the behaviour
 * against a real Postgres, but that suite is opt-in and needs a database. This
 * guard is the half that runs on every unit run, and it reads the source rather
 * than the module because importing the repository pulls in `getDbClient`,
 * which throws at module scope without `DATABASE_URL`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'scene-settings-repository.server.ts'),
	'utf8'
)

const replaceHotspots = source
	.split('export async function replaceHotspots')[1]
	?.split('\nexport ')[0]

const columnsIn = (block: string | undefined): string[] =>
	[...(block ?? '').matchAll(/^\t+(\w+):/gm)].map((match) => match[1])

const written = columnsIn(
	replaceHotspots?.split('.values(')[1]?.split('.onConflictDoUpdate(')[0]
)
const updated = columnsIn(
	replaceHotspots?.split('set: {')[1]?.split('.returning(')[0]
)

describe('the hotspot upsert updates every column it inserts', () => {
	it('found both column lists to compare', () => {
		// Without this the splits above could yield nothing and the assertion
		// below would pass over two empty lists.
		expect(written.length).toBeGreaterThan(5)
		expect(updated.length).toBeGreaterThan(5)
	})

	it.each(
		written.filter(
			// `id` is the conflict target and `sceneSettingsId` is the scope the
			// conflict is resolved within. Writing either from `excluded` would
			// let one scene's save move another scene's hotspot.
			(column) => column !== 'id' && column !== 'sceneSettingsId'
		)
	)('updates %s on a conflict, not only on insert', (column) => {
		expect(updated).toContain(column)
	})
})
