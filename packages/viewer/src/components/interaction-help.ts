import type { ViewerKeys } from './scene/viewer-keys'

/** How the visitor is moving the scene, which decides how a hint is worded. */
export type InteractionInput = 'mouse' | 'touch' | 'keys'

type Action = 'rotate' | 'zoom' | 'pan'

const PHRASES: Record<InteractionInput, Record<Action, string>> = {
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
}

const ACTIONS: Action[] = ['rotate', 'zoom', 'pan']

/**
 * One line naming what the visitor can do with `input`, from the controls
 * that are on: "Drag to rotate, scroll to zoom". Empty when none are.
 */
export function describeInteraction(
	keys: Pick<ViewerKeys, Action>,
	input: InteractionInput
): string {
	const line = ACTIONS.filter((action) => keys[action])
		.map((action) => PHRASES[input][action])
		.join(', ')
	return line && line[0].toUpperCase() + line.slice(1)
}

/** Every input's line, for help a visitor opens rather than one shown to them. */
export function describeHowToMove(
	keys: Pick<ViewerKeys, Action>
): { input: string; text: string }[] {
	const labels: Record<InteractionInput, string> = {
		mouse: 'Mouse',
		touch: 'Touch',
		keys: 'Keyboard'
	}
	return (Object.keys(labels) as InteractionInput[])
		.map((input) => ({
			input: labels[input],
			text: describeInteraction(keys, input)
		}))
		.filter(({ text }) => text)
}
