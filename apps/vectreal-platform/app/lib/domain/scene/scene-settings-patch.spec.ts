import { updateSceneSettingsInputSchema } from '@vctrl/sdk'
import { describe, expect, it } from 'vitest'

import { applySceneSettingsPatch } from './scene-settings-patch'

import type { SceneSettings } from '@vctrl/core'

const baked = { assetId: 'bake-1', signature: 'sig' }

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
