import { haveSceneSettingsChanged } from './scene-settings-comparison'

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'

const hotspot = (
	id: string,
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const settings = (overrides: Partial<SceneSettings> = {}): SceneSettings => ({
	bounds: { fit: true },
	camera: { activeCameraId: 'default' },
	controls: { enableZoom: true },
	environment: { preset: 'nature-park' },
	shadows: { enabled: true },
	normalization: { enabled: true, maxSize: 5 },
	...overrides
})

/** The stored row carries the same fields plus the row's own bookkeeping. */
const row = (overrides: Record<string, unknown> = {}) => ({
	id: 'settings-1',
	sceneId: 'scene-1',
	createdBy: 'user-1',
	createdAt: new Date(0),
	updatedAt: new Date(0),
	bounds: { fit: true },
	camera: { activeCameraId: 'default' },
	controls: { enableZoom: true },
	environment: { preset: 'nature-park' },
	interactions: null,
	shadows: { enabled: true },
	normalization: { enabled: true, maxSize: 5 },
	...overrides
})

describe('haveSceneSettingsChanged', () => {
	it('reports no change when the settings match the row', () => {
		expect(haveSceneSettingsChanged(settings(), row(), [])).toBe(false)
	})

	it('reports a change on any compared field', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ environment: { preset: 'nature-moonlit' } }),
				row(),
				[]
			)
		).toBe(true)
	})

	// The field the hand-written comparison forgot. A normalization-only edit
	// used to reach the `unchanged` return and be dropped with a success
	// response.
	it('reports a normalization-only change', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ normalization: { enabled: true, maxSize: 2 } }),
				row(),
				[]
			)
		).toBe(true)
	})

	// Nothing in the comparison names a field, so a field added to
	// SceneSettings is compared from the moment it exists rather than the day
	// someone remembers to add it here.
	it('compares a field the comparison was never told about', () => {
		const current = {
			...settings(),
			somethingNew: { size: 2 }
		} as SceneSettings

		expect(
			haveSceneSettingsChanged(current, row({ somethingNew: { size: 2 } }), [])
		).toBe(false)
		expect(
			haveSceneSettingsChanged(current, row({ somethingNew: { size: 3 } }), [])
		).toBe(true)
	})

	// The client omits an unset field, the column holds null. Treating those as
	// different would report every scene as changed on every save.
	it('treats an absent field and a null column as the same', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ interactions: undefined }),
				row({ interactions: null }),
				[]
			)
		).toBe(false)
	})

	it('reports a change when an unset field gains a value', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ interactions: [] }),
				row({ interactions: null }),
				[]
			)
		).toBe(true)
	})

	// Hotspots are their own table, so they are compared against the separately
	// loaded list rather than a column on the row.
	it('reports a hotspot-only change', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ hotspots: [hotspot('a', { name: 'Renamed' })] }),
				row(),
				[hotspot('a')]
			)
		).toBe(true)
	})

	it('reports no change when the hotspots match', () => {
		expect(
			haveSceneSettingsChanged(settings({ hotspots: [hotspot('a')] }), row(), [
				hotspot('a')
			])
		).toBe(false)
	})

	// `hotspots` is not a column, so comparing it against the row would report
	// every scene carrying one as changed forever.
	it('does not compare hotspots against the row', () => {
		expect(
			haveSceneSettingsChanged(
				settings({ hotspots: [hotspot('a')] }),
				row({ hotspots: undefined }),
				[hotspot('a')]
			)
		).toBe(false)
	})

	it('ignores the row bookkeeping the settings never carry', () => {
		expect(
			haveSceneSettingsChanged(settings(), row({ updatedAt: new Date(1) }), [])
		).toBe(false)
	})
})
