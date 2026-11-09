import { ENVIRONMENT_MAP_BYTES } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { environmentQualityChoice, qualityLabel } from './environment-quality'

describe('environmentQualityChoice', () => {
	it('offers both sizes and says how much sooner the compressed map lights the scene', () => {
		const choice = environmentQualityChoice(
			{ map: 'studio-natural', resolution: '1k' },
			false
		)
		expect(choice.canCompress).toBe(true)
		expect(choice.bytes).toEqual(ENVIRONMENT_MAP_BYTES['studio-natural']['1k'])
		// 1,222,108 bytes against 73,838, on the measured slow phone line.
		expect(choice.caption).toBe(
			'Compressed is about 17x smaller, so the lighting shows in about a second on a slow phone connection, instead of 7.'
		)
	})

	it('counts seconds for a map that takes more than one', () => {
		expect(
			environmentQualityChoice(
				{ map: 'studio-natural', resolution: '4k' },
				false
			).caption
		).toMatch(
			/shows in about \d+ seconds on a slow phone connection, instead of \d+\.$/
		)
	})

	it('fixes a map with no compressed version at lossless, and says why', () => {
		const choice = environmentQualityChoice(
			{ map: 'night-city', resolution: '1k' },
			false
		)
		expect(choice.canCompress).toBe(false)
		expect(choice.bytes).toEqual({
			compressed: null,
			lossless: ENVIRONMENT_MAP_BYTES['night-city']['1k'].lossless
		})
		expect(choice.caption).toBe(
			'This map has no compressed version, so it loads lossless.'
		)
	})

	it('knows no size for a scene’s own map, which loads lossless', () => {
		const choice = environmentQualityChoice(
			{ map: 'studio-natural', resolution: '1k' },
			true
		)
		expect(choice.canCompress).toBe(false)
		expect(choice.bytes).toEqual({ compressed: null, lossless: null })
	})
})

describe('qualityLabel', () => {
	it('names the quality with what it downloads, when that is known', () => {
		expect(qualityLabel('compressed', 73_838)).toBe('Compressed 72 KB')
		expect(qualityLabel('lossless', null)).toBe('Lossless')
	})
})
