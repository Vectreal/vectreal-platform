import { describe, expect, it } from 'vitest'

import { normalizeSceneAnimation } from './normalize-scene-animation'

import type { AnimationSettings } from '../types'

/** Untyped payloads are the point of this module, so casts are expected here. */
const normalize = (value: unknown) =>
	normalizeSceneAnimation(value as AnimationSettings)

const withClips = (clips: unknown[], overrides: Record<string, unknown> = {}) =>
	normalize({ enabled: true, mode: 'simultaneous', clips, ...overrides })

describe('normalizeSceneAnimation', () => {
	it('passes undefined through', () => {
		expect(normalizeSceneAnimation(undefined)).toBeUndefined()
	})

	it('rejects a non-object payload', () => {
		expect(() => normalize('nope')).toThrow('animation must be an object')
		expect(() => normalize([])).toThrow('animation must be an object')
	})

	it('defaults a bare payload to a safe, silent configuration', () => {
		expect(normalize({})).toEqual({
			enabled: false,
			mode: 'simultaneous',
			autoplay: true,
			loopSequence: false,
			showControls: false,
			clips: []
		})
	})

	it('rejects an unknown playback mode', () => {
		expect(() => normalize({ mode: 'crossfade' })).toThrow(
			'animation.mode must be one of simultaneous, sequence'
		)
	})

	it('rejects a non-array clips field', () => {
		expect(() => normalize({ clips: {} })).toThrow(
			'animation.clips must be an array'
		)
	})

	it('requires a non-empty clipId', () => {
		expect(() => withClips([{}])).toThrow(
			'animation.clips[0].clipId must be a non-empty string'
		)
		expect(() => withClips([{ clipId: '   ' }])).toThrow(
			'animation.clips[0].clipId must be a non-empty string'
		)
	})

	it('rejects duplicate clip ids', () => {
		expect(() => withClips([{ clipId: 'spin' }, { clipId: 'spin' }])).toThrow(
			'Duplicate animation clip id found: spin'
		)
	})

	it('rejects an unknown loop mode', () => {
		expect(() => withClips([{ clipId: 'spin', loop: 'boomerang' }])).toThrow(
			'animation.clips[0].loop must be one of once, repeat, ping_pong'
		)
	})

	it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN, 101, 'fast'])(
		'rejects timeScale %p',
		(timeScale) => {
			expect(() => withClips([{ clipId: 'spin', timeScale }])).toThrow(
				/timeScale must be a finite number/
			)
		}
	)

	it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, '2'])(
		'rejects startOffset %p',
		(startOffset) => {
			expect(() => withClips([{ clipId: 'spin', startOffset }])).toThrow(
				/startOffset must be a finite number/
			)
		}
	)

	it.each([0, -1, 1.5, '3'])('rejects repetitions %p', (repetitions) => {
		expect(() => withClips([{ clipId: 'spin', repetitions }])).toThrow(
			/repetitions must be an integer of at least 1/
		)
	})

	it('strips repetitions from a clip that plays once', () => {
		const result = withClips([
			{ clipId: 'spin', loop: 'once', repetitions: 4 }
		])

		expect(result?.clips[0]).not.toHaveProperty('repetitions')
	})

	it('renumbers order densely while preserving relative position', () => {
		const result = withClips([
			{ clipId: 'c', order: 50 },
			{ clipId: 'a', order: 10 },
			{ clipId: 'b', order: 20 }
		])

		expect(
			result?.clips.map((entry) => [entry.clipId, entry.order])
		).toEqual([
			['c', 2],
			['a', 0],
			['b', 1]
		])
	})

	describe('the sequence stall guard', () => {
		it('forces every non-terminal clip to a finite repeat count', () => {
			const result = withClips(
				[
					{ clipId: 'a', order: 0, loop: 'repeat' },
					{ clipId: 'b', order: 1, loop: 'ping_pong' },
					{ clipId: 'c', order: 2, loop: 'repeat' }
				],
				{ mode: 'sequence' }
			)

			expect(result?.clips.map((entry) => entry.repetitions)).toEqual([
				1,
				1,
				undefined
			])
		})

		it('leaves an explicit repeat count alone', () => {
			const result = withClips(
				[
					{ clipId: 'a', order: 0, repetitions: 3 },
					{ clipId: 'b', order: 1 }
				],
				{ mode: 'sequence' }
			)

			expect(result?.clips[0]?.repetitions).toBe(3)
		})

		it('treats the last enabled clip as terminal, ignoring disabled ones', () => {
			const result = withClips(
				[
					{ clipId: 'a', order: 0 },
					{ clipId: 'b', order: 1 },
					{ clipId: 'c', order: 2, enabled: false }
				],
				{ mode: 'sequence' }
			)

			// 'b' is the last clip that actually plays, so it may loop forever.
			expect(result?.clips.map((entry) => entry.repetitions)).toEqual([
				1,
				undefined,
				undefined
			])
		})

		it('does not apply in simultaneous mode', () => {
			const result = withClips([{ clipId: 'a' }, { clipId: 'b' }])

			expect(result?.clips.map((entry) => entry.repetitions)).toEqual([
				undefined,
				undefined
			])
		})
	})
})
