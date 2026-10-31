import { describe, expect, it } from 'vitest'

import { ENVIRONMENT_LIGHTS } from './environment-lights'
import { DEFAULT_LIGHTING_SETUP, LIGHTING_SETUPS } from './lighting-setups'

describe('LIGHTING_SETUPS', () => {
	it('names every setup once', () => {
		const ids = LIGHTING_SETUPS.map((setup) => setup.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain(DEFAULT_LIGHTING_SETUP)
	})

	it("stands every key on its own map's brightest light", () => {
		for (const { id, lighting } of LIGHTING_SETUPS) {
			const key = lighting.lights?.find((light) => light.role === 'key')
			if (!key) continue
			const map = lighting.environment?.map
			const [brightest] = map ? ENVIRONMENT_LIGHTS[map] : []
			expect(key.azimuth, `${id} on ${map}`).toBe(brightest?.azimuth)
		}
	})

	it('leaves a map without lights to the environment alone', () => {
		for (const { lighting } of LIGHTING_SETUPS) {
			const map = lighting.environment?.map
			if (map && ENVIRONMENT_LIGHTS[map].length === 0) {
				expect(lighting.lights ?? []).toEqual([])
			}
		}
	})
})
