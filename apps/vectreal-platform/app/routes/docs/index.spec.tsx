// @vitest-environment jsdom
/**
 * The docs index: the publisher first, then a bento per path.
 *
 * Its primary action used to be "Start here", which opened repo setup, so a
 * reader who only wanted to try the publisher was sent to clone the repo.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DocsIndexPage from './index'
import { DOC_AUDIENCES, docsPages } from '../../lib/docs/docs-manifest'

const renderPage = () =>
	render(
		<MemoryRouter>
			<DocsIndexPage />
		</MemoryRouter>
	)

const path = (label: string) =>
	within(screen.getByRole('region', { name: label }))

/* The page's bands reveal on scroll. Under reduced motion they render at once and never reach for IntersectionObserver, which jsdom lacks. */
beforeEach(() => {
	vi.stubGlobal('matchMedia', () => ({ matches: true }))
})

describe('the docs index', () => {
	it('opens the publisher from the hero, not repo setup', () => {
		renderPage()

		const link = screen.getByRole('link', { name: 'Open the publisher' })
		expect(link.getAttribute('href')).toBe('/publisher')
	})

	it('opens the publisher with the rocket loading from the artists path', () => {
		renderPage()

		const link = path('For artists').getByRole('link', {
			// The row's size line is part of the name: what opening it costs.
			name: /^Open the rocket sample/
		})
		expect(link.getAttribute('href')).toBe('/publisher?sample=rocket')
		expect(
			path('For developers').queryByRole('link', { name: /rocket/ })
		).toBeNull()
	})

	it('lists every docs page once, on the path its category belongs to', () => {
		renderPage()

		for (const page of docsPages) {
			const audience = DOC_AUDIENCES.find((candidate) =>
				candidate.categories.includes(page.category)
			)
			const href = `/docs/${page.slug}`
			const onPath = path(audience?.label ?? '')
				.getAllByRole('link')
				.filter((link) => link.getAttribute('href') === href)
			const onPage = screen
				.getAllByRole('link')
				.filter((link) => link.getAttribute('href') === href)

			expect(onPath, href).toHaveLength(1)
			expect(onPage, href).toHaveLength(1)
			expect(onPath[0]?.textContent).toBe(page.title)
		}
	})
})
