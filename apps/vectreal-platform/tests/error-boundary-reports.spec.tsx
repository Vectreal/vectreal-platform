// @vitest-environment jsdom
/**
 * The boundaries actually report, rendered rather than grepped.
 *
 * `error-boundary-reporting.spec.ts` is a ratchet over source text: it proves
 * every boundary is wired to the one reporting path. It cannot prove that path
 * runs, and this whole change exists because the product's only
 * `captureException` was wired and unreachable - root's `ErrorBoundary`, which
 * React Router composes as `<Layout><ErrorBoundary/></Layout>`, never rendered
 * because root's `Layout` returns its own fallback without rendering
 * `children`. A grep would have called that code covered.
 *
 * So these render a route that throws, through the real router, and assert an
 * exception left through a real PostHog client interface.
 */

import { PostHogProvider } from '@posthog/react'
import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
	AuthErrorBoundary,
	DashboardErrorBoundary,
	PublicErrorBoundary
} from '../app/components/errors'

import type { PostHog } from 'posthog-js'
import type { ComponentType } from 'react'

function fakePostHog() {
	return { captureException: vi.fn() } as unknown as PostHog & {
		captureException: ReturnType<typeof vi.fn>
	}
}

function renderThrowing(Boundary: ComponentType, error: unknown) {
	const posthog = fakePostHog()
	const Stub = createRoutesStub([
		{
			path: '/dashboard/projects/p1/s1',
			Component: () => {
				throw error
			},
			ErrorBoundary: Boundary
		}
	])

	render(
		<PostHogProvider client={posthog}>
			<Stub initialEntries={['/dashboard/projects/p1/s1']} />
		</PostHogProvider>
	)

	return posthog
}

const BOUNDARIES: [string, ComponentType][] = [
	['DashboardErrorBoundary', DashboardErrorBoundary],
	['PublicErrorBoundary', PublicErrorBoundary],
	['AuthErrorBoundary', AuthErrorBoundary]
]

describe('a rendered boundary reports', () => {
	it.each(BOUNDARIES)('%s captures the error it catches', async (_, Boundary) => {
		const posthog = renderThrowing(Boundary, new Error('render blew up'))

		await waitFor(() => {
			expect(posthog.captureException).toHaveBeenCalledTimes(1)
		})
		expect(posthog.captureException.mock.calls[0][0]).toMatchObject({
			message: 'render blew up'
		})
	})

	it('still renders its fallback', async () => {
		renderThrowing(DashboardErrorBoundary, new Error('render blew up'))
		expect(await screen.findByText('render blew up')).toBeInTheDocument()
	})

	/*
	  The property the alert filters on, produced end to end rather than asserted
	  against `buildErrorReport` in isolation. The route above is on the funnel,
	  so an error there has to arrive tagged as such.
	*/
	it('tags an error on the critical path', async () => {
		const posthog = renderThrowing(DashboardErrorBoundary, new Error('boom'))

		await waitFor(() => expect(posthog.captureException).toHaveBeenCalled())
		expect(posthog.captureException.mock.calls[0][1]).toMatchObject({
			error_source: 'client-boundary',
			on_critical_path: true,
			critical_flows: ['copy-snippet']
		})
	})

	/*
	  A 404 is the product working. Reporting one would bury the real failures
	  under routine traffic, and a boundary that renders "Page Not Found" is the
	  most common boundary render there is.

	  Thrown from a loader rather than from render, because that is the only
	  place it can come from: a `Response` thrown during render stays a
	  `Response`, and it is the data layer that turns one into the
	  `ErrorResponse` the boundary branches on. The first version of this test
	  threw from the component and proved nothing.
	*/
	it('does not report a deliberate 404', async () => {
		const posthog = fakePostHog()
		const Stub = createRoutesStub([
			{
				path: '/',
				loader() {
					throw new Response('nope', { status: 404 })
				},
				Component: () => null,
				ErrorBoundary: DashboardErrorBoundary
			}
		])

		render(
			<PostHogProvider client={posthog}>
				<Stub initialEntries={['/']} />
			</PostHogProvider>
		)

		expect(await screen.findByText('Page Not Found')).toBeInTheDocument()
		expect(posthog.captureException).not.toHaveBeenCalled()
	})

	/*
	  One failure, one event, under StrictMode's double-invoked mount effect.
	  The predecessor called `captureException` during render, which made every
	  re-render another event for the same failure.

	  StrictMode specifically, and not a plain `rerender`: the effect's
	  dependencies are stable across a re-render, so React does not run it again
	  and a re-render proves nothing. The first version of this test did exactly
	  that, and stayed green with the guard deleted. StrictMode is the case the
	  guard exists for - it is commented out in `entry.client.tsx` rather than
	  removed, so re-enabling it must not double the exception feed.
	*/
	it('reports one event when the mount effect is invoked twice', async () => {
		const posthog = fakePostHog()
		const Stub = createRoutesStub([
			{
				path: '/',
				Component: () => {
					throw new Error('render blew up')
				},
				ErrorBoundary: DashboardErrorBoundary
			}
		])

		render(
			<StrictMode>
				<PostHogProvider client={posthog}>
					<Stub initialEntries={['/']} />
				</PostHogProvider>
			</StrictMode>
		)

		await waitFor(() => expect(posthog.captureException).toHaveBeenCalled())
		expect(posthog.captureException).toHaveBeenCalledTimes(1)
	})
})
