import { describe, expect, it } from 'vitest'

import { isNavItemActive, MARKETING_ITEMS } from './nav-items'

import type { NavItem } from './types'

const item = (to: string): NavItem => ({ label: to, to, icon: null })

describe('isNavItemActive', () => {
	it('matches home exactly, so it cannot claim every route', () => {
		expect(isNavItemActive(item('/'), '/')).toBe(true)
		expect(isNavItemActive(item('/'), '/home')).toBe(true)
		expect(isNavItemActive(item('/'), '/pricing')).toBe(false)
	})

	it('matches other items by prefix, so nested pages stay highlighted', () => {
		expect(isNavItemActive(item('/docs'), '/docs')).toBe(true)
		expect(isNavItemActive(item('/docs'), '/docs/guides/upload')).toBe(true)
		expect(isNavItemActive(item('/docs'), '/pricing')).toBe(false)
	})

	it('carries only marketing destinations', () => {
		/*
		  The publisher used to sit here, and it is the application rather than a
		  page about the product. This asserts the boundary rather than the
		  absence of one route, so adding the next tool to the site nav fails
		  here too.
		*/
		const MARKETING_ROUTES = ['/pricing', '/docs', '/news-room', '/contact']

		expect(MARKETING_ITEMS.map((navItem) => navItem.to).sort()).toEqual(
			[...MARKETING_ROUTES].sort()
		)
	})
})
