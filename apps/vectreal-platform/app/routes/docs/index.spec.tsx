// @vitest-environment jsdom
/**
 * The docs index: the publisher first, then two doors.
 *
 * Its primary action used to be "Start here", which opened repo setup, so a
 * reader who only wanted to try the publisher was sent to clone the repo.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import DocsIndexPage from './index'
import { DOC_AUDIENCES, docsPages } from '../../lib/docs/docs-manifest'

const renderPage = () =>
	render(
		<MemoryRouter>
			<DocsIndexPage />
		</MemoryRouter>
	)

const door = (label: string) =>
	within(screen.getByRole('region', { name: label }))

describe('the docs index', () => {
	it('opens the publisher from the hero, not repo setup', () => {
		renderPage()

		const link = screen.getByRole('link', { name: 'Open the publisher' })
		expect(link.getAttribute('href')).toBe('/publisher')
	})

	it('opens the publisher with the rocket loading from the browser door', () => {
		renderPage()

		const link = door('In the browser').getByRole('link', {
			name: 'Open the publisher with the rocket sample'
		})
		expect(link.getAttribute('href')).toBe('/publisher?sample=rocket')
		expect(
			door('In your code').queryByRole('link', { name: /rocket/ })
		).toBeNull()
	})

	it('lists every docs page once, behind the door its category belongs to', () => {
		renderPage()

		for (const page of docsPages) {
			const audience = DOC_AUDIENCES.find((candidate) =>
				candidate.categories.includes(page.category)
			)
			const href = `/docs/${page.slug}`
			const inDoor = door(audience?.label ?? '')
				.getAllByRole('link')
				.filter((link) => link.getAttribute('href') === href)
			const onPage = screen
				.getAllByRole('link')
				.filter((link) => link.getAttribute('href') === href)

			expect(inDoor, href).toHaveLength(1)
			expect(onPage, href).toHaveLength(1)
			expect(inDoor[0]?.textContent).toBe(page.title)
		}
	})
})
