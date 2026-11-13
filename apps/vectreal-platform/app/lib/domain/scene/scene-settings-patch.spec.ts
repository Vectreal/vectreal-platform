import { updateSceneSettingsInputSchema } from '@vctrl/sdk'
import { describe, expect, it } from 'vitest'

import { applySceneSettingsPatch } from './scene-settings-patch'

import type { SceneSettings } from '@vctrl/core'

const baked = { assetId: 'bake-1', signature: 'sig' }

describe('a presentation patch', () => {
	it('accepts alt text, and only as text', () => {
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { altText: 'A walnut lounge chair' }
			}).success
		).toBe(true)
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { altText: 42 }
			}).success
		).toBe(false)
	})

	it('accepts when interaction starts and the viewer language, from their known values only', () => {
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { interactionStart: 'tap', locale: 'de' }
			}).success
		).toBe(true)
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { interactionStart: 'hover' }
			}).success
		).toBe(false)
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { locale: 'fr' }
			}).success
		).toBe(false)
	})
})

describe('when interaction starts, through a presentation patch', () => {
	it("keeps the stored choice, or an older scene's immediate start, when the patch leaves it out", () => {
		expect(
			applySceneSettingsPatch(
				{ presentation: { interactionStart: 'tap' } },
				{ presentation: { altText: 'A chair' } }
			).presentation?.interactionStart
		).toBe('tap')
		expect(
			applySceneSettingsPatch(
				{ presentation: { showInfoPopover: true } },
				{ presentation: { altText: 'A chair' } }
			).presentation
		).not.toHaveProperty('interactionStart')
	})

	it('takes the start the patch sends', () => {
		expect(
			applySceneSettingsPatch(
				{ presentation: { interactionStart: 'tap' } },
				{ presentation: { interactionStart: 'immediate' } }
			).presentation?.interactionStart
		).toBe('immediate')
	})
})

describe('unloading off-screen, through a presentation patch', () => {
	it('is accepted as a boolean only', () => {
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { unloadWhenOffscreen: false }
			}).success
		).toBe(true)
		expect(
			updateSceneSettingsInputSchema.safeParse({
				presentation: { unloadWhenOffscreen: 'no' }
			}).success
		).toBe(false)
	})
})

describe('a lighting patch', () => {
	it('is accepted by the public contract', () => {
		const parsed = updateSceneSettingsInputSchema.safeParse({
			lighting: {
				environment: { map: 'studio-key', rotation: 30 },
				lights: [{ role: 'key', azimuth: 20, elevation: 50 }],
				ground: { enabled: true }
			}
		})

		expect(parsed.success).toBe(true)
	})

	it('is refused with two lights of one role', () => {
		const parsed = updateSceneSettingsInputSchema.safeParse({
			lighting: { lights: [{ role: 'key' }, { role: 'key' }] }
		})

		expect(parsed.success).toBe(false)
	})

	it('replaces the stored lighting and keeps the stored bake', () => {
		const stored: SceneSettings = {
			lighting: { environment: { map: 'night-city' }, lights: [] },
			shadows: { enabled: true, baked }
		}
		const lighting = { environment: { map: 'studio-soft' as const } }

		const merged = applySceneSettingsPatch(stored, { lighting })

		expect(merged.lighting).toEqual(lighting)
		expect(merged.shadows?.baked).toEqual(baked)
	})

	it('leaves the stored lighting alone when not sent', () => {
		const stored: SceneSettings = {
			lighting: { environment: { map: 'night-city' } }
		}

		const merged = applySceneSettingsPatch(stored, {
			controls: { autoRotate: true }
		})

		expect(merged.lighting).toBe(stored.lighting)
	})
})

describe('a camera or hotspots patch', () => {
	const stored: SceneSettings = {
		camera: { cameras: [{ cameraId: 'old', name: 'Old' }] },
		hotspots: []
	}

	it('replaces the stored camera as sent and leaves the hotspots alone', () => {
		const camera = { cameras: [{ cameraId: 'hero', name: 'Hero' }] }

		const merged = applySceneSettingsPatch(stored, { camera })

		expect(merged.camera).toEqual(camera)
		expect(merged.hotspots).toBe(stored.hotspots)
	})

	it('replaces the stored hotspots, an empty list removing every marker', () => {
		const merged = applySceneSettingsPatch(
			{ ...stored, hotspots: [{ id: 'm' } as never] },
			{ hotspots: [] }
		)

		expect(merged.hotspots).toEqual([])
		expect(merged.camera).toBe(stored.camera)
	})
})
