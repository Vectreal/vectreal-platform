import { describe, expect, it } from 'vitest'

import { isViewerChromeVisible } from './overlay-chrome-visibility'

describe('isViewerChromeVisible', () => {
	it('draws no chrome while the scene is still loading', () => {
		// The defect this replaced: the info popover was rendered outside the
		// loader gate, so its `z-[100]` root sat on top of the spinner for the
		// whole load, offering to describe a scene that had not arrived.
		expect(isViewerChromeVisible('loading')).toBe(false)
	})

	it('still draws no chrome during the loader cross-fade', () => {
		// 'loaded' means framed but not settled - the loader is fading out over
		// the model. Chrome here would appear on top of the thing it follows.
		expect(isViewerChromeVisible('loaded')).toBe(false)
	})

	it('draws chrome once the scene is ready', () => {
		expect(isViewerChromeVisible('ready')).toBe(true)
	})
})
