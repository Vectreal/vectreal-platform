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
import { createRoutesStub, Outlet } from 'react-router'
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
			/*
			  A parent with no reload rule of its own, on React Router's default:
			  only the refusal's failing status keeps it from reloading.
			*/
			id: 'parent',
			path: '/',
			loader: async () => {
				await fetch('/parent.data')
				return null
			},
			Component: Outlet,
			ErrorBoundary: () => <p>The page error screen</p>,
			children: [
				{
					path: 'scene',
					loader: async () => {
						await fetch('/scene.data')
						return { presentation: { showLoadingThumbnail: false } }
					},
					action: async ({ request }) =>
						forwardSceneAction('scene-1', await request.json()),
					shouldRevalidate: ({
						formMethod,
						actionResult,
						defaultShouldRevalidate
					}) =>
						shouldRevalidateForRouteParams({
							currentParams: {},
							nextParams: {},
							paramKeys: [],
							formMethod,
							actionResult,
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
			]
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
		// Nothing tried to reload after the unreachable write.
		expect(fetchMock).not.toHaveBeenCalledWith('/scene.data')
		expect(fetchMock).not.toHaveBeenCalledWith('/parent.data')
	})

	it('still reloads after a refusal the server gave, which can carry a sign-in redirect', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url.endsWith('.data')
				? new Response('{}')
				: new Response(
						JSON.stringify({ success: false, error: 'Unauthorized' }),
						{ status: 401 }
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
		expect(toastError).toHaveBeenCalledWith('Unauthorized')
		// The refusal kept its 401, so a route on React Router's default skips
		// its reload, exactly as when the fetcher posted to the API directly.
		expect(fetchMock).not.toHaveBeenCalledWith('/parent.data')
		expect((await toggle()).getAttribute('aria-checked')).toBe('false')
	})

	it('still reloads the page data after a write that succeeds', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url.endsWith('.data')
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
