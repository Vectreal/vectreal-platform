// @vitest-environment jsdom
/**
 * The dashboard chrome must render the committed route, never the one a
 * navigation is headed toward.
 *
 * `useDashboardHeaderData` used to read `useNavigation().location` while a
 * navigation was in flight and return that destination's header for the page
 * still on screen. `getRouteContext` has no entry for a route outside the
 * dashboard (the publisher, for one) and falls through to `dashboard`, so
 * navigating from a scene toward the publisher briefly replaced the scene's
 * suppressed header with a visible "Overview" header over a page whose body
 * had not changed yet, shifting the whole layout for the length of the
 * navigation.
 *
 * This drives a real `createMemoryRouter` instead of mocking `react-router`,
 * because the defect lives in how the hook reacts to the router's own
 * pending navigation state, which a hook-level mock cannot reproduce
 * faithfully.
 */

import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { useDashboardHeaderData } from './use-dashboard-content'

const PROJECT_ID = '11111111-1111-1111-1111-111111111111'
const SCENE_ID = '22222222-2222-2222-2222-222222222222'

function HeaderProbe() {
	const { title, actionVariant } = useDashboardHeaderData()

	return (
		<div>
			<span data-testid="title">{title}</span>
			<span data-testid="action-variant">{actionVariant ?? 'none'}</span>
		</div>
	)
}

describe('useDashboardHeaderData during a pending navigation', () => {
	it('keeps reporting the committed scene while the publisher is still loading', async () => {
		let settlePublisherLoader: () => void = () => {}
		const publisherLoader = new Promise<null>((resolve) => {
			settlePublisherLoader = () => resolve(null)
		})

		const router = createMemoryRouter(
			[
				{
					path: '/dashboard/projects/:projectId/:sceneId',
					loader: () => ({
						scene: { id: SCENE_ID, name: 'Kitchen Chair', description: null },
						project: { id: PROJECT_ID, name: 'Showroom' },
						folderPath: []
					}),
					Component: HeaderProbe
				},
				{
					/*
					  Unrecognized by `getRouteContext`, exactly as the publisher route
					  is: nothing in the switch matches a `/publisher/*` pathname, so it
					  falls through to the `dashboard` case rather than throwing. The
					  loader never settles here on purpose, which is what keeps
					  `navigation.state` at `loading` for the rest of the test.
					*/
					path: '/publisher/:sceneId',
					loader: () => publisherLoader,
					Component: HeaderProbe
				}
			],
			{ initialEntries: [`/dashboard/projects/${PROJECT_ID}/${SCENE_ID}`] }
		)

		render(<RouterProvider router={router} />)

		expect(await screen.findByTestId('title')).toHaveTextContent(
			'Kitchen Chair'
		)
		expect(screen.getByTestId('action-variant')).toHaveTextContent(
			'scene-detail'
		)

		await act(async () => {
			void router.navigate(`/publisher/${SCENE_ID}`)
		})

		// The publisher's loader is still pending. The header must still read
		// the scene that is actually on screen, not the destination.
		expect(screen.getByTestId('title')).toHaveTextContent('Kitchen Chair')
		expect(screen.getByTestId('action-variant')).toHaveTextContent(
			'scene-detail'
		)

		// Let the navigation settle so it does not leak into another test.
		await act(async () => {
			settlePublisherLoader()
			await publisherLoader
		})
	})
})
