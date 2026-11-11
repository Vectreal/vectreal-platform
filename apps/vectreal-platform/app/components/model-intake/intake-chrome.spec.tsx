// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IntakeFooter, IntakeHeader } from './intake-chrome'

const setPreferencesOpen = vi.fn()
vi.mock('../consent/consent-context', () => ({
	useConsent: () => ({ setPreferencesOpen })
}))

function renderAt(entry: string) {
	return render(
		<MemoryRouter initialEntries={[entry]}>
			<IntakeHeader />
			<IntakeFooter />
		</MemoryRouter>
	)
}

afterEach(cleanup)

describe('the letter funnel chrome', () => {
	it('switches the form to English and keeps the letter code and batch', () => {
		renderAt('/free-model?lang=de&c=ABCDEFGH&b=2026-11-13-brands')
		const link = screen.getByRole('link', { name: 'English' })
		const href = new URL(link.getAttribute('href') ?? '', 'https://x.test')
		expect(href.pathname).toBe('/free-model')
		expect(href.searchParams.get('lang')).toBe('en')
		expect(href.searchParams.get('c')).toBe('ABCDEFGH')
		expect(href.searchParams.get('b')).toBe('2026-11-13-brands')
		expect(screen.getByRole('link', { name: 'Impressum' })).toHaveProperty(
			'pathname',
			'/imprint'
		)
		expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveProperty(
			'pathname',
			'/privacy-policy'
		)
	})

	it('names the legal pages in English on the English form', () => {
		renderAt('/free-model')
		expect(screen.getByRole('link', { name: 'Deutsch' })).toBeTruthy()
		expect(screen.getByRole('link', { name: 'Imprint' })).toBeTruthy()
	})

	it('offers no switch on the German-only agency page', () => {
		renderAt('/agenturen?c=ABCDEFGH')
		expect(screen.queryByRole('link', { name: 'English' })).toBeNull()
		expect(screen.getByRole('link', { name: 'Impressum' })).toBeTruthy()
	})

	it('opens the cookie settings from the footer, in the page language', () => {
		renderAt('/agenturen')
		fireEvent.click(
			screen.getByRole('button', { name: 'Cookie-Einstellungen' })
		)
		expect(setPreferencesOpen).toHaveBeenCalledWith(true)
	})
})
