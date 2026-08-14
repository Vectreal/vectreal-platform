import { describe, expect, it } from 'vitest'

import { resolvePlaybackClips } from './resolve-playback-clips'

import type { AnimationClipConfig, AnimationSettings } from '@vctrl/core'

const config = (
	clipId: string,
	overrides: Partial<AnimationClipConfig> = {}
): AnimationClipConfig => ({
	clipId,
	sourceName: clipId,
	sourceIndex: 0,
	enabled: true,
	order: 0,
	loop: 'repeat',
	timeScale: 1,
	startOffset: 0,
	...overrides
})

const settings = (
	clips: AnimationClipConfig[],
	overrides: Partial<AnimationSettings> = {}
): AnimationSettings => ({
	enabled: true,
	mode: 'simultaneous',
	autoplay: true,
	loopSequence: false,
	showControls: false,
	clips,
	...overrides
})

const model = [
	{ name: 'Spin', duration: 2 },
	{ name: 'Idle', duration: 4 },
	{ name: 'Empty', duration: 0 }
]

describe('resolvePlaybackClips', () => {
	it('resolves configs onto their clip indices', () => {
		const result = resolvePlaybackClips(
			settings([config('idle', { sourceIndex: 1 })]),
			model
		)

		expect(result).toEqual([
			{
				clipId: 'idle',
				clipIndex: 1,
				duration: 4,
				loop: 'repeat',
				timeScale: 1,
				startOffset: 0
			}
		])
	})

	it('returns nothing when animation is disabled', () => {
		expect(
			resolvePlaybackClips(settings([config('spin')], { enabled: false }), model)
		).toEqual([])
	})

	it('returns nothing when there are no settings at all', () => {
		expect(resolvePlaybackClips(undefined, model)).toEqual([])
	})

	it('returns nothing when the model carries no clips', () => {
		expect(resolvePlaybackClips(settings([config('spin')]), [])).toEqual([])
	})

	it('drops disabled clips', () => {
		expect(
			resolvePlaybackClips(
				settings([config('spin', { enabled: false }), config('idle')]),
				model
			).map((entry) => entry.clipId)
		).toEqual(['idle'])
	})

	it('drops zero-length clips, which could never advance a sequence', () => {
		expect(
			resolvePlaybackClips(settings([config('empty')]), model)
		).toEqual([])
	})

	it('drops configs with no matching clip instead of failing', () => {
		expect(
			resolvePlaybackClips(
				settings([config('ghost'), config('spin')]),
				model
			).map((entry) => entry.clipId)
		).toEqual(['spin'])
	})

	it('sorts by author order rather than clip order', () => {
		expect(
			resolvePlaybackClips(
				settings([
					config('spin', { order: 5 }),
					config('idle', { order: 1 })
				]),
				model
			).map((entry) => entry.clipId)
		).toEqual(['idle', 'spin'])
	})

	it('carries a finite repeat count through and omits an infinite one', () => {
		const [finite, infinite] = resolvePlaybackClips(
			settings([
				config('spin', { order: 0, repetitions: 3 }),
				config('idle', { order: 1 })
			]),
			model
		)

		expect(finite?.repetitions).toBe(3)
		expect(infinite).not.toHaveProperty('repetitions')
	})

	it('clamps a start offset that runs past the end of the clip', () => {
		const [resolved] = resolvePlaybackClips(
			settings([config('spin', { startOffset: 99 })]),
			model
		)

		expect(resolved?.startOffset).toBe(2)
	})
})
