import { assignSequenceIndex } from './scene-hotspot-sequence'

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

describe('assignSequenceIndex', () => {
	it('sets an index nobody holds', () => {
		const result = assignSequenceIndex([hotspot('a')], 'a', 3)
		expect(result[0].sequenceIndex).toBe(3)
	})

	// A duplicate index is a hard 400 on save, naming the number and neither
	// hotspot, so the collision is resolved rather than created.
	it('swaps with the hotspot already holding the index', () => {
		const result = assignSequenceIndex(
			[hotspot('a', { sequenceIndex: 0 }), hotspot('b', { sequenceIndex: 1 })],
			'a',
			1
		)
		expect(result.map((h) => [h.id, h.sequenceIndex])).toEqual([
			['a', 1],
			['b', 0]
		])
	})

	// A hotspot joining the sequence has no slot to hand over. The displaced
	// one must not be dropped out of the sequence to make room, since that
	// silently changes playback.
	it('moves the displaced hotspot to the next free index when the target had none', () => {
		const result = assignSequenceIndex(
			[hotspot('a'), hotspot('b', { sequenceIndex: 1 })],
			'a',
			1
		)
		expect(result.map((h) => [h.id, h.sequenceIndex])).toEqual([
			['a', 1],
			['b', 2]
		])
	})

	it('takes a hotspot out of the sequence without disturbing anyone', () => {
		const result = assignSequenceIndex(
			[hotspot('a', { sequenceIndex: 0 }), hotspot('b', { sequenceIndex: 1 })],
			'a',
			undefined
		)
		expect(result.map((h) => [h.id, h.sequenceIndex])).toEqual([
			['a', undefined],
			['b', 1]
		])
	})

	it('is a no-op when the id is not present', () => {
		const list = [hotspot('a', { sequenceIndex: 0 })]
		expect(assignSequenceIndex(list, 'gone', 4)).toEqual(list)
	})

	it('does not mutate the input', () => {
		const list = [
			hotspot('a', { sequenceIndex: 0 }),
			hotspot('b', { sequenceIndex: 1 })
		]
		assignSequenceIndex(list, 'a', 1)
		expect(list.map((h) => h.sequenceIndex)).toEqual([0, 1])
	})
})
