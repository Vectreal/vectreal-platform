// @vitest-environment jsdom
/**
 * The internal pages are linked only for someone their own gate lets in, so
 * nobody is sent to a page that answers 404, and they say they are internal.
 */
import { SidebarProvider } from '@shared/components/ui/sidebar'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DashboardSidebarContent from './dashboard-sidebar-content'

import type { DashboardInternalPages } from '../../lib/domain/dashboard/dashboard-types'

beforeEach(() => {
	// jsdom has no matchMedia; the sidebar's `useIsMobile` asks it.
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
})

function renderWith(internalPages: DashboardInternalPages) {
	const router = createMemoryRouter([
		{
			path: '/',
			element: (
				<SidebarProvider>
					<DashboardSidebarContent
						actor={{
							id: 'user-1',
							email: 'me@vectreal.com',
							name: 'Moritz',
							avatarUrl: null
						}}
						sidebarProjects={[]}
						plan="free"
						internalPages={internalPages}
					/>
				</SidebarProvider>
			)
		}
	])
	render(<RouterProvider router={router} />)
}

describe('the internal pages in the dashboard sidebar', () => {
	it('links nothing internal for someone neither gate lets in', () => {
		renderWith({ generations: false, intake: false })

		expect(screen.queryByText(/\(internal\)/)).toBeNull()
	})

	it('links each page its gate lets this user open, marked internal', () => {
		renderWith({ generations: true, intake: true })

		expect(
			screen.getByRole('link', { name: 'Go to Generations (internal)' })
		).toHaveAttribute('href', '/dashboard/generations')
		expect(
			screen.getByRole('link', { name: 'Go to Model intake (internal)' })
		).toHaveAttribute('href', '/dashboard/intake')
	})

	it('links only the page that is open to them', () => {
		renderWith({ generations: true, intake: false })

		expect(
			screen.getByRole('link', { name: 'Go to Generations (internal)' })
		).toBeTruthy()
		expect(
			screen.queryByRole('link', { name: 'Go to Model intake (internal)' })
		).toBeNull()
	})
})
