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

	it('leaves repeat counts exactly as the author set them', () => {
		// The sequence-stall guard deliberately lives in the runtime projection,
		// not here: writing a repeat count back over saved data meant a later
		// switch to simultaneous mode inherited a clip that no longer looped.
		const result = withClips(
			[
				{ clipId: 'a', order: 0 },
				{ clipId: 'b', order: 1 }
			],
			{ mode: 'sequence' }
		)

		expect(result?.clips.map((entry) => entry.repetitions)).toEqual([
			undefined,
			undefined
		])
	})

	describe('booleans', () => {
		it('treats null as absent rather than malformed', () => {
			// The field round-trips through a JSON column, where a stored null is an
			// ordinary way to say "nothing saved".
			expect(normalizeSceneAnimation(null)).toBeUndefined()
		})

		it.each(['enabled', 'autoplay', 'loopSequence', 'showControls'])(
			'rejects a non-boolean %s rather than coercing it',
			(field) => {
				// Coercing meant a client stringifying its booleans silently turned
				// the whole feature off instead of being told the shape was wrong.
				expect(() => normalize({ [field]: 'true' })).toThrow(
					`animation.${field} must be a boolean`
				)
			}
		)

		it('rejects a non-boolean clip enabled flag', () => {
			expect(() => withClips([{ clipId: 'a', enabled: 'yes' }])).toThrow(
				'animation.clips[0].enabled must be a boolean'
			)
		})
	})
})
