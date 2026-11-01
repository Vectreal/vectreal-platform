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
import { resolveSceneViewCameras } from '@vctrl/viewer/hotspots'
import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { rowToSceneSettings } from './scene-settings-repository.server'
import { sceneSettings } from '../../../../db/schema'

// The repository imports the client, which throws at module scope without
// `DATABASE_URL`; nothing here touches the database. Hoisted above the import.
vi.mock('../../../../db/client', () => ({ getDbClient: () => null }))

/**
 * Columns that describe the row rather than the scene's settings. The saved
 * studio finish is a record of a file the draft keeps, which no embed reads.
 */
const ROW_COLUMNS = new Set([
	'id',
	'sceneId',
	'createdAt',
	'updatedAt',
	'createdBy',
	'studioFinish'
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

/**
 * The Publisher's starting camera was saved with no `kind`, and the viewer
 * reads an untagged camera that a hotspot links as that hotspot's close-up.
 * Linking it therefore dropped the scene's own view out of the camera
 * switcher. Read through here, it arrives tagged and stays a view.
 */
describe('rowToSceneSettings camera kinds', () => {
	const rowWith = (camera: unknown) =>
		({
			...Object.fromEntries(
				Object.keys(getTableColumns(sceneSettings)).map((column) => [
					column,
					null
				])
			),
			camera
		}) as unknown as Parameters<typeof rowToSceneSettings>[0]

	it('keeps an untagged scene camera a view when a hotspot links it', () => {
		const minted = 'hotspot-camera-1755000000000-a1b2c3'
		const settings = rowToSceneSettings(
			rowWith({
				cameras: [
					{ cameraId: 'default', name: 'Default Camera', initial: true },
					{ cameraId: minted, name: 'Lens' }
				]
			}),
			[
				{
					id: 'b8e6f0a4-0000-4000-8000-000000000001',
					name: 'Opening view',
					worldPosition: [0, 0, 0],
					visible: true,
					internalOnly: false,
					stylePreset: 'dot',
					linkedCameraId: 'default'
				},
				{
					id: 'b8e6f0a4-0000-4000-8000-000000000002',
					name: 'Lens',
					worldPosition: [0, 0, 1],
					visible: true,
					internalOnly: false,
					stylePreset: 'dot',
					linkedCameraId: minted
				}
			]
		)

		expect(
			resolveSceneViewCameras(
				settings.camera?.cameras,
				settings.hotspots ?? []
			).map((camera) => camera.cameraId)
		).toEqual(['default'])
		// The pair keeps its missing tag; the viewer still reads it by its link.
		expect(settings.camera?.cameras?.[1].kind).toBeUndefined()
	})

	it('leaves a scene with no cameras saved as nothing saved', () => {
		expect(rowToSceneSettings(rowWith(null)).camera).toBeUndefined()
		expect(rowToSceneSettings(rowWith({ activeCameraId: 'x' })).camera).toEqual(
			{ activeCameraId: 'x' }
		)
	})
})
