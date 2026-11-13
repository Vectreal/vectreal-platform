import type { ViewerKeys } from './scene/viewer-keys'
import type { ViewerLanguage } from './viewer-language'

/** How the visitor is moving the scene, which decides how a hint is worded. */
export type InteractionInput = 'mouse' | 'touch' | 'keys'

type Action = 'rotate' | 'zoom' | 'pan'

const PHRASES: Record<
	ViewerLanguage,
	Record<InteractionInput, Record<Action, string>>
> = {
	en: {
		mouse: {
			rotate: 'drag to rotate',
			zoom: 'scroll to zoom',
			pan: 'right-drag to pan'
		},
		touch: {
			rotate: 'drag to rotate',
			zoom: 'pinch to zoom',
			pan: 'drag with two fingers to pan'
		},
		keys: {
			rotate: 'arrow keys rotate',
			zoom: 'plus and minus zoom',
			pan: 'Shift and the arrows pan'
		}
	},
	de: {
		mouse: {
			rotate: 'zum Drehen ziehen',
			zoom: 'zum Zoomen scrollen',
			pan: 'zum Verschieben mit rechter Maustaste ziehen'
		},
		touch: {
			rotate: 'zum Drehen ziehen',
			zoom: 'zum Zoomen zwei Finger auf- oder zuziehen',
			pan: 'zum Verschieben mit zwei Fingern ziehen'
		},
		keys: {
			rotate: 'mit den Pfeiltasten drehen',
			zoom: 'mit Plus und Minus zoomen',
			pan: 'mit Umschalt und Pfeiltasten verschieben'
		}
	}
}

const HOW_TO_MOVE: Record<
	ViewerLanguage,
	{ heading: string; inputs: Record<InteractionInput, string> }
> = {
	en: {
		heading: 'How to move',
		inputs: { mouse: 'Mouse', touch: 'Touch', keys: 'Keyboard' }
	},
	de: {
		heading: 'Bedienung',
		inputs: { mouse: 'Maus', touch: 'Touch', keys: 'Tastatur' }
	}
}

const ACTIONS: Action[] = ['rotate', 'zoom', 'pan']

/**
 * One line naming what the visitor can do with `input`, from the controls
 * that are on, in `language`: "Drag to rotate, scroll to zoom". Empty when
 * none are.
 */
export function describeInteraction(
	keys: Pick<ViewerKeys, Action>,
	input: InteractionInput,
	language: ViewerLanguage
): string {
	const line = ACTIONS.filter((action) => keys[action])
		.map((action) => PHRASES[language][input][action])
		.join(', ')
	return line && line[0].toUpperCase() + line.slice(1)
}

/**
 * The "How to move" heading and every input's line, for help a visitor opens
 * rather than one shown to them.
 */
export function describeHowToMove(
	keys: Pick<ViewerKeys, Action>,
	language: ViewerLanguage
): { heading: string; lines: { input: string; text: string }[] } {
	const { heading, inputs } = HOW_TO_MOVE[language]
	const lines = (Object.keys(inputs) as InteractionInput[])
		.map((input) => ({
			input: inputs[input],
			text: describeInteraction(keys, input, language)
		}))
		.filter(({ text }) => text)
	return { heading, lines }
}
