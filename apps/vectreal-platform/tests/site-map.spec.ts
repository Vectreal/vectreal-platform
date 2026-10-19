/**
 * The site map the nav, the phone drawer and the footer all read.
 *
 * They each used to keep their own list, and the lists drifted: labels that
 * disagreed, a pilot that neither mentioned, a "Sign In" that went to sign-up.
 * These hold the one list to the routes that exist and to itself, so a link to
 * nowhere, a nav destination the footer forgets, or one page under two names
 * fails here instead of in a reader's click.
 */
import { describe, expect, it } from 'vitest'

import { isRoute } from './route-patterns'
import {
	ACCOUNT,
	FOOTER,
	NAV,
	entersFunnel,
	isNavSection,
	type SiteLink
} from '../app/lib/navigation/site-map'

const pathOf = (link: SiteLink) => link.to.split('?')[0]

const navLinks: SiteLink[] = [
	...NAV.items.flatMap((item) => (isNavSection(item) ? item.links : [item]))
]
const navActions: SiteLink[] = [NAV.signIn, NAV.getStarted]
const footerLinks: SiteLink[] = FOOTER.sections.flatMap(
	(section) => section.links
)

describe('the site map', () => {
	it('links only to pages that exist', () => {
		const internal = [
			...navLinks,
			...navActions,
			...footerLinks,
			...ACCOUNT
		].filter((link) => !link.external)
		for (const link of internal)
			expect(isRoute(pathOf(link)), link.to).toBe(true)
	})

	it('keeps every nav destination in the footer', () => {
		const footer = new Set(footerLinks.map((link) => link.to))
		for (const link of navLinks) expect(footer, link.label).toContain(link.to)
	})

	it('names each page once, wherever it is linked', () => {
		const names = new Map<string, Set<string>>()
		for (const link of [...navLinks, ...footerLinks]) {
			const seen = names.get(link.to) ?? new Set()
			names.set(link.to, seen.add(link.label))
		}
		for (const [to, labels] of names) expect([...labels], to).toHaveLength(1)
	})

	it('offers the pilot from the nav', () => {
		expect(navLinks.map((link) => link.to)).toContain('/contact?topic=pilot')
	})

	// The order marketing asked for on 17 Oct 2026: the product first, open source last.
	it('reads product, pricing, newsroom, docs, then open source', () => {
		expect(NAV.items.map((item) => item.label)).toEqual([
			'Product',
			'Pricing',
			'Newsroom',
			'Docs',
			'Open source'
		])
	})

	it('signs in at sign-in, and starts at the publisher', () => {
		expect(NAV.signIn.to).toBe('/sign-in')
		expect(NAV.getStarted.to).toBe('/publisher')
	})
})

describe('which links crossfade into a tool', () => {
	it('takes the publisher and the converters, at any depth or query', () => {
		for (const to of [
			'/publisher',
			'/publisher/3c101785',
			'/publisher?sample=rocket',
			'/convert',
			'/convert/obj-to-glb'
		]) {
			expect(entersFunnel(to), to).toBe(true)
		}
	})

	it('leaves every other page, and a path that only starts the same, as a cut', () => {
		for (const to of ['/pricing', '/docs', '/publishers', '/converter', '/']) {
			expect(entersFunnel(to), to).toBe(false)
		}
	})

	it('leads the nav in from its way in', () => {
		expect(entersFunnel(NAV.getStarted.to)).toBe(true)
	})
})
