/**
 * Every word the viewer itself shows or announces, in English: the default
 * and the source of truth. Each other language is a file beside this one
 * typed as `ViewerMessages`, so a key it lacks or misspells fails typecheck.
 *
 * `{name}`-style placeholders are filled by `formatMessage`; a translation
 * keeps them and may move them.
 */
export const en = {
	/** The start button of a scene that waits for a tap, on a touch screen. */
	tapToRotate: 'Tap to rotate',
	/** The same button with a mouse. */
	clickToRotate: 'Click to rotate',
	/** The way back to scrolling once the scene took the touch. */
	doneRotating: 'Done',
	doneRotatingLabel: 'Done rotating, back to scrolling',

	/** The first-time hint and How to move, phrased per input and joined. */
	mouseRotate: 'drag to rotate',
	mouseZoom: 'scroll to zoom',
	mousePan: 'right-drag to pan',
	touchRotate: 'drag to rotate',
	touchZoom: 'pinch to zoom',
	touchPan: 'drag with two fingers to pan',
	keysRotate: 'arrow keys rotate',
	keysZoom: 'plus and minus zoom',
	keysPan: 'Shift and the arrows pan',
	howToMove: 'How to move',
	howToMoveMouse: 'Mouse',
	howToMoveTouch: 'Touch',
	howToMoveKeys: 'Keyboard',

	/** What a screen reader hears after the viewer's name. */
	keyHelpRotate: 'Arrow keys rotate the view.',
	keyHelpPan: 'Shift and arrow keys pan.',
	keyHelpZoom: 'Plus and minus zoom.',
	keyHelpHome: 'Home resets the view.',
	viewerRole: '3D viewer',

	openInfo: 'Open information popover',
	closeInfo: 'Close information popover',

	animationPlayback: 'Animation playback',
	playAnimation: 'Play animation',
	pauseAnimation: 'Pause animation',
	restartAnimation: 'Restart animation',

	enterFullscreen: 'Full screen',
	exitFullscreen: 'Exit full screen',

	cameras: 'Cameras',
	previousCamera: 'Previous camera',
	nextCamera: 'Next camera',
	chooseCamera: 'Camera: {name}. Choose a camera',
	unnamedCamera: 'Unnamed camera',
	hotspotView: 'Hotspot view',

	backToSceneView: 'Back to scene view',
	viewingHotspot: 'Viewing {name}',

	/** A hotspot's name when the author gave it none. */
	hotspot: 'Hotspot',
	hotspotHidden: '{name}, hidden',
	hotspotStep: '{name}, step {step} of {count}',

	renderFailed: "This scene couldn't be shown on this device.",
	tryAgain: 'Try again',

	loadingThumbnailAlt: 'Viewer loading thumbnail'
}

/** The viewer's words in one language; see `en`. */
export type ViewerMessages = { [Key in keyof typeof en]: string }

/** Fills a message's `{name}`-style placeholders. */
export function formatMessage(
	message: string,
	values: Record<string, string | number>
): string {
	return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
		key in values ? String(values[key]) : placeholder
	)
}
