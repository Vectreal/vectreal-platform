import {
	applySequenceMove,
	reorderSequence,
	resolveSequenceOrder,
	setSequenceMembership
} from './scene-hotspot-sequence'

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

describe('applySequenceMove', () => {
	const stored = () => [
		hotspot('a', { sequenceIndex: 0 }),
		hotspot('b', { sequenceIndex: 1 }),
		hotspot('c', { sequenceIndex: 2 })
	]

	it('renumbers and reports where the marker landed', () => {
		const move = applySequenceMove(stored(), ['c', 'a', 'b'], 'a')

		expect(move).not.toBeNull()
		expect(indices(move!.hotspots)).toEqual([
			['a', 1],
			['b', 2],
			['c', 0]
		])
		expect(move!.position).toBe(2)
		expect(move!.total).toBe(3)
	})

	/**
	 * A drag released where it began. Applying it is harmless, announcing it is
	 * not: it tells a screen reader something moved when nothing did.
	 */
	it('refuses an order that resolves to the sequence already stored', () => {
		expect(applySequenceMove(stored(), ['a', 'b', 'c'], 'a')).toBeNull()
	})

	/**
	 * The order a drag was holding when the panel went away, against whatever
	 * scene loaded after it. Applying it would clear a sequence nobody touched.
	 */
	it('refuses an order naming no hotspot in the list', () => {
		expect(
			applySequenceMove(stored(), ['gone', 'also-gone'], 'gone')
		).toBeNull()
	})

	/**
	 * The position announced has to come from the order actually assigned, not
	 * from the raw list: a stale id left in would say "position 4 of 4" for a
	 * three-marker sequence.
	 */
	it('counts positions from the order it assigned, not the order it was given', () => {
		const move = applySequenceMove(stored(), ['b', 'ghost', 'c', 'a'], 'a')

		expect(move!.position).toBe(3)
		expect(move!.total).toBe(3)
		expect(indices(move!.hotspots)).toEqual([
			['a', 2],
			['b', 0],
			['c', 1]
		])
	})

	/**
	 * The mirror of leaving, and the case an element-wise comparison gets wrong
	 * without a length check: every stored id still matches by position, so the
	 * order reads as unchanged and the join is refused.
	 */
	it('accepts a marker joining the sequence', () => {
		const list = [hotspot('a', { sequenceIndex: 0 }), hotspot('b')]
		const move = applySequenceMove(list, ['a', 'b'], 'b')

		expect(move).not.toBeNull()
		expect(indices(move!.hotspots)).toEqual([
			['a', 0],
			['b', 1]
		])
		expect(move!.position).toBe(2)
		expect(move!.total).toBe(2)
	})

	it('accepts a marker leaving the sequence', () => {
		const move = applySequenceMove(stored(), ['a', 'b'], 'a')

		expect(indices(move!.hotspots)).toEqual([
			['a', 0],
			['b', 1],
			['c', undefined]
		])
	})

	/**
	 * The marker being dragged, deleted from elsewhere before the drop. The rest
	 * may genuinely have moved, but there is nothing left to announce and the
	 * position would read as zero.
	 */
	it('refuses a move whose own marker is no longer in the order', () => {
		expect(applySequenceMove(stored(), ['c', 'b'], 'a')).toBeNull()
	})

	it('does not mutate the input', () => {
		const list = stored()
		applySequenceMove(list, ['c', 'b', 'a'], 'c')

		expect(indices(list)).toEqual([
			['a', 0],
			['b', 1],
			['c', 2]
		])
	})
})

describe('resolveSequenceOrder', () => {
	it('keeps the ids that name a hotspot, in the order given', () => {
		const list = [hotspot('a'), hotspot('b')]

		expect(resolveSequenceOrder(list, ['b', 'a'])).toEqual(['b', 'a'])
	})

	/**
	 * A drag list can name a hotspot deleted since it was built. Letting it
	 * through inflates every position the panel announces: "position 3 of 3" for
	 * a two-member sequence, alongside a commit that changed nothing.
	 */
	it('drops an id naming no hotspot', () => {
		const list = [hotspot('a'), hotspot('b')]

		expect(resolveSequenceOrder(list, ['a', 'ghost', 'b'])).toEqual(['a', 'b'])
	})

	it('drops a repeated id', () => {
		const list = [hotspot('a'), hotspot('b')]

		expect(resolveSequenceOrder(list, ['a', 'a', 'b'])).toEqual(['a', 'b'])
	})

	/** What `reorderSequence` assigns and what this returns cannot disagree. */
	it('agrees with the indices reorderSequence assigns', () => {
		const list = [hotspot('a'), hotspot('b')]
		const order = ['b', 'ghost', 'a', 'b']

		const assigned = reorderSequence(list, order)
			.filter((h) => h.sequenceIndex !== undefined)
			.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))
			.map((h) => h.id)

		expect(assigned).toEqual(resolveSequenceOrder(list, order))
	})

	/** A stale order naming nothing must not read as a legal empty sequence. */
	it('is empty when no id names a hotspot', () => {
		expect(resolveSequenceOrder([hotspot('a')], ['gone'])).toEqual([])
	})
})
