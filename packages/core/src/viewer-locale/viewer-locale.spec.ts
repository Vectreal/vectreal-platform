import { describe, expect, it } from 'vitest'

import { matchViewerLocale, normalizeSceneLocale } from './viewer-locale'

describe('matchViewerLocale', () => {
	it('picks a language by its subtag, whatever the region or case', () => {
		expect(matchViewerLocale('de')).toBe('de')
		expect(matchViewerLocale('de-AT')).toBe('de')
		expect(matchViewerLocale('DE-ch')).toBe('de')
		expect(matchViewerLocale('en-GB')).toBe('en')
	})

	it('has nothing for a language without a catalog, or for what is not a tag', () => {
		expect(matchViewerLocale('fr-FR')).toBeUndefined()
		expect(matchViewerLocale('not a tag')).toBeUndefined()
		expect(matchViewerLocale('')).toBeUndefined()
		expect(matchViewerLocale(undefined)).toBeUndefined()
		expect(matchViewerLocale(4)).toBeUndefined()
	})
})

describe('normalizeSceneLocale', () => {
	it('keeps the saved en and de as they are', () => {
		expect(normalizeSceneLocale('en')).toBe('en')
		expect(normalizeSceneLocale('de')).toBe('de')
	})

	it('stores a tag in its canonical form', () => {
		expect(normalizeSceneLocale('de-at')).toBe('de-AT')
		expect(normalizeSceneLocale(' en-gb ')).toBe('en-GB')
	})

	it('drops a language the viewer lacks, and anything that is not a tag', () => {
		expect(normalizeSceneLocale('fr')).toBeUndefined()
		expect(normalizeSceneLocale('de_DE_x')).toBeUndefined()
		expect(normalizeSceneLocale(null)).toBeUndefined()
	})
})
