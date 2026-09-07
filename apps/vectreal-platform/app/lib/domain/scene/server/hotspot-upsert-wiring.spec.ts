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

import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { sceneHotspots } from '../../../../db/schema/project/scene-hotspots'

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
const setBlock = replaceHotspots?.split('set: {')[1]?.split('.returning(')[0]
const updated = columnsIn(setBlock)

/**
 * The database column each key is actually written from.
 *
 * Case-insensitive on the keyword: `EXCLUDED.link_url` is valid SQL, and a
 * guard that read it as no match at all would fail for the wrong reason.
 */
const excludedFor = (column: string): string | undefined =>
	new RegExp(`\\b${column}: sql\`excluded\\.(\\w+)\``, 'i').exec(
		setBlock ?? ''
	)?.[1]

/**
 * What that column is actually called, read from the schema rather than
 * derived from the property name.
 *
 * Deriving it - lower-casing at each capital - happens to reproduce all
 * thirteen of today's columns, which is exactly why it is the wrong oracle: it
 * would false-alarm on the first column Drizzle names off-convention, and it
 * can never notice a schema column renamed while the `excluded.…` literal in
 * the query stays behind.
 */
const columnName = (property: string): string | undefined =>
	getTableColumns(sceneHotspots)[
		property as keyof ReturnType<typeof getTableColumns<typeof sceneHotspots>>
	]?.name

describe('the hotspot upsert updates every column it inserts', () => {
	it('resolved a real column name for every key it iterates', () => {
		// Without this, a property the schema does not carry resolves to
		// `undefined` on both sides of the comparison and passes.
		for (const column of written) {
			expect(columnName(column)).toBeTruthy()
		}
	})

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
		// The name match alone is not enough: a key present but written from the
		// wrong `excluded.*` column updates a row with a neighbour's value, and
		// only the two columns the opt-in integration suite covers would catch
		// it. Every other column had no coverage on the update path at all.
		expect(excludedFor(column)).toBe(columnName(column))
	})
})
