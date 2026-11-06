/**
 * The hint names what the visitor can do, in the words of the input they are
 * using, and only for the controls that are on.
 */
import { describe, expect, it } from 'vitest'

import { describeHowToMove, describeInteraction } from './interaction-help'

const ALL = { rotate: true, zoom: true, pan: true }
const NONE = { rotate: false, zoom: false, pan: false }

describe('describeInteraction', () => {
	it.each([
		['mouse', 'Drag to rotate, scroll to zoom, right-drag to pan'],
		['touch', 'Drag to rotate, pinch to zoom, drag with two fingers to pan'],
		['keys', 'Arrow keys rotate, plus and minus zoom, Shift and the arrows pan']
	] as const)('words it for %s', (input, line) => {
		expect(describeInteraction(ALL, input)).toBe(line)
	})

	it('leaves out what is switched off', () => {
		expect(describeInteraction({ ...NONE, zoom: true }, 'touch')).toBe(
			'Pinch to zoom'
		)
	})

	it('says nothing when nothing moves', () => {
		expect(describeInteraction(NONE, 'mouse')).toBe('')
	})
})

describe('describeHowToMove', () => {
	it('gives every input its line', () => {
		expect(
			describeHowToMove({ ...NONE, rotate: true }).map(({ input }) => input)
		).toEqual(['Mouse', 'Touch', 'Keyboard'])
	})

	it('is empty when nothing moves', () => {
		expect(describeHowToMove(NONE)).toEqual([])
	})
})
