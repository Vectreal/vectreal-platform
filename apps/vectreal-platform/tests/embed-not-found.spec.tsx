// @vitest-environment jsdom
/**
 * What a malformed embed URL shows, rendered through the real router.
 *
 * Its loader always throws, so the boundary is the only thing a visitor ever
 * sees, and it renders inside a customer's iframe. A link there would load the
 * marketing site into somebody else's page, which is what the site-wide 404
 * would do if it were swapped in.
 */
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
	ErrorBoundary,
	loader,
	meta
} from '../app/routes/embed-page/embed-not-found'

describe('the embed not-found route', () => {
	it('shows a message with nowhere to navigate', async () => {
		const Stub = createRoutesStub([
			{
				path: '/embed/*',
				loader,
				Component: () => null,
				ErrorBoundary
			}
		])
		const { container } = render(<Stub initialEntries={['/embed/p1']} />)

		expect(await screen.findByText('This embed is not available')).toBeTruthy()
		expect(container.querySelectorAll('a, button')).toHaveLength(0)
	})

	it('keeps itself out of the index', () => {
		expect(JSON.stringify(meta())).toContain('noindex, nofollow')
	})
})
