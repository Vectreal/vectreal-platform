import type { ViewerMessages } from '../locales/en'
import type { ViewerKeys } from './scene/viewer-keys'

/** How the visitor is moving the scene, which decides how a hint is worded. */
export type InteractionInput = 'mouse' | 'touch' | 'keys'

type Action = 'rotate' | 'zoom' | 'pan'

const PHRASES: Record<
	InteractionInput,
	Record<Action, keyof ViewerMessages>
> = {
	mouse: { rotate: 'mouseRotate', zoom: 'mouseZoom', pan: 'mousePan' },
	touch: { rotate: 'touchRotate', zoom: 'touchZoom', pan: 'touchPan' },
	keys: { rotate: 'keysRotate', zoom: 'keysZoom', pan: 'keysPan' }
}

const INPUT_NAMES: Record<InteractionInput, keyof ViewerMessages> = {
	mouse: 'howToMoveMouse',
	touch: 'howToMoveTouch',
	keys: 'howToMoveKeys'
}

const ACTIONS: Action[] = ['rotate', 'zoom', 'pan']

/**
 * One line naming what the visitor can do with `input`, from the controls
 * that are on: "Drag to rotate, scroll to zoom". Empty when none are.
 */
export function describeInteraction(
	keys: Pick<ViewerKeys, Action>,
	input: InteractionInput,
	messages: ViewerMessages
): string {
	const line = ACTIONS.filter((action) => keys[action])
		.map((action) => messages[PHRASES[input][action]])
		.join(', ')
	return line && line[0].toUpperCase() + line.slice(1)
}

/**
 * The "How to move" heading and every input's line, for help a visitor opens
 * rather than one shown to them.
 */
export function describeHowToMove(
	keys: Pick<ViewerKeys, Action>,
	messages: ViewerMessages
): { heading: string; lines: { input: string; text: string }[] } {
	const lines = (Object.keys(INPUT_NAMES) as InteractionInput[])
		.map((input) => ({
			input: messages[INPUT_NAMES[input]],
			text: describeInteraction(keys, input, messages)
		}))
		.filter(({ text }) => text)
	return { heading: messages.howToMove, lines }
}
