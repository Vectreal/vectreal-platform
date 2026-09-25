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

import { DocsTreeNav } from './docs-tree-nav'

describe('the docs sidebar', () => {
	it('puts the walkthrough under the browser and repo setup under the code', () => {
		render(
			<MemoryRouter>
				<DocsTreeNav pathname="/docs/getting-started" />
			</MemoryRouter>
		)

		const browser = within(
			screen.getByRole('region', { name: 'In the browser' })
		)
		const code = within(screen.getByRole('region', { name: 'In your code' }))

		expect(browser.getByRole('link', { name: 'Your First Model' })).toBeTruthy()
		expect(browser.queryByRole('link', { name: 'Installation' })).toBeNull()
		expect(code.getByRole('link', { name: 'Installation' })).toBeTruthy()
		expect(code.getByRole('link', { name: 'Embed SDK' })).toBeTruthy()
	})
})
