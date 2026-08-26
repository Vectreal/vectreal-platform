import { reorderSequence, setSequenceMembership } from './scene-hotspot-sequence'

import type { HotspotDefinition } from '@vctrl/core'

const hotspot = (
	id: string,
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const indices = (hotspots: readonly HotspotDefinition[]) =>
	hotspots.map((h) => [h.id, h.sequenceIndex])

describe('reorderSequence', () => {
	it('numbers the listed hotspots from zero, in the order given', () => {
		const result = reorderSequence(
			[hotspot('a'), hotspot('b'), hotspot('c')],
			['c', 'a']
		)

		expect(indices(result)).toEqual([
			['a', 1],
			['b', undefined],
			['c', 0]
		])
	})

	/**
	 * The list is the order, so a hotspot left out of it is out of the sequence.
	 * Keeping its old index would leave a step no reorder can reach.
	 */
	it('takes an unlisted hotspot out of the sequence', () => {
		const result = reorderSequence(
			[hotspot('a', { sequenceIndex: 0 }), hotspot('b', { sequenceIndex: 1 })],
			['b']
		)

		expect(indices(result)).toEqual([
			['a', undefined],
			['b', 0]
		])
	})

	/**
	 * The gaps this closes are the ones `resolve-hotspot-markers.ts` in the
	 * viewer works around: it ranks rather than printing `sequenceIndex + 1`
	 * precisely because the old swap left scenes holding 0, 1 and 4. Emitting a
	 * dense range removes the cause; the viewer's rank stays as hardening for
	 * consumers that never pass through this panel.
	 */
	it('closes gaps left by the indices it is given', () => {
		const result = reorderSequence(
			[hotspot('a', { sequenceIndex: 3 }), hotspot('b', { sequenceIndex: 7 })],
			['a', 'b']
		)

		expect(indices(result)).toEqual([
			['a', 0],
			['b', 1]
		])
	})

	it('consumes no index for an id naming no hotspot', () => {
		const result = reorderSequence([hotspot('a')], ['ghost', 'a'])

		expect(indices(result)).toEqual([['a', 0]])
	})

	it('consumes no index for a repeated id', () => {
		const result = reorderSequence(
			[hotspot('a'), hotspot('b')],
			['a', 'a', 'b']
		)

		expect(indices(result)).toEqual([
			['a', 0],
			['b', 1]
		])
	})

	/**
	 * `scene-hotspot-comparison.ts` matches by id and does not store list order,
	 * and the panel renders from its own sort. Reordering the array here would
	 * make the return value's shape a second, competing source of order.
	 */
	it('returns the hotspots in the order they arrived', () => {
		const result = reorderSequence([hotspot('b'), hotspot('a')], ['a', 'b'])

		expect(result.map((h) => h.id)).toEqual(['b', 'a'])
	})

	it('leaves a hotspot whose index is already correct untouched by reference', () => {
		const settled = hotspot('a', { sequenceIndex: 0 })
		const result = reorderSequence([settled], ['a'])

		expect(result[0]).toBe(settled)
	})

	it('does not mutate the input', () => {
		const list = [
			hotspot('a', { sequenceIndex: 0 }),
			hotspot('b', { sequenceIndex: 1 })
		]

		reorderSequence(list, ['b', 'a'])

		expect(indices(list)).toEqual([
			['a', 0],
			['b', 1]
		])
	})

	it('is empty for an empty list', () => {
		expect(reorderSequence([], [])).toEqual([])
	})
})

describe('setSequenceMembership', () => {
	it('appends a hotspot to the end of the sequence', () => {
		const result = setSequenceMembership(
			[hotspot('a', { sequenceIndex: 0 }), hotspot('b')],
			'b',
			true
		)

		expect(indices(result)).toEqual([
			['a', 0],
			['b', 1]
		])
	})

	it('closes the gap when a hotspot leaves the sequence', () => {
		const result = setSequenceMembership(
			[
				hotspot('a', { sequenceIndex: 0 }),
				hotspot('b', { sequenceIndex: 1 }),
				hotspot('c', { sequenceIndex: 2 })
			],
			'b',
			false
		)

		expect(indices(result)).toEqual([
			['a', 0],
			['b', undefined],
			['c', 1]
		])
	})

	it('leaves a hotspot that is already a member where it is', () => {
		const result = setSequenceMembership(
			[hotspot('a', { sequenceIndex: 0 }), hotspot('b', { sequenceIndex: 1 })],
			'a',
			true
		)

		expect(indices(result)).toEqual([
			['a', 0],
			['b', 1]
		])
	})

	it('is a no-op for an id naming no hotspot', () => {
		const list = [hotspot('a', { sequenceIndex: 0 })]

		expect(indices(setSequenceMembership(list, 'gone', true))).toEqual([
			['a', 0]
		])
	})
})
