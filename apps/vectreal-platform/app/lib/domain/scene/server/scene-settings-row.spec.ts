/**
 * Every settings column of `scene_settings` reaches `SceneSettings` on read.
 *
 * The write side spreads the whole settings object into the row, so a new
 * column is written from the day it exists. The read side names its fields
 * one by one in `rowToSceneSettings`, and a column missing there is stored on
 * every save and handed back to nobody: the publisher reopens without it and
 * every embed renders without it. `animation` shipped a column-less half for
 * exactly that reason, and this compares the two lists so the next column
 * cannot.
 */
import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { rowToSceneSettings } from './scene-settings-repository.server'
import { sceneSettings } from '../../../../db/schema'

// The repository imports the client, which throws at module scope without
// `DATABASE_URL`; nothing here touches the database. Hoisted above the import.
vi.mock('../../../../db/client', () => ({ getDbClient: () => null }))

/** Columns that describe the row rather than the scene's settings. */
const ROW_COLUMNS = new Set([
	'id',
	'sceneId',
	'createdAt',
	'updatedAt',
	'createdBy'
])

describe('rowToSceneSettings', () => {
	it('returns every settings column it is given', () => {
		const settingsColumns = Object.keys(getTableColumns(sceneSettings)).filter(
			(column) => !ROW_COLUMNS.has(column)
		)
		const row = Object.fromEntries(
			Object.keys(getTableColumns(sceneSettings)).map((column) => [
				column,
				{ marker: column }
			])
		) as unknown as Parameters<typeof rowToSceneSettings>[0]

		const settings = rowToSceneSettings(row) as Record<string, unknown>

		expect(settingsColumns).toContain('animation')
		for (const column of settingsColumns) {
			expect(settings[column], column).toEqual({ marker: column })
		}
	})

	it('reads a null column as nothing saved', () => {
		const row = Object.fromEntries(
			Object.keys(getTableColumns(sceneSettings)).map((column) => [
				column,
				null
			])
		) as unknown as Parameters<typeof rowToSceneSettings>[0]

		expect(rowToSceneSettings(row).animation).toBeUndefined()
	})
})
