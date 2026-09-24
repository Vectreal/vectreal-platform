// @vitest-environment jsdom
/**
 * The site nav, as the layout renders it.
 *
 * Rendered whole rather than piece by piece, because what went wrong before
 * was wiring: a "Sign In" pointed at sign-up, and a nav that read its own list
 * instead of the site map. The bar has to settle when the page scrolls under
 * it, a panel has to open and close the way a disclosure does, and the docs
 * have to get their trail in place of the marketing links.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createRoutesStub, Link } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Navigation } from './index'
import { NAV } from '../../lib/navigation/site-map'

const session = vi.hoisted(() => ({
	user: null as null | { email: string; user_metadata: Record<string, string> }
}))
vi.mock('../../hooks/use-current-user', () => ({
	useCurrentUser: () => ({ user: session.user })
}))
vi.mock('@posthog/react', () => ({ usePostHog: () => null }))
vi.mock('../theme-toggle-button', () => ({ ThemeToggleButton: () => null }))
vi.mock('@shared/components/hooks/use-mobile', () => ({
	useIsMobile: () => false
}))

/** The one observer the nav makes, so a test can say the page scrolled. */
let reportTopInView: ((inView: boolean) => void) | null = null

beforeEach(() => {
	reportTopInView = null
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: IntersectionObserverCallback) {
				reportTopInView = (inView) =>
					callback(
						[{ isIntersecting: inView } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver
					)
			}
			observe() {}
			disconnect() {}
		}
	)
	vi.stubGlobal('matchMedia', () => ({
		matches: true,
		addEventListener() {},
		removeEventListener() {}
	}))
})

