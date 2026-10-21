// @vitest-environment jsdom
/**
 * The docs sidebar, grouped by what the reader is doing.
 *
 * It used to list one reading path that began with repo setup, so the
 * publisher walkthrough read as a step after cloning the repo.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { isDocsPath } from './docs-breadcrumb'
import { DocsTreeNav } from './docs-tree-nav'

describe('the docs sidebar', () => {
	it('puts the walkthrough under artists and repo setup under developers', () => {
		render(
			<MemoryRouter>
				<DocsTreeNav pathname="/docs/getting-started" />
			</MemoryRouter>
		)

		const browser = within(screen.getByRole('region', { name: 'For artists' }))
		const code = within(screen.getByRole('region', { name: 'For developers' }))

		expect(browser.getByRole('link', { name: 'Your First Model' })).toBeTruthy()
		expect(browser.queryByRole('link', { name: 'Installation' })).toBeNull()
		expect(code.getByRole('link', { name: 'Installation' })).toBeTruthy()
		expect(code.getByRole('link', { name: 'Embed SDK' })).toBeTruthy()
	})

	it('marks the current page at the path the prerenderer renders, with a trailing slash', () => {
		render(
			<MemoryRouter>
				<DocsTreeNav pathname="/docs/getting-started/" />
			</MemoryRouter>
		)

		const current = screen.getByRole('link', { current: 'page' })
		expect(current.getAttribute('href')).toBe('/docs/getting-started')
	})
})

describe('isDocsPath', () => {
	it('keeps the landing on the site bar with or without a trailing slash', () => {
		expect(isDocsPath('/docs')).toBe(false)
		expect(isDocsPath('/docs/')).toBe(false)
		expect(isDocsPath('/docs/getting-started')).toBe(true)
		expect(isDocsPath('/docs/getting-started/')).toBe(true)
	})
})
