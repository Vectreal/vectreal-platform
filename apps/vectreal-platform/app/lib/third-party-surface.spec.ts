import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isThirdPartySurface } from './third-party-surface'

describe('isThirdPartySurface', () => {
	it('is true for an external embed', () => {
		expect(
			isThirdPartySurface(
				'/embed/395a09f0-9340-42f2-ac98-03339cf27c9c/bae36111-22da-46a4-85c5-2d9bfdbb8f4f'
			)
		).toBe(true)
	})

	// The embed 404 answers these too, and it renders inside the iframe.
	it.each(['/embed', '/embed/', '/EMBED/a/b/c', '/Embed/p1'])(
		'is true for %s, as the router matches it',
		(pathname) => {
			expect(isThirdPartySurface(pathname)).toBe(true)
		}
	)

	it('is false on marketing and app routes, the internal preview included', () => {
		for (const pathname of [
			'/',
			'/news-room',
			'/pricing',
			'/dashboard',
			'/publisher',
			'/preview/p/s'
		]) {
			expect(isThirdPartySurface(pathname)).toBe(false)
		}
	})

	it('is false for a route that merely starts with the word embed', () => {
		expect(isThirdPartySurface('/docs/packages/embed')).toBe(false)
		expect(isThirdPartySurface('/embedded-analytics')).toBe(false)
	})
})

/*
  The rule does nothing unless its readers use it. The PostHog gate is
  exercised beside the rest of the browser's PostHog setup, in
  `posthog/posthog-browser.spec.ts`.
*/
describe('its readers', () => {
	it('keeps consent UI off a third-party surface', () => {
		const root = readFileSync(
			join(import.meta.dirname, '..', 'root.tsx'),
			'utf8'
		)
		expect(root).toMatch(
			/const consentUiAllowed = !isThirdPartySurface\(pathname\)/
		)
	})
})
