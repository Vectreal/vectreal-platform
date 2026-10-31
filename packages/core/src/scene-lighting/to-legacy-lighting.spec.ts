import { describe, expect, it } from 'vitest'

import { resolveLighting, toLegacyLighting } from '.'

import type { SceneSettings } from '../types'

/** What a viewer released before `lighting` makes of the derived keys. */
const readByOldViewer = (settings: SceneSettings) => {
	const { environment, shadows } = toLegacyLighting(settings)
	return resolveLighting({ environment, shadows })
}

describe('toLegacyLighting', () => {
	it('leaves a scene saved before lighting as it is', () => {
		const settings: SceneSettings = { shadows: { enabled: true } }
		expect(toLegacyLighting(settings)).toBe(settings)
	})

	it('gives an old viewer the key, the environment and the ground back', () => {
		const settings: SceneSettings = {
			lighting: {
				environment: {
					map: 'outdoor-overcast',
					resolution: '4k',
					intensity: 0.7
				},
				lights: [
					{ role: 'key', azimuth: 120, elevation: 40, size: 25, intensity: 0.6 }
				],
				ground: { enabled: true },
				background: { type: 'environment', intensity: 0.8, blur: 0.2 },
				occlusion: { mode: 'live', live: { intensity: 2, atRest: true } }
			}
		}
		const old = readByOldViewer(settings)
		const [key] = old.lights
		expect(key.azimuth).toBeCloseTo(120)
		expect(key.elevation).toBeCloseTo(40)
		expect(key.size).toBeCloseTo(25)
		expect(key.intensity).toBeCloseTo(0.6)
		expect(old.environment).toEqual({
			map: 'outdoor-overcast',
			resolution: '4k',
			intensity: 0.7,
			rotation: 0
		})
		expect(old.ground.enabled).toBe(true)
		expect(old.background).toEqual({
			type: 'environment',
			intensity: 0.8,
			blur: 0.2
		})
		expect(old.occlusion).toEqual({
			mode: 'live',
			live: { intensity: 2, atRest: true }
		})
	})

	it('darkens the one old shadow by every lit light, as the ground bake does', () => {
		const { shadows } = toLegacyLighting({
			lighting: {
				lights: [
					{ role: 'key', elevation: 90, intensity: 1 },
					{ role: 'fill', elevation: 30, intensity: 0.5 },
					{ role: 'rim', intensity: 3, enabled: false }
				],
				ground: { enabled: true }
			}
		})
		expect(shadows?.light?.ambient).toBeCloseTo(1 / (1 + 1 + 0.25))
	})

	it('aims the old shadow with the key, not whichever light comes first', () => {
		const { shadows } = toLegacyLighting({
			lighting: {
				lights: [
					{ role: 'fill', azimuth: -90, elevation: 20 },
					{ role: 'key', azimuth: 90, elevation: 20 }
				]
			}
		})
		expect(shadows?.light?.position?.[0]).toBeGreaterThan(0)
	})

	it('keeps an environment-only ground as a pure sky occlusion', () => {
		const { shadows } = toLegacyLighting({
			lighting: { ground: { enabled: true } }
		})
		expect(shadows?.enabled).toBe(true)
		expect(shadows?.light?.ambient).toBe(1)
		expect(shadows?.light?.position).toBeUndefined()
	})

	it('stands every light where an old bake still sees it, at any size', () => {
		for (const size of [0, 0.5, 25, 180]) {
			const { light } = toLegacyLighting({
				lighting: { lights: [{ role: 'key', size }] }
			}).shadows!
			const distance = Math.hypot(...(light?.position as number[]))
			// Clear of the model, and well inside the old bake's far plane of
			// 25 model radii.
			expect(distance).toBeGreaterThan(1.3)
			expect(distance).toBeLessThan(25)
			// A jitter box, not a sky: tan(90 degrees) is 1.6e16 in floating point.
			expect(light?.radius).toBeLessThan(100)
		}
		const sharp = readByOldViewer({
			lighting: {
				lights: [{ role: 'key', size: 0.5 }],
				ground: { enabled: true }
			}
		}).lights[0]
		expect(sharp.size).toBeCloseTo(0.5)
	})

	it('leaves out light from below the horizon, which reaches no ground', () => {
		const { shadows } = toLegacyLighting({
			lighting: {
				lights: [
					{ role: 'key', elevation: -10, intensity: 3 },
					{ role: 'fill', azimuth: 90, elevation: 30, intensity: 1 }
				],
				ground: { enabled: true }
			}
		})
		expect(shadows?.light?.ambient).toBeCloseTo(1 / 1.5)
		expect(shadows?.light?.position?.[1]).toBeGreaterThan(0)
	})

	it('shows a stage as the backdrop an old viewer paints', () => {
		const backdrop = { type: 'color', color: '#112233' } as const
		const { environment } = toLegacyLighting({
			lighting: { background: backdrop }
		})
		expect(environment?.background).toBe(false)
		expect(environment?.backdrop).toEqual(backdrop)
	})

	it('replaces stale legacy keys but keeps the persisted bake', () => {
		const baked = { assetId: 'bake-1', signature: 'v3:abc' } as NonNullable<
			NonNullable<SceneSettings['shadows']>['baked']
		>
		const derived = toLegacyLighting({
			lighting: { ground: { enabled: true } },
			environment: { preset: 'night-city', backgroundBlurriness: 1 },
			shadows: { enabled: false, cutoffScale: 3, baked },
			hotspots: []
		})
		expect(derived.shadows?.baked).toBe(baked)
		expect(derived.shadows?.cutoffScale).toBeUndefined()
		expect(derived.shadows?.enabled).toBe(true)
		expect(derived.environment?.preset).not.toBe('night-city')
		expect(derived.environment?.backgroundBlurriness).toBeUndefined()
		expect(derived.hotspots).toEqual([])
	})
})
