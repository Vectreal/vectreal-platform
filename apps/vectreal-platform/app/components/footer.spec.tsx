// @vitest-environment jsdom
/**
 * The footer renders the site map, every link of it, where it says.
 *
 * `tests/site-map.spec.ts` holds the map to the routes and to itself; this
 * holds the footer to the map. A footer that went back to a list of its own
 * would pass the first and fail here.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Footer } from './footer'
import { FOOTER, type SiteLink } from '../lib/navigation/site-map'

vi.mock('./consent/consent-context', () => ({
	useConsent: () => ({ setPreferencesOpen: vi.fn() })
}))
vi.mock('./theme-toggle-button', () => ({ ThemeToggleButton: () => null }))

describe('the footer', () => {
	it('links every page in the site map, under its one name', () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>
		)
		const site = screen.getByRole('navigation', { name: 'Site' })
		for (const section of FOOTER.sections) {
			for (const link of section.links) {
				const anchors = Array.from(site.querySelectorAll('a')).filter(
					(anchor) => anchor.textContent === link.label
				)
				expect(
					anchors.map((a) => a.getAttribute('href')),
					link.label
				).toContain(link.to)
			}
		}
	})

	it('opens outside links in a new tab', () => {
		render(
			<MemoryRouter>
				<Footer />
			</MemoryRouter>
		)
		const links: readonly SiteLink[] = FOOTER.sections.flatMap(
			(section) => section.links
		)
		const external = links.filter((link) => link.external)
		expect(external.length).toBeGreaterThan(0)
		for (const link of external) {
			const anchor = screen
				.getAllByRole('link', { name: link.label })
				.find((a) => a.getAttribute('href') === link.to)
			expect(anchor?.getAttribute('target'), link.label).toBe('_blank')
		}
	})
})
