// @vitest-environment jsdom
/**
 * The footer renders the site map, every link of it, where it says.
 *
 * `tests/site-map.spec.ts` holds the map to the routes and to itself; this
 * holds the footer to the map. A footer that went back to a list of its own
 * would pass the first and fail here.
 */
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('leaving through the footer', () => {
	/*
	  A crossfade is a view transition, which React Router starts only in a
	  data router and only for a link that asks. So this clicks through one and
	  watches for the call, rather than reading a prop no DOM carries.
	*/
	const startViewTransition = vi.fn((update: () => void) => {
		update()
		const done = Promise.resolve()
		return {
			finished: done,
			ready: done,
			updateCallbackDone: done,
			skipTransition: () => undefined
		}
	})

	afterEach(() => {
		startViewTransition.mockClear()
		Reflect.deleteProperty(document, 'startViewTransition')
	})

	function renderFooter() {
		Object.assign(document, { startViewTransition })
		const router = createMemoryRouter([{ path: '*', element: <Footer /> }], {
			initialEntries: ['/about']
		})
		render(<RouterProvider router={router} />)
		return router
	}

	const footerLink = (label: string) =>
		within(screen.getByRole('navigation', { name: 'Site' })).getByRole('link', {
			name: label
		})

	it('crossfades into the publisher', async () => {
		const router = renderFooter()
		fireEvent.click(footerLink('Publisher'))

		await waitFor(() =>
			expect(router.state.location.pathname).toBe('/publisher')
		)
		expect(startViewTransition).toHaveBeenCalledTimes(1)
	})

	it('cuts to a page that is not a funnel', async () => {
		const router = renderFooter()
		fireEvent.click(footerLink('Pricing'))

		await waitFor(() => expect(router.state.location.pathname).toBe('/pricing'))
		expect(startViewTransition).not.toHaveBeenCalled()
	})
})
