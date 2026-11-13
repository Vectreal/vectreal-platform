// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	resolveViewerLanguage,
	TapToActivateButton,
	TapToDeactivateButton,
	tapToActivateWords
} from './tap-to-activate'

afterEach(() => vi.unstubAllGlobals())

describe('resolveViewerLanguage', () => {
	it("takes the scene's locale over the browser's", () => {
		vi.stubGlobal('navigator', { language: 'en-US' })
		expect(resolveViewerLanguage('de')).toBe('de')
		vi.stubGlobal('navigator', { language: 'de-DE' })
		expect(resolveViewerLanguage('en')).toBe('en')
	})

	it('follows the browser when the scene names none, and English for any language it lacks', () => {
		vi.stubGlobal('navigator', { language: 'de-AT' })
		expect(resolveViewerLanguage(undefined)).toBe('de')
		vi.stubGlobal('navigator', { language: 'fr-FR' })
		expect(resolveViewerLanguage(undefined)).toBe('en')
	})
})

describe('tapToActivateWords', () => {
	it('says tap on a touch screen and click with a mouse, in either language', () => {
		expect(tapToActivateWords('de', 'touch').start).toBe('Zum Drehen tippen')
		expect(tapToActivateWords('en', 'touch').start).toBe('Tap to rotate')
		expect(tapToActivateWords('de', 'mouse').start).toBe('Zum Drehen klicken')
		expect(tapToActivateWords('en', 'mouse').start).toBe('Click to rotate')
	})

	it('names the way back', () => {
		expect(tapToActivateWords('de', 'touch').done).toBe('Fertig')
		expect(tapToActivateWords('en', 'mouse').done).toBe('Done')
	})
})

describe('the buttons', () => {
	it('starts the scene on a press', () => {
		const onActivate = vi.fn()
		render(<TapToActivateButton text="Tap to rotate" onActivate={onActivate} />)
		fireEvent.click(screen.getByRole('button', { name: 'Tap to rotate' }))
		expect(onActivate).toHaveBeenCalledTimes(1)
	})

	it('gives the page its scrolling back, named for a screen reader', () => {
		const onDeactivate = vi.fn()
		render(
			<TapToDeactivateButton
				text="Done"
				label="Done rotating, back to scrolling"
				onDeactivate={onDeactivate}
			/>
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Done rotating, back to scrolling' })
		)
		expect(onDeactivate).toHaveBeenCalledTimes(1)
	})

	it('fades in only where motion is welcome', () => {
		render(<TapToActivateButton text="Tap to rotate" onActivate={vi.fn()} />)
		expect(screen.getByRole('button').parentElement?.className).toContain(
			'vv:motion-reduce:transition-none'
		)
	})
})
