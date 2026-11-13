// @vitest-environment jsdom
/**
 * The viewer speaks the catalog its locale or the visitor's browser asks for,
 * loaded when first needed, with a host's own words on top.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useResolvedViewerMessages } from './viewer-messages'
import { de } from '../locales/de'
import { en } from '../locales/en'

afterEach(() => vi.unstubAllGlobals())

const resolve = (locale?: string, overrides?: Partial<typeof en>) =>
	renderHook(() => useResolvedViewerMessages(locale, overrides)).result

describe('useResolvedViewerMessages', () => {
	it('speaks English by default', () => {
		vi.stubGlobal('navigator', { language: 'en-US' })
		expect(resolve().current).toBe(en)
	})

	it('loads German for any de tag, in English until it arrives', async () => {
		const result = resolve('de-AT')
		expect(result.current).toBe(en)
		await waitFor(() => expect(result.current).toBe(de))
	})

	it("follows the visitor's browser when the scene names no language", async () => {
		vi.stubGlobal('navigator', { language: 'de-DE' })
		const result = resolve()
		await waitFor(() =>
			expect(result.current.tapToRotate).toBe('Zum Drehen tippen')
		)
	})

	it('stays English for a language with no catalog', () => {
		expect(resolve('fr').current).toBe(en)
	})

	it("puts a host's words over the catalog's", async () => {
		const result = resolve('de', { doneRotating: 'Zurück' })
		await waitFor(() => expect(result.current.tapToRotate).toBe(de.tapToRotate))
		expect(result.current.doneRotating).toBe('Zurück')
	})
})

describe('a catalog once loaded', () => {
	it('is there at once for the next viewer', async () => {
		const first = resolve('de')
		await waitFor(() => expect(first.current).toBe(de))
		expect(resolve('de-CH').current).toBe(de)
	})

	it('keeps the same words while a host passes equal overrides anew', () => {
		const { result, rerender } = renderHook(
			({ overrides }) => useResolvedViewerMessages('en', overrides),
			{ initialProps: { overrides: { doneRotating: 'Back' } } }
		)
		const before = result.current
		rerender({ overrides: { doneRotating: 'Back' } })
		expect(result.current).toBe(before)
	})
})
