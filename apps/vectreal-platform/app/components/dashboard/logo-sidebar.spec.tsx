// @vitest-environment jsdom
/**
 * The dashboard sidebar's way out on a phone.
 *
 * On a narrow screen the sidebar is a sheet. The sheet primitive pins its own
 * close to the corner, and the sidebar used to hide it with a child-selector
 * utility, which depends on the button staying a direct child and on the rule
 * reaching the page. Where it did, there was no close at all; where it did not,
 * the corner X landed on the logo row's hover surface and read as removing the
 * logo, offset from the arrow column below it. (The class itself is left
 * unspelled: Tailwind scans these comments and naming it re-emits the rule.)
 *
 * jsdom applies no stylesheet, so a close hidden only by CSS is still in the
 * tree here - which is what makes "exactly one close" a real assertion rather
 * than a restatement of the markup.
 */

import { SidebarProvider, SidebarTrigger } from '@shared/components/ui/sidebar'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LogoSidebar from './logo-sidebar'

function setViewport(width: number) {
	Object.defineProperty(window, 'innerWidth', {
		configurable: true,
		writable: true,
		value: width
	})
	/* jsdom has no matchMedia; the real `useIsMobile` reads `innerWidth` after it. */
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
}

function renderSidebar() {
	return render(
		<MemoryRouter>
			<SidebarProvider>
				<SidebarTrigger />
				<LogoSidebar>
					<nav>Quick Links</nav>
				</LogoSidebar>
			</SidebarProvider>
		</MemoryRouter>
	)
}

const openSheet = () =>
	act(() => {
		fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
	})

const sheet = () =>
	document.querySelector('[data-mobile="true"]') as HTMLElement

beforeEach(() => setViewport(375))
afterEach(() => vi.restoreAllMocks())

describe('on a phone', () => {
	it('has exactly one close, and it sits in the header row', () => {
		renderSidebar()
		openSheet()

		const closes = within(sheet()).getAllByRole('button', { name: /close/i })
		expect(closes).toHaveLength(1)
		expect(closes[0].closest('[data-sidebar="header"]')).not.toBeNull()
	})

	it('closes the sheet', () => {
		renderSidebar()
		openSheet()

		act(() => {
			fireEvent.click(
				within(sheet()).getByRole('button', { name: /close sidebar/i })
			)
		})

		expect(sheet()).toBeNull()
	})
})

describe('on a wide screen', () => {
	it('draws no close, because the sidebar is not an overlay there', () => {
		setViewport(1280)
		renderSidebar()

		expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
	})
})
