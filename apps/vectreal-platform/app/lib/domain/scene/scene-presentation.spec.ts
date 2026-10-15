import { describe, expect, it } from 'vitest'

import {
	normalizePresentationSettings,
	shouldCompressTexturesForGpu,
	shouldShowInfoPopover,
	shouldShowLoadingThumbnail,
	withCompressTexturesForGpu
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

describe('the loading thumbnail setting', () => {
	it('is kept beside the info popover, each field on its own', () => {
		expect(
			normalizePresentationSettings({
				showInfoPopover: false,
				showLoadingThumbnail: true
			})
		).toEqual({ showInfoPopover: false, showLoadingThumbnail: true })
		expect(
			normalizePresentationSettings({ showLoadingThumbnail: true })
		).toEqual({ showLoadingThumbnail: true })
	})

	it('drops a non-boolean without losing the other field', () => {
		expect(
			normalizePresentationSettings({
				showInfoPopover: true,
				showLoadingThumbnail: 'yes'
			})
		).toEqual({ showInfoPopover: true })
	})

	it('shows the thumbnail only for an author who switched it on', () => {
		expect(shouldShowLoadingThumbnail({ showLoadingThumbnail: true })).toBe(
			true
		)
		expect(shouldShowLoadingThumbnail({ showLoadingThumbnail: false })).toBe(
			false
		)
		expect(shouldShowLoadingThumbnail({})).toBe(false)
		expect(shouldShowLoadingThumbnail(undefined)).toBe(false)
	})
})

describe('the GPU-compressed textures setting', () => {
	it('is kept as a boolean and dropped as anything else', () => {
		expect(
			normalizePresentationSettings({ compressTexturesForGpu: false })
		).toEqual({ compressTexturesForGpu: false })
		expect(
			normalizePresentationSettings({
				showInfoPopover: true,
				compressTexturesForGpu: 'no'
			})
		).toEqual({ showInfoPopover: true })
	})

	it('is on by default, except for a scene on the original preset', () => {
		expect(
			shouldCompressTexturesForGpu(undefined, { isOriginalPreset: false })
		).toBe(true)
		expect(shouldCompressTexturesForGpu({}, { isOriginalPreset: true })).toBe(
			false
		)
	})

	it('follows the author’s explicit choice on any preset', () => {
		for (const isOriginalPreset of [true, false]) {
			expect(
				shouldCompressTexturesForGpu(
					{ compressTexturesForGpu: true },
					{ isOriginalPreset }
				)
			).toBe(true)
			expect(
				shouldCompressTexturesForGpu(
					{ compressTexturesForGpu: false },
					{ isOriginalPreset }
				)
			).toBe(false)
		}
	})

	it('records a choice only where it differs from the default', () => {
		const original = { isOriginalPreset: true }
		const optimizing = { isOriginalPreset: false }

		expect(
			withCompressTexturesForGpu({ showInfoPopover: false }, true, original)
		).toEqual({ showInfoPopover: false, compressTexturesForGpu: true })
		expect(
			withCompressTexturesForGpu(
				{ showInfoPopover: false, compressTexturesForGpu: false },
				true,
				optimizing
			)
		).toEqual({ showInfoPopover: false })
		expect(withCompressTexturesForGpu({}, false, original)).toEqual({})
	})
})
