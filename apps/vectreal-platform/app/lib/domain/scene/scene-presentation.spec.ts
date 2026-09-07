import { describe, expect, it } from 'vitest'

import {
	normalizePresentationSettings,
	shouldShowInfoPopover
} from './scene-presentation'

describe('normalizePresentationSettings', () => {
	it('keeps an explicit boolean either way', () => {
		expect(normalizePresentationSettings({ showInfoPopover: false })).toEqual({
			showInfoPopover: false
		})
		expect(normalizePresentationSettings({ showInfoPopover: true })).toEqual({
			showInfoPopover: true
		})
	})

	it('drops a non-boolean instead of coercing it', () => {
		// The reason this function exists. `parseSettingsData` writes every
		// unrecognized settings field to its column verbatim, so a client posting
		// the string "false" would otherwise store a truthy value under a name
		// that reads as off.
		expect(
			normalizePresentationSettings({ showInfoPopover: 'false' })
		).toBeUndefined()
		expect(
			normalizePresentationSettings({ showInfoPopover: 0 })
		).toBeUndefined()
	})

	it('drops fields it does not understand', () => {
		expect(
			normalizePresentationSettings({ showInfoPopover: true, injected: 'x' })
		).toEqual({ showInfoPopover: true })
	})

	it('rejects anything that is not a plain object', () => {
		expect(normalizePresentationSettings(undefined)).toBeUndefined()
		expect(normalizePresentationSettings(null)).toBeUndefined()
		expect(normalizePresentationSettings('showInfoPopover')).toBeUndefined()
		expect(
			normalizePresentationSettings([{ showInfoPopover: true }])
		).toBeUndefined()
	})
})

describe('shouldShowInfoPopover', () => {
	it('shows the popover for a scene saved before the column existed', () => {
		// The migration default. These scenes read back undefined and already
		// draw the popover today, so anything else is a silent behavior change
		// on every published scene at once.
		expect(shouldShowInfoPopover(undefined)).toBe(true)
		expect(shouldShowInfoPopover({})).toBe(true)
	})

	it('hides it only when the author said so', () => {
		expect(shouldShowInfoPopover({ showInfoPopover: false })).toBe(false)
		expect(shouldShowInfoPopover({ showInfoPopover: true })).toBe(true)
	})
})
