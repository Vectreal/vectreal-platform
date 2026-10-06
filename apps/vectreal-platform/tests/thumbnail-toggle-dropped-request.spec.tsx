// @vitest-environment jsdom
/**
 * The loading-thumbnail toggle under a real router, with the network gone.
 *
 * The component spec mocks the fetcher, so it cannot show the thing this
 * guards: React Router throws a fetcher request that never got an answer to
 * the route's error boundary, replacing the whole scene page. Routed through a
 * `clientAction` built on `postSceneAction`, as the scene route does, the same
 * failure has to come back as data the switch rolls back from.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from '../app/components/dashboard/scene-detail/scene-loading-thumbnail-setting'
import { postSceneAction } from '../app/lib/domain/scene/client/post-scene-action'

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
			loader: () => ({ presentation: { showLoadingThumbnail: false } }),
			// What the scene route's clientAction does.
			action: async ({ request }) =>
				postSceneAction('scene-1', await request.json()),
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
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		renderScenePage()

		const control = await toggle()
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
	})
})
