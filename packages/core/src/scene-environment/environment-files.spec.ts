import { describe, expect, it } from 'vitest'

import { resolveEnvironmentFiles } from '.'

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
})
