/**
 * The hint names what the visitor can do, in the words of the input they are
 * using and the viewer's language, and only for the controls that are on.
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
		expect(describeInteraction(ALL, input, 'en')).toBe(line)
	})

	it.each([
		[
			'mouse',
			'Zum Drehen ziehen, zum Zoomen scrollen, zum Verschieben mit rechter Maustaste ziehen'
		],
		[
			'touch',
			'Zum Drehen ziehen, zum Zoomen zwei Finger auf- oder zuziehen, zum Verschieben mit zwei Fingern ziehen'
		],
		[
			'keys',
			'Mit den Pfeiltasten drehen, mit Plus und Minus zoomen, mit Umschalt und Pfeiltasten verschieben'
		]
	] as const)('words it in German for %s', (input, line) => {
		expect(describeInteraction(ALL, input, 'de')).toBe(line)
	})

	it('leaves out what is switched off', () => {
		expect(describeInteraction({ ...NONE, zoom: true }, 'touch', 'en')).toBe(
			'Pinch to zoom'
		)
	})

	it('says nothing when nothing moves', () => {
		expect(describeInteraction(NONE, 'mouse', 'de')).toBe('')
	})
})

describe('describeHowToMove', () => {
	it('gives every input its line', () => {
		const help = describeHowToMove({ ...NONE, rotate: true }, 'en')
		expect(help.heading).toBe('How to move')
		expect(help.lines.map(({ input }) => input)).toEqual([
			'Mouse',
			'Touch',
			'Keyboard'
		])
	})

	it('speaks German for a German scene', () => {
		const help = describeHowToMove({ ...NONE, rotate: true }, 'de')
		expect(help.heading).toBe('Bedienung')
		expect(help.lines).toEqual([
			{ input: 'Maus', text: 'Zum Drehen ziehen' },
			{ input: 'Touch', text: 'Zum Drehen ziehen' },
			{ input: 'Tastatur', text: 'Mit den Pfeiltasten drehen' }
		])
	})

	it('is empty when nothing moves', () => {
		expect(describeHowToMove(NONE, 'en').lines).toEqual([])
	})
})
