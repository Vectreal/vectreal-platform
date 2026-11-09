import {
	DataTexture,
	DataUtils,
	FloatType,
	HalfFloatType,
	type TextureDataType
} from 'three'
import { describe, expect, it } from 'vitest'

import { environmentIrradiance } from './environment-irradiance'

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
