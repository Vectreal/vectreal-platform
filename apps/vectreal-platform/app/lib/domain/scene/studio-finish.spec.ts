import { describe, expect, it } from 'vitest'

import { bakesKey, publishBakes } from './studio-finish'

describe('publishBakes', () => {
	const key = { role: 'key' as const, azimuth: 30, elevation: 40 }

	it('bakes occlusion only when it is set to baked', () => {
		expect(publishBakes({ occlusion: { mode: 'baked' } }).occlusion).toBe(true)
		expect(publishBakes({ occlusion: { mode: 'live' } }).occlusion).toBe(false)
	})

	it('hands over the resolved lights when they are set to bake', () => {
		const { lights } = publishBakes({
			lights: [key],
			environment: { rotation: 15 },
			bake: { lights: true }
		})

		expect(lights).toMatchObject({
			environment: { rotation: 15 },
			lights: [{ role: 'key', azimuth: 30, elevation: 40, enabled: true }]
		})
	})

	it('bakes no lights unless asked, or when none is on', () => {
		expect(publishBakes({ lights: [key] }).lights).toBe(false)
		expect(
			publishBakes({
				lights: [{ ...key, enabled: false }],
				bake: { lights: true }
			}).lights
		).toBe(false)
	})
})

describe('bakesKey', () => {
	const key = { role: 'key' as const, azimuth: 30, elevation: 40 }

	it('is null while nothing is baked', () => {
		expect(bakesKey(undefined)).toBeNull()
		expect(bakesKey({ occlusion: { mode: 'live' }, lights: [key] })).toBeNull()
	})

	it('changes when a baked light moves, and not when a live one does', () => {
		const baked = { lights: [key], bake: { lights: true } }
		const moved = { lights: [{ ...key, azimuth: 31 }], bake: { lights: true } }

		expect(bakesKey(moved)).not.toBe(bakesKey(baked))
		expect(bakesKey({ occlusion: { mode: 'baked' }, lights: [key] })).toBe(
			bakesKey({
				occlusion: { mode: 'baked' },
				lights: [{ ...key, azimuth: 31 }]
			})
		)
	})
})
