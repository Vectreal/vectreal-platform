import { describe, expect, it } from 'vitest'

import {
	COMPRESSED_ENVIRONMENT_KEYS,
	ENVIRONMENT_KEYS,
	ENVIRONMENT_MAP_BYTES,
	environmentMapBytes,
	loadedEnvironmentQuality,
	resolveEnvironmentFiles
} from '.'

describe('resolveEnvironmentFiles', () => {
	it('points a preset at its hosted HDR', () => {
		expect(
			resolveEnvironmentFiles({
				preset: 'studio-soft',
				environmentResolution: '4k'
			})
		).toBe(
			'https://storage.googleapis.com/environment-maps/studio/studio_soft_4k.hdr'
		)
	})

	it('defaults to the studio-natural preset at 1k', () => {
		expect(resolveEnvironmentFiles()).toBe(
			'https://storage.googleapis.com/environment-maps/studio/studio_natural_1k.hdr'
		)
	})

	it('uses a scene’s own files over its preset', () => {
		expect(
			resolveEnvironmentFiles({ preset: 'studio-soft', files: '/env/mine.hdr' })
		).toBe('/env/mine.hdr')
	})

	it('points a compressed scene at the gain map JPEG beside the HDR', () => {
		expect(
			resolveEnvironmentFiles({
				preset: 'studio-soft',
				environmentResolution: '4k',
				environmentQuality: 'compressed'
			})
		).toBe(
			'https://storage.googleapis.com/environment-maps/studio/studio_soft_4k.jpg'
		)
	})

	it('loads the HDR for a map with no compressed version, whatever is asked', () => {
		const environment = {
			preset: 'night-city',
			environmentQuality: 'compressed'
		} as const
		expect(loadedEnvironmentQuality(environment)).toBe('lossless')
		expect(resolveEnvironmentFiles(environment)).toBe(
			'https://storage.googleapis.com/environment-maps/night/night_city_1k.hdr'
		)
	})

	it('loads a scene’s own files as they are', () => {
		const environment = {
			files: '/env/mine.hdr',
			environmentQuality: 'compressed'
		} as const
		expect(loadedEnvironmentQuality(environment)).toBeNull()
		expect(resolveEnvironmentFiles(environment)).toBe('/env/mine.hdr')
	})
})

describe('environmentMapBytes', () => {
	it('gives what the quality that loads downloads', () => {
		const { lossless, compressed } =
			ENVIRONMENT_MAP_BYTES['studio-natural']['1k']
		expect(environmentMapBytes()).toBe(lossless)
		expect(environmentMapBytes({ environmentQuality: 'compressed' })).toBe(
			compressed
		)
		expect(
			environmentMapBytes({
				preset: 'night-city',
				environmentQuality: 'compressed'
			})
		).toBe(ENVIRONMENT_MAP_BYTES['night-city']['1k'].lossless)
	})

	it('knows no size for a scene’s own files', () => {
		expect(environmentMapBytes({ files: '/env/mine.hdr' })).toBeNull()
	})

	it('has a compressed size for exactly the maps that have a compressed version', () => {
		for (const key of ENVIRONMENT_KEYS) {
			for (const resolution of ['1k', '4k'] as const) {
				const { lossless, compressed } = ENVIRONMENT_MAP_BYTES[key][resolution]
				expect(lossless).toBeGreaterThan(0)
				expect(compressed !== null).toBe(
					COMPRESSED_ENVIRONMENT_KEYS.includes(key)
				)
			}
		}
	})
})
