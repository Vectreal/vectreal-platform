import { describe, expect, it } from 'vitest'

import { deriveAnimationClipId } from './derive-clip-id'
import { describeAnimationClips } from './describe-animation-clips'

const idsFor = (names: string[]): string[] => {
	const seen = new Map<string, number>()
	return names.map((name) => deriveAnimationClipId(name, seen))
}

/** Ids carry an opaque digest; most assertions care about shape, not its value. */
const shapeOf = (names: string[]): string[] =>
	idsFor(names).map((id) => id.replace(/[0-9a-f]{8}/, '#'))

describe('deriveAnimationClipId', () => {
	it('keeps a readable slug of the name', () => {
		expect(shapeOf(['Take 001'])).toEqual(['take-001-#'])
	})

	it('collapses runs of punctuation and trims the edges', () => {
		expect(shapeOf(['  --Idle__Loop!!  '])).toEqual(['idle-loop-#'])
	})

	it('falls back to a bare prefix when a name has no latin alphanumerics', () => {
		expect(shapeOf(['日本語'])).toEqual(['clip-#'])
	})

	it('is deterministic across repeated passes', () => {
		const names = ['Spin', '', 'Spin', 'Idle']
		expect(idsFor(names)).toEqual(idsFor(names))
	})

	describe('identity is independent of position', () => {
		// This is the property the whole reconciliation design rests on. Before it
		// held, a clip's id could silently change meaning when a sibling moved,
		// re-attaching saved settings to the wrong clip while reporting an exact
		// match.
		it('does not change when a clip is inserted before it', () => {
			const [spinAlone] = idsFor(['Spin'])
			const [, spinAfterInsert] = idsFor(['Intro', 'Spin'])

			expect(spinAfterInsert).toBe(spinAlone)
		})

		it('does not change when clips are reordered', () => {
			const [spin, idle] = idsFor(['Spin', 'Idle'])

			expect(idsFor(['Idle', 'Spin'])).toEqual([idle, spin])
		})

		it('holds for non-latin names, which have no usable slug', () => {
			// An entire class of authors gets nothing but the digest, so this is the
			// only thing standing between them and purely positional identity.
			const [rotate, wait] = idsFor(['回転', '待機'])

			expect(idsFor(['新規', '回転', '待機']).slice(1)).toEqual([rotate, wait])
		})

		it('holds for unnamed clips only by position, which is all they have', () => {
			// Two unnamed clips are genuinely indistinguishable; ordinals are the
			// honest answer rather than a defect.
			expect(shapeOf(['', ''])).toEqual(['clip-#', 'clip-#~1'])
		})
	})

	describe('distinct names never share a base', () => {
		it('separates names that slugify identically', () => {
			// `take_001` and `Take 001` both slugify to `take-001`. Separated by
			// digest, so neither depends on which came first in the file.
			const [underscored, spaced] = idsFor(['take_001', 'Take 001'])

			expect(underscored).not.toBe(spaced)
			expect(idsFor(['Take 001', 'take_001'])).toEqual([spaced, underscored])
		})

		it('separates names differing only by case or punctuation', () => {
			const ids = idsFor(['Wave Hand', 'wave-hand', 'WAVE_HAND'])

			expect(new Set(ids).size).toBe(3)
			expect(ids.every((id) => id.startsWith('wave-hand-'))).toBe(true)
		})

		it('separates a name that collides with the unnamed prefix', () => {
			const [named, unnamed] = idsFor(['clip', ''])

			expect(named).not.toBe(unnamed)
		})
	})

	describe('identical names', () => {
		it('disambiguates by order of appearance', () => {
			expect(shapeOf(['Spin', 'Spin', 'Spin'])).toEqual([
				'spin-#',
				'spin-#~1',
				'spin-#~2'
			])
		})

		it('cannot be forged by a name containing the separator', () => {
			// `slugifyClipName` strips `~`, so a clip named `spin~1` lands on its own
			// digest and can never occupy the second `Spin`'s id.
			const [first, second, impostor] = idsFor(['Spin', 'Spin', 'spin~1'])

			expect(impostor).not.toBe(second)
			expect(impostor).not.toBe(first)
		})
	})

	it('slugifies without backtracking on a long run of separators', () => {
		// Clip names come from an uploaded file, so they are untrusted. A quadratic
		// trimming pattern here would be reachable from a crafted glTF.
		const pathological = `${'-'.repeat(100_000)}Spin${'-'.repeat(100_000)}`

		expect(shapeOf([pathological])).toEqual(['spin-#'])
	})
})

describe('describeAnimationClips', () => {
	it('resolves ids, positions and durations in one pass', () => {
		const described = describeAnimationClips([
			{ name: 'Spin', duration: 2 },
			{ name: 'Spin', duration: 3 },
			{ name: '', duration: 0 }
		])

		expect(
			described.map(({ name, index, duration }) => ({ name, index, duration }))
		).toEqual([
			{ name: 'Spin', index: 0, duration: 2 },
			{ name: 'Spin', index: 1, duration: 3 },
			{ name: '', index: 2, duration: 0 }
		])
		expect(described.map((entry) => entry.clipId)).toEqual(
			idsFor(['Spin', 'Spin', ''])
		)
	})

	it('returns an empty list for a model with no clips', () => {
		expect(describeAnimationClips([])).toEqual([])
	})
})
