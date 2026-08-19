import { assignSequenceIndex, removeHotspot } from './scene-hotspot-edits'

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

describe('removeHotspot', () => {
	it('removes only the named hotspot', () => {
		const result = removeHotspot([hotspot('a'), hotspot('b')], 'a')
		expect(result.map((h) => h.id)).toEqual(['b'])
	})

	it('leaves the list alone when the id is not present', () => {
		const list = [hotspot('a'), hotspot('b')]
		expect(removeHotspot(list, 'gone').map((h) => h.id)).toEqual(['a', 'b'])
	})

	// The deleted hotspot's camera is retired with it, so anything else
	// pointing at that camera would fail server validation on the next save.
	it('clears another hotspot left pointing at the retired camera', () => {
		const result = removeHotspot(
			[
				hotspot('a', { linkedCameraId: 'cam-1' }),
				hotspot('b', { linkedCameraId: 'cam-1' })
			],
			'a'
		)
		expect(result[0].linkedCameraId).toBeUndefined()
	})

	it('leaves unrelated camera links intact', () => {
		const result = removeHotspot(
			[
				hotspot('a', { linkedCameraId: 'cam-1' }),
				hotspot('b', { linkedCameraId: 'cam-2' })
			],
			'a'
		)
		expect(result[0].linkedCameraId).toBe('cam-2')
	})

	it('closes the sequence up, preserving the author order', () => {
		const result = removeHotspot(
			[
				hotspot('a', { sequenceIndex: 0 }),
				hotspot('b', { sequenceIndex: 1 }),
				hotspot('c', { sequenceIndex: 2 })
			],
			'b'
		)
		expect(result.map((h) => [h.id, h.sequenceIndex])).toEqual([
			['a', 0],
			['c', 1]
		])
	})

	it('leaves hotspots outside the sequence outside it', () => {
		const result = removeHotspot(
			[
				hotspot('a', { sequenceIndex: 0 }),
				hotspot('b'),
				hotspot('c', { sequenceIndex: 1 })
			],
			'a'
		)
		const byId = Object.fromEntries(result.map((h) => [h.id, h.sequenceIndex]))
		expect(byId).toEqual({ b: undefined, c: 0 })
	})

	it('produces no duplicate sequence indices, which the server rejects', () => {
		const result = removeHotspot(
			[
				hotspot('a', { sequenceIndex: 5 }),
				hotspot('b', { sequenceIndex: 9 }),
				hotspot('c', { sequenceIndex: 2 })
			],
			'b'
		)
		const indices = result.map((h) => h.sequenceIndex)
		expect(new Set(indices).size).toBe(indices.length)
		expect([...indices].sort()).toEqual([0, 1])
	})

	it('does not mutate the input', () => {
		const list = [
			hotspot('a', { sequenceIndex: 0 }),
			hotspot('b', { sequenceIndex: 1 })
		]
		removeHotspot(list, 'a')
		expect(list.map((h) => h.sequenceIndex)).toEqual([0, 1])
	})
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

	it('never leaves two hotspots on the same index', () => {
		const result = assignSequenceIndex(
			[
				hotspot('a', { sequenceIndex: 0 }),
				hotspot('b', { sequenceIndex: 1 }),
				hotspot('c', { sequenceIndex: 2 })
			],
			'c',
			0
		)
		const indices = result.map((h) => h.sequenceIndex)
		expect(new Set(indices).size).toBe(indices.length)
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

	it('keeps every hotspot in the sequence when one joins it', () => {
		const result = assignSequenceIndex(
			[
				hotspot('a'),
				hotspot('b', { sequenceIndex: 0 }),
				hotspot('c', { sequenceIndex: 1 })
			],
			'a',
			0
		)
		const indices = result.map((h) => h.sequenceIndex)
		expect(indices.every((i) => i !== undefined)).toBe(true)
		expect(new Set(indices).size).toBe(indices.length)
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
