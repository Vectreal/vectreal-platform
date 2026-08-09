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

	it('marks the publisher item active from the publisher', () => {
		const publisher = MARKETING_ITEMS.find((i) => i.to === '/publisher')
		expect(publisher).toBeDefined()
		expect(isNavItemActive(publisher!, '/publisher/abc123')).toBe(true)
	})
})
