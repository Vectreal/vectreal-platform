import { resolveLighting } from '@vctrl/core'
import {
	DataTexture,
	DataUtils,
	FloatType,
	HalfFloatType,
	type TextureDataType
} from 'three'
import { describe, expect, it } from 'vitest'

import {
	LIGHT_DISTANCE_FACTOR,
	environmentIrradiance,
	groundBakeInputs,
	groundBakeSources,
	lightDirection,
	litLights,
	shadowFilterRadius
} from './scene-lighting'

import type { LightingSettings } from '@vctrl/core'

/** The ground bake's inputs for a scene's lighting, as the viewer derives them. */
const sourcesFor = (lighting: LightingSettings, modelRadius: number) => {
	const resolved = resolveLighting({ lighting })
	return groundBakeSources(
		litLights(resolved),
		resolved.environment.rotation,
		modelRadius
	)
}

describe('lightDirection', () => {
	it('lights from +Z at azimuth 0 and from +X at 90', () => {
		const [x, y, z] = lightDirection({ azimuth: 0, elevation: 0 }, 0)
		expect([x, y, z].map((n) => +n.toFixed(6))).toEqual([0, 0, 1])
		const side = lightDirection({ azimuth: 90, elevation: 0 }, 0)
		expect(side[0]).toBeCloseTo(1)
		expect(side[2]).toBeCloseTo(0)
	})

	it('points straight up at elevation 90', () => {
		expect(lightDirection({ azimuth: 30, elevation: 90 }, 0)[1]).toBeCloseTo(1)
	})

	it('turns with the environment', () => {
		expect(lightDirection({ azimuth: 30, elevation: 20 }, 60)).toEqual(
			lightDirection({ azimuth: 90, elevation: 20 }, 0)
		)
	})
})

/** An equirectangular map of uniform radiance, RGBA, top row first. */
const uniformMap = (radiance: number, type: TextureDataType = FloatType) => {
	const width = 64
	const height = 32
	const values = new Array(width * height * 4).fill(radiance)
	const data =
		type === HalfFloatType
			? Uint16Array.from(values, (v) => DataUtils.toHalfFloat(v))
			: Float32Array.from(values)
	const map = new DataTexture(data, width, height, undefined, type)
	// Top row first, as the HDR loader stores and flags it.
	map.flipY = true
	return map
}

describe('environmentIrradiance', () => {
	it('gives PI times a uniform radiance, as a cosine-weighted hemisphere does', () => {
		expect(environmentIrradiance(uniformMap(1))).toBeCloseTo(Math.PI, 1)
		expect(environmentIrradiance(uniformMap(0.5))).toBeCloseTo(Math.PI / 2, 1)
	})

	it('reads half-float pixels as the values they encode', () => {
		expect(environmentIrradiance(uniformMap(2, HalfFloatType))).toBeCloseTo(
			2 * Math.PI,
			1
		)
	})

	it('counts only the sky: light from below never reaches an up-facing surface', () => {
		const map = uniformMap(0)
		const data = map.image.data as Float32Array
		// Lower half only.
		data.fill(10, data.length / 2)
		expect(environmentIrradiance(map)).toBeCloseTo(0)
	})

	it('reads a bottom-first map, as the EXR loader stores one, from its far end', () => {
		const map = uniformMap(0)
		map.flipY = false
		const data = map.image.data as Float32Array
		// Stored second half: the top of a bottom-first map.
		data.fill(1, data.length / 2)
		expect(environmentIrradiance(map)).toBeCloseTo(Math.PI, 1)
	})

	it('is null for a map without pixels', () => {
		expect(environmentIrradiance(null)).toBeNull()
	})
})

describe('shadowFilterRadius', () => {
	it('softens with the light size and stays within the filter range', () => {
		expect(shadowFilterRadius(30)).toBeGreaterThan(shadowFilterRadius(5))
		expect(shadowFilterRadius(0)).toBe(1)
		expect(shadowFilterRadius(45)).toBe(8)
		expect(shadowFilterRadius(170)).toBe(8)
	})
})

describe('groundBakeInputs', () => {
	it('keeps only what changes the shadow, so a new color re-bakes nothing', () => {
		const lit = (color: string) =>
			groundBakeInputs(
				resolveLighting({ lighting: { lights: [{ role: 'key', color }] } })
					.lights
			)
		expect(lit('#ff0000')).toEqual(lit('#00ff00'))
	})
})

describe('groundBakeSources', () => {
	it('fills from the environment alone when there is no light', () => {
		const { sources, ambient, blockedShare, distance } = sourcesFor(
			{ ground: { enabled: true } },
			2
		)
		expect(sources).toEqual([])
		expect(ambient).toBe(1)
		expect(blockedShare).toBe(1)
		expect(distance).toBe(LIGHT_DISTANCE_FACTOR * 2)
	})

	it('keeps 1 / (1 + total strength) of the light under lights overhead', () => {
		const { blockedShare } = sourcesFor(
			{
				lights: [
					{ role: 'key', elevation: 90, intensity: 1.5 },
					{ role: 'fill', elevation: 90, intensity: 0.5 },
					{ role: 'rim', intensity: 2, enabled: false }
				]
			},
			1
		)
		expect(blockedShare).toBeCloseTo(1 / 3)
	})

	it('counts a low light for less, as it reaches the ground at a slant', () => {
		const { blockedShare } = sourcesFor(
			{ lights: [{ role: 'key', elevation: 30, intensity: 1 }] },
			1
		)
		expect(blockedShare).toBeCloseTo(1 / 1.5)
	})

	it('samples so the baked shadow keeps the share the lights promise', () => {
		const lights = [
			{ role: 'key', elevation: 50, intensity: 0.8 },
			{ role: 'fill', elevation: 20, intensity: 0.3 },
			{ role: 'rim', elevation: 70, intensity: 0.5 }
		] as const
		const { sources, ambient, blockedShare } = sourcesFor(
			{ lights: [...lights] },
			1
		)
		// What one sample delivers to a Lambertian plane: a uniform hemisphere
		// sample averages a cosine of 1/2, a light the sine of its elevation.
		const totalWeight = sources.reduce((sum, { weight }) => sum + weight, 0)
		const fromHemisphere = ambient / 2
		const fromLights = sources.reduce(
			(sum, { position, weight }) =>
				sum +
				(1 - ambient) *
					(weight / totalWeight) *
					(position[1] / Math.hypot(...position)),
			0
		)
		expect(fromHemisphere / (fromHemisphere + fromLights)).toBeCloseTo(
			blockedShare
		)
	})

	it('places each light where it stands, as wide as it looks, weighted by strength', () => {
		const { sources } = sourcesFor(
			{
				environment: { rotation: 90 },
				lights: [
					{ role: 'key', azimuth: 0, elevation: 0, size: 90, intensity: 2 }
				]
			},
			1
		)
		const [key] = sources
		expect(key.position[0]).toBeCloseTo(LIGHT_DISTANCE_FACTOR)
		expect(key.position[2]).toBeCloseTo(0)
		// A light 90 degrees across spans twice its distance.
		expect(key.radius).toBeCloseTo(2 * LIGHT_DISTANCE_FACTOR)
		expect(key.weight).toBe(2)
	})

	it('skips lights that are off or give nothing', () => {
		const { sources } = sourcesFor(
			{
				lights: [
					{ role: 'key', enabled: false },
					{ role: 'fill', intensity: 0 }
				]
			},
			1
		)
		expect(sources).toEqual([])
	})
})
