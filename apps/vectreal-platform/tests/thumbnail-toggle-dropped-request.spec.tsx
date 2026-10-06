// @vitest-environment jsdom
/**
 * The loading-thumbnail toggle under a real router, with the network gone.
 *
 * The component spec mocks the fetcher, so it cannot show the thing this
 * guards. Offline, two requests fail, and either one replaces the whole scene
 * page with its error boundary: the write, which React Router throws when it
 * never gets an answer, and the loader reload that follows any POST. The
 * route here is built from the real pieces (`forwardSceneAction` as its
 * action, `shouldRevalidateForRouteParams` as its reload rule) and a loader
 * that really fetches, so both failures are live.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from '../app/components/dashboard/scene-detail/scene-loading-thumbnail-setting'
import { forwardSceneAction } from '../app/lib/domain/scene/client/post-scene-action'
import { shouldRevalidateForRouteParams } from '../app/lib/navigation/dashboard-route-behavior'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const fetchMock = vi.fn()

function renderScenePage() {
	const Stub = createRoutesStub([
		{
			path: '/scene',
			loader: async () => {
				await fetch('/scene.data')
				return { presentation: { showLoadingThumbnail: false } }
			},
			action: async ({ request }) =>
				forwardSceneAction('scene-1', await request.json()),
			shouldRevalidate: ({
				formMethod,
				actionResult,
				actionStatus,
				defaultShouldRevalidate
			}) =>
				shouldRevalidateForRouteParams({
					currentParams: {},
					nextParams: {},
					paramKeys: [],
					formMethod,
					actionResult,
					actionStatus,
					defaultShouldRevalidate
				}),
			Component: () => (
				<SceneLoadingThumbnailSetting
					sceneId="scene-1"
					presentation={{ showLoadingThumbnail: false }}
					canUpdate
				/>
			),
			ErrorBoundary: () => <p>The page error screen</p>
		}
	])

	render(<Stub initialEntries={['/scene']} />)
}

const toggle = () =>
	screen.findByRole('switch', { name: /show thumbnail while loading/i })

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
	toastError.mockClear()
})

describe('the loading thumbnail toggle, when the request is dropped', () => {
	it('rolls back with a toast and keeps the page', async () => {
		fetchMock.mockResolvedValue(new Response('{}'))
		renderScenePage()
		const control = await toggle()
		// The network goes away after the page has loaded.
		fetchMock.mockReset()
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

		await act(async () => {
			fireEvent.click(control)
		})

		await vi.waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				'Could not reach the server. Try again.'
			)
		)
		expect(screen.queryByText('The page error screen')).toBeNull()
		expect((await toggle()).getAttribute('aria-checked')).toBe('false')
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/scenes/scene-1',
			expect.objectContaining({ method: 'POST' })
		)
		// Nothing tried to reload after the refused write.
		expect(fetchMock).not.toHaveBeenCalledWith('/scene.data')
	})

	it('still reloads the page data after a write that succeeds', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url === '/scene.data'
				? new Response('{}')
				: new Response(
						JSON.stringify({ success: true, data: { presentation: {} } })
					)
		)
		renderScenePage()
		const control = await toggle()
		fetchMock.mockClear()

		await act(async () => {
			fireEvent.click(control)
		})

		await vi.waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith('/scene.data')
		)
		expect(toastError).not.toHaveBeenCalled()
	})
})
