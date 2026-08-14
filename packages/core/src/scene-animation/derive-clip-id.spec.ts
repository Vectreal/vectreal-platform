import { describe, expect, it } from 'vitest'

import { deriveAnimationClipId } from './derive-clip-id'
import { describeAnimationClips } from './describe-animation-clips'

const idsFor = (names: string[]): string[] => {
	const seen = new Map<string, number>()
	return names.map((name, index) => deriveAnimationClipId(name, index, seen))
}

describe('deriveAnimationClipId', () => {
	it('slugifies a name', () => {
		expect(idsFor(['Take 001'])).toEqual(['take-001'])
	})

	it('collapses runs of punctuation and trims the edges', () => {
		expect(idsFor(['  --Idle__Loop!!  '])).toEqual(['idle-loop'])
	})

	it('falls back to a positional id for an unnamed clip', () => {
		expect(idsFor(['', ''])).toEqual(['clip-0', 'clip-1'])
	})

	it('falls back to a positional id when a name has no latin alphanumerics', () => {
		expect(idsFor(['日本語', '!!!'])).toEqual(['clip-0', 'clip-1'])
	})

	it('disambiguates duplicate names by ordinal', () => {
		expect(idsFor(['Spin', 'Spin', 'Spin'])).toEqual([
			'spin',
			'spin~1',
			'spin~2'
		])
	})

	it('disambiguates names that collide only after slugifying', () => {
		expect(idsFor(['Wave Hand', 'wave-hand', 'WAVE_HAND'])).toEqual([
			'wave-hand',
			'wave-hand~1',
			'wave-hand~2'
		])
	})

	it('disambiguates a name that collides with a positional fallback', () => {
		// The unnamed clip at index 1 wants `clip-1`, which the named clip already
		// took. Without disambiguating positional ids too, these would collide.
		expect(idsFor(['clip 1', ''])).toEqual(['clip-1', 'clip-1~1'])
	})

	it('is deterministic across repeated passes', () => {
		const names = ['Spin', '', 'Spin', 'Idle']
		expect(idsFor(names)).toEqual(idsFor(names))
	})
})

describe('describeAnimationClips', () => {
	it('resolves ids, positions and durations in one pass', () => {
		expect(
			describeAnimationClips([
				{ name: 'Spin', duration: 2 },
				{ name: 'Spin', duration: 3 },
				{ name: '', duration: 0 }
			])
		).toEqual([
			{ clipId: 'spin', name: 'Spin', index: 0, duration: 2 },
			{ clipId: 'spin~1', name: 'Spin', index: 1, duration: 3 },
			{ clipId: 'clip-2', name: '', index: 2, duration: 0 }
		])
	})

	it('returns an empty list for a model with no clips', () => {
		expect(describeAnimationClips([])).toEqual([])
	})
})
