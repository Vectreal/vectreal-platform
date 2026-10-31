import { describe, expect, it } from 'vitest'

import { resolveLighting } from '.'

describe('resolveLighting for a scene saved with lighting', () => {
	it('fills every field a partial save leaves out', () => {
		expect(
			resolveLighting({
				lighting: { lights: [{ role: 'key', azimuth: 120 }] }
			})
		).toEqual({
			environment: {
				map: 'studio-natural',
				resolution: '1k',
				intensity: 1,
				rotation: 0
			},
			lights: [
				{
					role: 'key',
					enabled: true,
					azimuth: 120,
					elevation: 45,
					size: 20,
					intensity: 1,
					color: '#ffffff'
				}
			],
			ground: { enabled: false },
			background: { type: 'none' },
			occlusion: { mode: 'off', live: { intensity: 1.4, atRest: false } }
		})
	})

	it('ignores the legacy keys, even where they would add a light', () => {
		const resolved = resolveLighting({
			lighting: { environment: { map: 'outdoor-noon' } },
			environment: { preset: 'night-city', background: true },
			shadows: { enabled: true, ao: true }
		})
		expect(resolved.environment.map).toBe('outdoor-noon')
		expect(resolved.lights).toEqual([])
		expect(resolved.ground.enabled).toBe(false)
		expect(resolved.background).toEqual({ type: 'none' })
		expect(resolved.occlusion.mode).toBe('off')
	})

	it('keeps up to three lights in the order saved', () => {
		const roles = resolveLighting({
			lighting: {
				lights: [{ role: 'rim' }, { role: 'key' }, { role: 'fill' }]
			}
		}).lights.map((light) => light.role)
		expect(roles).toEqual(['rim', 'key', 'fill'])
	})

	it('fills an environment background and passes a valid stage through', () => {
		expect(
			resolveLighting({ lighting: { background: { type: 'environment' } } })
				.background
		).toEqual({ type: 'environment', intensity: 1, blur: 0.5 })
		const stage = {
			type: 'gradient',
			top: '#ffffff',
			bottom: '#d4d4d8'
		} as const
		expect(
			resolveLighting({ lighting: { background: stage } }).background
		).toEqual(stage)
	})

	it('shows no stage whose color is anything but #rrggbb hex', () => {
		expect(
			resolveLighting({
				lighting: {
					background: { type: 'color', color: 'red;background:url(x)' }
				}
			}).background
		).toEqual({ type: 'none' })
	})

	it('keeps a default where a field is present but undefined', () => {
		const resolved = resolveLighting({
			lighting: {
				environment: { intensity: undefined },
				lights: [{ role: 'key', azimuth: undefined, elevation: 10 }],
				occlusion: { live: { intensity: undefined } }
			}
		})
		expect(resolved.environment.intensity).toBe(1)
		expect(resolved.lights[0].azimuth).toBe(45)
		expect(resolved.lights[0].elevation).toBe(10)
		expect(resolved.occlusion.live.intensity).toBe(1.4)
	})

	it('lights in white where a color is anything but #rrggbb hex', () => {
		expect(
			resolveLighting({
				lighting: { lights: [{ role: 'fill', color: 'red;x:url(y)' }] }
			}).lights[0].color
		).toBe('#ffffff')
	})
})

