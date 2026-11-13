import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveViewerLanguage } from './viewer-language'

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