afterEach(() => {
	session.user = null
	logoutAction.mockClear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

/** The logout route's action, so a test can see a log out was asked for. */
const logoutAction = vi.fn(() => null)

function renderAt(path: string) {
	const Stub = createRoutesStub([
		{ path: '*', Component: Navigation },
		{ path: '/auth/logout', action: logoutAction }
	])
	return render(<Stub initialEntries={[path]} />)
}

const phoneBar = () =>
	screen
		.getAllByRole('navigation', { name: 'Main navigation' })
		.find((nav) => !nav.className.includes('md:block')) as HTMLElement

const desktopBar = () =>
	screen
		.getAllByRole('navigation', { name: 'Main navigation' })
		.find((nav) => nav.className.includes('md:block')) as HTMLElement

/** Renders the nav, opens a panel by click, and returns a way to take the mouse off the bar. */
function openProduct(label = 'Product') {
	renderAt('/pricing')
	const product = within(desktopBar()).getByRole('button', { name: label })
	fireEvent.click(product)
	const panel = document.getElementById(
		product.getAttribute('aria-controls') as string
	) as HTMLElement
	const leave = async () => {
		fireEvent.pointerLeave(product.parentElement as HTMLElement, {
			pointerType: 'mouse'
		})
		await act(() => new Promise((resolve) => setTimeout(resolve, 300)))
	}
	return { product, panel, leave }
}

const wait = (ms: number) =>
	act(() => new Promise((resolve) => setTimeout(resolve, ms)))

describe('the site nav', () => {
	it('settles onto a surface once the page scrolls under it, and lifts off again at the top', async () => {
		renderAt('/pricing')
		expect(desktopBar().dataset.scrolled).toBeUndefined()

		act(() => reportTopInView?.(false))
		expect(desktopBar().dataset.scrolled).toBe('true')

		act(() => reportTopInView?.(true))
		expect(desktopBar().dataset.scrolled).toBeUndefined()
	})

	it('signs in at sign-in and starts at the publisher', () => {
		renderAt('/pricing')
		const bar = within(desktopBar())
		expect(
			bar.getByRole('link', { name: NAV.signIn.label }).getAttribute('href')
		).toBe('/sign-in')
		expect(
			bar.getByRole('link', { name: NAV.getStarted.label }).getAttribute('href')
		).toBe('/publisher')
	})

	it('opens a panel as a disclosure, and Escape hands focus back', () => {
		renderAt('/pricing')
		const bar = within(desktopBar())
		const product = bar.getByRole('button', { name: 'Product' })
		expect(product.getAttribute('aria-expanded')).toBe('false')

		fireEvent.click(product)
		expect(product.getAttribute('aria-expanded')).toBe('true')
		const panel = document.getElementById(
			product.getAttribute('aria-controls') as string
		) as HTMLElement
		expect(
			within(panel)
				.getByRole('link', { name: /Founding-client pilot/ })
				.getAttribute('href')
		).toBe('/contact?topic=pilot')

		within(panel).getAllByRole('link')[0].focus()
		fireEvent.keyDown(document, { key: 'Escape' })
		expect(product.getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(product)
	})

	it('closes the panel on a navigation that only changes the query', async () => {
		// Navigated from the page rather than the panel, whose own links close it anyway.
		const Stub = createRoutesStub([
			{
				path: '*',
				Component: () => (
					<>
						<Navigation />
						<Link to="/contact?topic=pilot">Pilot, from the page</Link>
					</>
				)
			}
		])
		render(<Stub initialEntries={['/contact']} />)
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.click(product)
		// The pilot is /contact with a topic: the path does not change, the location does.
		await act(async () => {
			fireEvent.click(
				screen.getByRole('link', { name: 'Pilot, from the page' })
			)
		})
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('stays open when focus leaves for nowhere, as a click on a link does in Safari', () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.click(product)
		fireEvent.focusOut(product, { relatedTarget: null })
		expect(product.getAttribute('aria-expanded')).toBe('true')

		fireEvent.focusOut(product, { relatedTarget: document.body })
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('leaves focus where it is when Escape closes a panel it never had', () => {
		renderAt('/contact')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.click(product)
		// A panel open by hover, and the reader typing somewhere else on the page.
		const field = document.body.appendChild(document.createElement('textarea'))
		field.focus()
		fireEvent.keyDown(document, { key: 'Escape' })
		expect(product.getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(field)
		field.remove()
	})

	it('keeps a pressed panel open when the mouse leaves', async () => {
		const { product, leave } = openProduct()
		await leave()
		expect(product.getAttribute('aria-expanded')).toBe('true')
	})

	it('closes a panel the mouse opened when the mouse leaves, whatever has focus', async () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		await wait(150)
		expect(product.getAttribute('aria-expanded')).toBe('true')
		// Focus on the trigger, as a keyboard user's might be, does not make it the keyboard's panel.
		product.focus()
		fireEvent.pointerLeave(product.parentElement as HTMLElement, {
			pointerType: 'mouse'
		})
		await wait(300)
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('opens nothing for a pointer that passes over a trigger', async () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		// Inside the intent delay, so it must not have opened yet.
		await wait(60)
		fireEvent.pointerLeave(product.parentElement as HTMLElement, {
			pointerType: 'mouse'
		})
		expect(product.getAttribute('aria-expanded')).toBe('false')
		await wait(300)
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('does not swap a pressed panel for one the mouse sweeps past', async () => {
		const { product } = openProduct()
		const openSource = within(desktopBar()).getByRole('button', {
			name: 'Open source'
		})
		fireEvent.pointerEnter(openSource, { pointerType: 'mouse' })
		await wait(150)
		expect(product.getAttribute('aria-expanded')).toBe('true')
		expect(openSource.getAttribute('aria-expanded')).toBe('false')
	})

	it('keeps a panel hover just opened open when the same gesture ends in a click', async () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		await wait(150)
		fireEvent.click(product, { detail: 1 })
		expect(product.getAttribute('aria-expanded')).toBe('true')
	})

	it('closes a panel hover opened when the trigger is pressed from the keyboard', async () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		await wait(150)
		// Enter and Space click with no count: a press, not the end of the hover.
		fireEvent.click(product, { detail: 0 })
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('closes on a click after the mouse wandered off into the panel and back', async () => {
		renderAt('/pricing')
		const product = within(desktopBar()).getByRole('button', {
			name: 'Product'
		})
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		// Long past the click that would have finished the hover.
		await wait(900)
		fireEvent.pointerEnter(product, { pointerType: 'mouse' })
		await wait(50)
		fireEvent.click(product, { detail: 1 })
		expect(product.getAttribute('aria-expanded')).toBe('false')
	})

	it('closes when a link in it is followed, and an outside link hands focus back', () => {
		const { product, panel } = openProduct('Open source')
		const github = within(panel).getByRole('link', { name: /GitHub/ })
		github.focus()
		fireEvent.click(github)
		expect(product.getAttribute('aria-expanded')).toBe('false')
		// The page did not change, so focus returns to where the reader was rather than to nowhere.
		expect(document.activeElement).toBe(product)
	})

	it('hands focus back when a link in it opens in a new tab', () => {
		const { product, panel } = openProduct()
		const publisher = within(panel).getByRole('link', { name: /Publisher/ })
		publisher.focus()
		fireEvent.click(publisher, { metaKey: true })
		expect(product.getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(product)
	})

	it('hands focus back when a link in it is middle-clicked', () => {
		const { product, panel } = openProduct()
		const publisher = within(panel).getByRole('link', { name: /Publisher/ })
		publisher.focus()
		fireEvent(
			publisher,
			new MouseEvent('auxclick', { bubbles: true, button: 1 })
		)
		expect(product.getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(product)
	})

	it('treats the docs landing as a page, not a docs page', () => {
		// The landing sits outside the docs layout: no rail, no trail, so the bar keeps its links.
		renderAt('/docs')
		const bar = within(desktopBar())
		expect(
			bar.queryByRole('navigation', { name: 'Docs breadcrumb' })
		).toBeNull()
		expect(
			bar.getByRole('link', { name: 'Docs' }).getAttribute('aria-current')
		).toBe('page')
	})

	it('shows the docs trail in place of the marketing links on a docs page', () => {
		renderAt('/docs/guides/upload')
		const bar = within(desktopBar())
		expect(
			bar.getByRole('navigation', { name: 'Docs breadcrumb' })
		).toBeTruthy()
		expect(bar.queryByRole('link', { name: 'Pricing' })).toBeNull()
	})

	it('names the page on the phone bar rather than drawing a second menu button', () => {
		renderAt('/docs/guides/upload')
		const picker = within(phoneBar()).getByRole('button', {
			name: /Docs pages, current:/
		})
		expect(picker.textContent).toContain('Uploading Models')
		// Only the site menu's button may carry a menu icon.
		expect(phoneBar().querySelectorAll('.lucide-menu')).toHaveLength(1)
	})

	it('gives a signed-out phone one menu, with the way in inside it', () => {
		renderAt('/pricing')
		const bar = within(phoneBar())
		expect(bar.queryByRole('link', { name: NAV.signIn.label })).toBeNull()
		fireEvent.click(bar.getByRole('button', { name: 'Open menu' }))
		const drawer = within(screen.getByRole('dialog'))
		expect(
			drawer.getByRole('link', { name: NAV.signIn.label }).getAttribute('href')
		).toBe('/sign-in')
		expect(
			drawer.getByRole('link', { name: NAV.getStarted.label })
		).toBeTruthy()
	})

	it('makes the avatar the signed-in phone menu, with the account inside it', async () => {
		session.user = {
			email: 'ada@example.com',
			user_metadata: { full_name: 'Ada Lovelace' }
		}
		renderAt('/pricing')
		const bar = within(phoneBar())
		// One control: no account dropdown beside a site menu.
		expect(bar.queryByRole('button', { name: 'Open user menu' })).toBeNull()
		expect(bar.getAllByRole('button')).toHaveLength(1)
		expect(phoneBar().querySelectorAll('.lucide-menu')).toHaveLength(0)
		const trigger = bar.getByRole('button', { name: 'Open menu and account' })
		// The avatar, showing the initial while no picture has loaded.
		expect(within(trigger).getByText('A')).toBeTruthy()
		fireEvent.click(trigger)
		const drawer = within(screen.getByRole('dialog'))
		expect(drawer.getByText('Ada')).toBeTruthy()
		expect(
			drawer.getByRole('link', { name: 'Settings' }).getAttribute('href')
		).toBe('/dashboard/settings')
		expect(drawer.queryByRole('link', { name: NAV.signIn.label })).toBeNull()

		fireEvent.click(drawer.getByRole('button', { name: 'Log out' }))
		expect(screen.queryByRole('dialog')).toBeNull()
		await vi.waitFor(() => expect(logoutAction).toHaveBeenCalledOnce())
	})

	it('shows the marketing links everywhere else', () => {
		renderAt('/pricing')
		const bar = within(desktopBar())
		expect(
			bar.queryByRole('navigation', { name: 'Docs breadcrumb' })
		).toBeNull()
		expect(bar.getByRole('link', { name: 'Pricing' })).toBeTruthy()
	})
})
