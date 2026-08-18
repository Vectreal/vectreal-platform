import { describeAnimationClips } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { resolvePlaybackClips } from './resolve-playback-clips'

import type { AnimationClipConfig, AnimationSettings } from '@vctrl/core'

const model = [
	{ name: 'Spin', duration: 2 },
	{ name: 'Idle', duration: 4 },
	{ name: 'Empty', duration: 0 }
]

/** Ids are opaque, so tests derive them the same way production does. */
const idOf = (name: string): string =>
	describeAnimationClips(model).find((entry) => entry.name === name)
		?.clipId as string

const config = (
	name: string,
	overrides: Partial<AnimationClipConfig> = {}
): AnimationClipConfig => ({
	clipId: idOf(name),
	sourceName: name,
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

describe('resolvePlaybackClips', () => {
	it('resolves configs onto their clip indices', () => {
		expect(resolvePlaybackClips(settings([config('Idle')]), model)).toEqual([
			{
				clipId: idOf('Idle'),
				clipIndex: 1,
				duration: 4,
				loop: 'repeat',
				timeScale: 1,
				startOffset: 0
			}
		])
	})

	it('resolves every clip when configs are built from describeAnimationClips', () => {
		// The contract between an authoring surface and the runtime: configs
		// derived the documented way must always match. Ids carry a digest of the
		// clip name, so anything hand-written silently resolves to nothing and the
		// scene sits still with no error — which is exactly what happened to the
		// Storybook story when the id format changed underneath it.
		const configs = describeAnimationClips(model).map((descriptor, order) => ({
			clipId: descriptor.clipId,
			sourceName: descriptor.name,
			sourceIndex: descriptor.index,
			enabled: true,
			order,
			loop: 'repeat' as const,
			timeScale: 1,
			startOffset: 0
		}))

		const resolved = resolvePlaybackClips(settings(configs), model)

		// 'Empty' is zero-length and legitimately dropped; the rest must survive.
		expect(resolved.map((entry) => entry.clipId)).toEqual([
			idOf('Spin'),
			idOf('Idle')
		])
	})

	it('returns nothing when animation is disabled', () => {
		expect(
			resolvePlaybackClips(settings([config('Spin')], { enabled: false }), model)
		).toEqual([])
	})

	it('returns nothing when there are no settings at all', () => {
		expect(resolvePlaybackClips(undefined, model)).toEqual([])
	})

	it('returns nothing when the model carries no clips', () => {
		expect(resolvePlaybackClips(settings([config('Spin')]), [])).toEqual([])
	})

	it('survives a settings object with no clips array', () => {
		// Settings arrive from a consumer prop, which in practice is persisted
		// JSON. Indexing a missing array here would throw inside the R3F tree.
		expect(
			resolvePlaybackClips(
				{ enabled: true } as unknown as AnimationSettings,
				model
			)
		).toEqual([])
	})

	it('drops disabled clips', () => {
		expect(
			resolvePlaybackClips(
				settings([config('Spin', { enabled: false }), config('Idle')]),
				model
			).map((entry) => entry.clipId)
		).toEqual([idOf('Idle')])
	})

	it('drops zero-length clips, which could never advance a sequence', () => {
		expect(resolvePlaybackClips(settings([config('Empty')]), model)).toEqual([])
	})

	it('drops configs with no matching clip instead of failing', () => {
		expect(
			resolvePlaybackClips(
				settings([config('Spin', { clipId: 'ghost' }), config('Spin')]),
				model
			).map((entry) => entry.clipId)
		).toEqual([idOf('Spin')])
	})

	it('sorts by author order rather than clip order', () => {
		expect(
			resolvePlaybackClips(
				settings([
					config('Spin', { order: 5 }),
					config('Idle', { order: 1 })
				]),
				model
			).map((entry) => entry.clipId)
		).toEqual([idOf('Idle'), idOf('Spin')])
	})

	it('clamps a start offset that runs past the end of the clip', () => {
		const [resolved] = resolvePlaybackClips(
			settings([config('Spin', { startOffset: 99 })]),
			model
		)

		expect(resolved?.startOffset).toBe(2)
	})

	describe('the sequence hand-off guard', () => {
		// A clip with infinite repetitions never emits three's `finished` event, so
		// a chain parked on one stalls forever with nothing to explain it.
		it('forces every clip but the last to end', () => {
			const resolved = resolvePlaybackClips(
				settings(
					[config('Spin', { order: 0 }), config('Idle', { order: 1 })],
					{ mode: 'sequence' }
				),
				model
			)

			expect(resolved.map((entry) => entry.repetitions)).toEqual([1, undefined])
		})

		it('forces the last clip to end too when the chain loops', () => {
			// Otherwise `loopSequence` is silently dead: the wrap only happens on a
			// finish from the final clip.
			const resolved = resolvePlaybackClips(
				settings([config('Spin', { order: 0 }), config('Idle', { order: 1 })], {
					mode: 'sequence',
					loopSequence: true
				}),
				model
			)

			expect(resolved.map((entry) => entry.repetitions)).toEqual([1, 1])
		})

		it('leaves an explicit repeat count alone', () => {
			const resolved = resolvePlaybackClips(
				settings(
					[
						config('Spin', { order: 0, repetitions: 3 }),
						config('Idle', { order: 1 })
					],
					{ mode: 'sequence' }
				),
				model
			)

			expect(resolved[0]?.repetitions).toBe(3)
		})

		it('leaves a play-once clip alone, since it already ends', () => {
			const resolved = resolvePlaybackClips(
				settings(
					[
						config('Spin', { order: 0, loop: 'once' }),
						config('Idle', { order: 1 })
					],
					{ mode: 'sequence' }
				),
				model
			)

			expect(resolved[0]).not.toHaveProperty('repetitions')
		})

		it('does not apply in simultaneous mode, where clips may loop forever', () => {
			const resolved = resolvePlaybackClips(
				settings([config('Spin', { order: 0 }), config('Idle', { order: 1 })]),
				model
			)

			expect(resolved.map((entry) => entry.repetitions)).toEqual([
				undefined,
				undefined
			])
		})
	})
})
