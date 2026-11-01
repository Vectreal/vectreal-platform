import { LIGHTING_SETUPS, type LightingSettings } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { hexToKelvin, kelvinToHex, NEUTRAL_KELVIN } from './color-temperature'
import {
	backgroundOfType,
	withFinish,
	matchingSetup,
	withLight,
	withLightAdded,
	withLightRemoved,
	withSetup,
	wrapDegrees
} from './lighting-edits'

const [softStudio, product] = LIGHTING_SETUPS

describe('matchingSetup', () => {
	it('finds every setup from its own lighting', () => {
		for (const setup of LIGHTING_SETUPS) {
			expect(matchingSetup(setup.lighting)?.id).toBe(setup.id)
		}
	})

	it('still finds a setup turned, at 4k, on a stage, with occlusion', () => {
		const lighting: LightingSettings = {
			...softStudio.lighting,
			environment: {
				...softStudio.lighting.environment,
				rotation: 120,
				resolution: '4k'
			},
			background: { type: 'color', color: '#ffffff' },
			occlusion: { mode: 'live' }
		}

		expect(matchingSetup(lighting)?.id).toBe(softStudio.id)
	})

	it('lets go once a light is edited', () => {
		const edited = withLight(softStudio.lighting, 'key', { intensity: 2 })

		expect(matchingSetup(edited)).toBeUndefined()
	})

	it('lets go once the ground is turned off', () => {
		expect(
			matchingSetup({ ...softStudio.lighting, ground: { enabled: false } })
		).toBeUndefined()
	})
})

describe('withSetup', () => {
	it('takes the look and keeps the composition', () => {
		const current: LightingSettings = {
			...softStudio.lighting,
			environment: { map: 'night-city', resolution: '4k' },
			background: { type: 'gradient', top: '#000000', bottom: '#111111' },
			occlusion: { mode: 'live', live: { atRest: true } },
			bake: { lights: true }
		}

		const next = withSetup(current, product)

		expect(next.environment?.map).toBe(product.lighting.environment?.map)
		expect(next.environment?.resolution).toBe('4k')
		expect(next.lights).toEqual(product.lighting.lights)
		expect(next.background).toEqual(current.background)
		expect(next.occlusion).toEqual(current.occlusion)
		expect(next.bake).toEqual(current.bake)
		expect(matchingSetup(next)?.id).toBe(product.id)
	})
})

describe('lights', () => {
	it('adds a role once, in key, fill, rim order, placed from the key', () => {
		const keyOnly: LightingSettings = {
			lights: [{ role: 'key', azimuth: 100 }]
		}

		const withRim = withLightAdded(keyOnly, 'rim')
		const withBoth = withLightAdded(withRim, 'fill')

		expect(withBoth.lights?.map((light) => light.role)).toEqual([
			'key',
			'fill',
			'rim'
		])
		expect(withBoth.lights?.[1].azimuth).toBe(-10)
		expect(withBoth.lights?.[2].azimuth).toBe(-100)
		expect(withLightAdded(withBoth, 'fill')).toBe(withBoth)
	})

	it('changes and removes only the light of the role', () => {
		const lighting = withLightAdded(
			{ lights: [{ role: 'key', intensity: 1 }] },
			'fill'
		)

		const changed = withLight(lighting, 'fill', { enabled: false })
		expect(changed.lights?.[0]).toEqual(lighting.lights?.[0])
		expect(changed.lights?.[1].enabled).toBe(false)

		expect(withLightRemoved(changed, 'key').lights).toEqual([
			changed.lights?.[1]
		])
	})

	it('wraps degrees into [-180, 180)', () => {
		expect(wrapDegrees(180)).toBe(-180)
		expect(wrapDegrees(270)).toBe(-90)
		expect(wrapDegrees(-190)).toBe(170)
		expect(wrapDegrees(45)).toBe(45)
	})
})

describe('backgroundOfType', () => {
	it('keeps a stage the author picked when it is that type already', () => {
		const stage = { type: 'color', color: '#123456' } as const
		expect(backgroundOfType('color', stage)).toBe(stage)
	})

	it('starts each type from its default', () => {
		expect(backgroundOfType('gradient', { type: 'none' })).toEqual({
			type: 'gradient',
			top: '#fafafa',
			bottom: '#d4d4d8'
		})
		expect(backgroundOfType('environment', undefined)).toEqual({
			type: 'environment'
		})
	})
})

describe('color temperature', () => {
	it('is white at neutral, warm below it and cool above it', () => {
		expect(kelvinToHex(NEUTRAL_KELVIN)).toBe('#ffffff')
		const warm = kelvinToHex(3200)
		const cool = kelvinToHex(9000)
		expect(parseInt(warm.slice(5), 16)).toBeLessThan(255)
		expect(parseInt(cool.slice(1, 3), 16)).toBeLessThan(255)
	})

	// Near the top of the range neighboring steps share a color, so what has
	// to hold is that the color survives the trip, not the step.
	it('reads back a temperature that writes the same color', () => {
		for (let kelvin = 2000; kelvin <= 10000; kelvin += 100) {
			const hex = kelvinToHex(kelvin)
			expect(kelvinToHex(hexToKelvin(hex))).toBe(hex)
		}
		expect(hexToKelvin(kelvinToHex(3200))).toBe(3200)
	})
})

describe('withFinish', () => {
	it('bakes the occlusion for Depth and hands it back to live without it', () => {
		const on = withFinish({ occlusion: { mode: 'off' } }, { depth: true })
		expect(on.occlusion?.mode).toBe('baked')
		expect(withFinish(on, { depth: false }).occlusion?.mode).toBe('live')
	})

	it('switches the studio lights without touching the occlusion', () => {
		const lighting: LightingSettings = {
			occlusion: { mode: 'live', live: { intensity: 2 } }
		}
		const next = withFinish(lighting, { lights: true })
		expect(next.bake?.lights).toBe(true)
		expect(next.occlusion).toBe(lighting.occlusion)
	})
})
