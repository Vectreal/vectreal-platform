import { describe, expect, it } from 'vitest'

import { isNavItemActive } from './nav-items'

const item = (to: string) => ({ to })

describe('isNavItemActive', () => {
	it('matches home exactly, so it cannot claim every route', () => {
		expect(isNavItemActive(item('/'), '/')).toBe(true)
		expect(isNavItemActive(item('/'), '/home')).toBe(true)
		expect(isNavItemActive(item('/'), '/pricing')).toBe(false)
	})

	it('matches other items by path segment, so nested pages stay highlighted', () => {
		expect(isNavItemActive(item('/docs'), '/docs')).toBe(true)
		expect(isNavItemActive(item('/docs'), '/docs/guides/upload')).toBe(true)
		expect(isNavItemActive(item('/docs'), '/pricing')).toBe(false)
		// A shared prefix is not a shared page.
		expect(isNavItemActive(item('/doc'), '/docs')).toBe(false)
	})

	it('never takes a link with a query for the page it leads into', () => {
		// The pilot opens Contact with a topic; plain Contact must not light the Product panel.
		expect(isNavItemActive(item('/contact?topic=pilot'), '/contact')).toBe(
			false
		)
	})
})