describe('resolveLighting for a scene saved before lighting', () => {
	it('lights a scene that names nothing with the default environment alone', () => {
		expect(resolveLighting()).toEqual({
			environment: {
				map: 'studio-natural',
				resolution: '1k',
				intensity: 1,
				rotation: 0
			},
			lights: [],
			ground: { enabled: false },
			background: { type: 'none' },
			occlusion: { mode: 'off', live: { intensity: 1.4, atRest: false } }
		})
	})

	it('carries the environment over exactly', () => {
		expect(
			resolveLighting({
				environment: {
					preset: 'outdoor-golden-hour',
					environmentResolution: '4k',
					environmentIntensity: 0.6
				}
			}).environment
		).toEqual({
			map: 'outdoor-golden-hour',
			resolution: '4k',
			intensity: 0.6,
			rotation: 0
		})
	})

	it('adds no light while shadows were off, so the scene looks as it did', () => {
		const resolved = resolveLighting({
			shadows: { enabled: false, light: { position: [3, 2, 1] } }
		})
		expect(resolved.lights).toEqual([])
		expect(resolved.ground.enabled).toBe(false)
	})

	it("turns the shadow's own light into the key, at its default overhead place", () => {
		const resolved = resolveLighting({ shadows: { enabled: true } })
		expect(resolved.ground.enabled).toBe(true)
		expect(resolved.lights).toHaveLength(1)
		const [key] = resolved.lights
		expect(key.role).toBe('key')
		expect(key.elevation).toBeCloseTo(90)
		// A 0.8-wide jitter box at distance 2.5 spans 2 * atan(0.4 / 2.5).
		expect(key.size).toBeCloseTo(18.18, 1)
	})

	it('points the key where the old light stood', () => {
		const [key] = resolveLighting({
			shadows: { enabled: true, light: { position: [3, 2, 1], radius: 0.4 } }
		}).lights
		expect(key.azimuth).toBeCloseTo(71.57, 1)
		expect(key.elevation).toBeCloseTo(32.31, 1)
		expect(key.size).toBeCloseTo(6.12, 1)
	})

	it('makes a lighter legacy shadow a weaker key', () => {
		const strength = (light: { ambient: number }, opacity: number) =>
			resolveLighting({ shadows: { enabled: true, light, opacity } }).lights[0]
				.intensity
		// 0.7 of the light blocked, drawn at 0.3: 0.21 of the ground's light.
		expect(strength({ ambient: 0.3 }, 0.3)).toBeCloseTo(0.21 / 0.79)
		expect(strength({ ambient: 0.6 }, 0.9)).toBeCloseTo(0.36 / 0.64)
		expect(strength({ ambient: 0.6 }, 0.9)).toBeLessThan(
			strength({ ambient: 0.3 }, 0.9)
		)
	})

	it('never gives a migrated key more than the whole environment', () => {
		// The darkest preset and the default would otherwise ask for 11x and 1.7x.
		for (const [ambient, opacity] of [
			[0.08, 1],
			[0.3, 0.9],
			[0, 1]
		]) {
			const [key] = resolveLighting({
				shadows: { enabled: true, light: { ambient }, opacity }
			}).lights
			expect(key.intensity).toBe(1)
		}
	})

	it('gives no strength to a light that carried none', () => {
		const [key] = resolveLighting({
			shadows: { enabled: true, light: { ambient: 2 } }
		}).lights
		expect(key.intensity).toBe(0)
	})

	it('keeps live ambient occlusion only where the viewer drew it: with shadows on', () => {
		expect(
			resolveLighting({ shadows: { enabled: false, ao: true } }).occlusion.mode
		).toBe('off')
		expect(
			resolveLighting({
				shadows: { enabled: true, ao: true, aoIntensity: 2, aoAtRest: true }
			}).occlusion
		).toEqual({ mode: 'live', live: { intensity: 2, atRest: true } })
	})

	it('maps the background: the map wins, then the stage, then nothing', () => {
		const stage = { type: 'color', color: '#f4f4f5' } as const
		expect(
			resolveLighting({
				environment: {
					background: true,
					backgroundIntensity: 0.8,
					backgroundBlurriness: 0.2,
					backdrop: stage
				}
			}).background
		).toEqual({ type: 'environment', intensity: 0.8, blur: 0.2 })
		expect(
			resolveLighting({ environment: { background: false, backdrop: stage } })
				.background
		).toEqual(stage)
		expect(
			resolveLighting({
				environment: { backdrop: { type: 'color', color: 'tomato' } }
			}).background
		).toEqual({ type: 'none' })
	})
})
