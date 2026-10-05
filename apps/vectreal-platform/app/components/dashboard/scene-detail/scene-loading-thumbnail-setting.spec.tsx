// @vitest-environment jsdom
/**
 * The dashboard's loading-thumbnail toggle: what it posts, what it shows while
 * the write and the revalidation after it are in flight, and how it fails.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from './scene-loading-thumbnail-setting'

import type { ScenePresentationSettings } from '@vctrl/core'

const { revalidate, toastError } = vi.hoisted(() => ({
	revalidate: vi.fn(),
	toastError: vi.fn()
}))

vi.mock('react-router', () => ({ useRevalidator: () => ({ revalidate }) }))
vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const fetchMock = vi.fn()

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })

const renderSetting = ({
	presentation = {
		showLoadingThumbnail: false,
		showInfoPopover: false
	} as ScenePresentationSettings | null,
	canUpdate = true
} = {}) =>
	render(
		<SceneLoadingThumbnailSetting
			sceneId="scene-1"
			presentation={presentation}
			canUpdate={canUpdate}
		/>
	)

const answer = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status })

/** A promise the test settles, to look at the state in between. */
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => (resolve = r))
	return { promise, resolve }
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock)
	revalidate.mockResolvedValue(undefined)
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
	revalidate.mockReset()
	toastError.mockClear()
})

describe('the dashboard loading thumbnail setting', () => {
	it('shows the stored choice', () => {
		renderSetting({ presentation: { showLoadingThumbnail: true } })

		expect(toggle().getAttribute('aria-checked')).toBe('true')
	})

	it('posts only the field it changes, as JSON, with the CSRF token', async () => {
		fetchMock.mockResolvedValue(answer(200, { success: true, data: {} }))
		renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})

		expect(fetchMock).toHaveBeenCalledOnce()
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/scenes/scene-1')
		expect(init.method).toBe('POST')
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
		expect(JSON.parse(init.body)).toEqual({
			action: 'update-scene-presentation',
			presentation: { showLoadingThumbnail: true },
			csrf: 'csrf-token'
		})
		expect(revalidate).toHaveBeenCalledOnce()
	})

	it('never flashes the old value between the write and the new loader value', async () => {
		const revalidation = deferred<void>()
		fetchMock.mockResolvedValue(answer(200, { success: true, data: {} }))
		revalidate.mockReturnValue(revalidation.promise)
		const view = renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})
		expect(toggle().getAttribute('aria-checked')).toBe('true')

		// The router can settle before it commits the revalidated data.
		await act(async () => {
			revalidation.resolve()
		})
		expect(toggle().getAttribute('aria-checked')).toBe('true')

		view.rerender(
			<SceneLoadingThumbnailSetting
				sceneId="scene-1"
				presentation={{ showLoadingThumbnail: true }}
				canUpdate
			/>
		)
		expect(toggle().getAttribute('aria-checked')).toBe('true')
	})

	it('lets a newer loader value win over a choice made against an older one', async () => {
		fetchMock.mockResolvedValue(answer(200, { success: true, data: {} }))
		const view = renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})
		view.rerender(
			<SceneLoadingThumbnailSetting
				sceneId="scene-1"
				presentation={{ showLoadingThumbnail: false }}
				canUpdate
			/>
		)

		expect(toggle().getAttribute('aria-checked')).toBe('false')
	})

	it('does not report a saved change as failed when the revalidation fails', async () => {
		fetchMock.mockResolvedValue(answer(200, { success: true, data: {} }))
		revalidate.mockRejectedValue(new Error('aborted'))
		renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})

		expect(toastError).not.toHaveBeenCalled()
		expect(toggle().getAttribute('aria-checked')).toBe('true')
	})

	it('falls back to the stored choice, and says so, when the write is refused', async () => {
		fetchMock.mockResolvedValue(
			answer(404, { success: false, error: 'Scene not found' })
		)
		renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})

		expect(toggle().getAttribute('aria-checked')).toBe('false')
		expect(toastError).toHaveBeenCalledWith('Scene not found')
		expect(revalidate).not.toHaveBeenCalled()
	})

	it('rolls back rather than throwing when the request never answers', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})

		expect(toggle().getAttribute('aria-checked')).toBe('false')
		expect(toastError).toHaveBeenCalledWith('Failed to fetch')
	})

	it('cannot be changed without scene:update, and says so', () => {
		renderSetting({ canUpdate: false })

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"You can't change this setting for this scene."
		)
	})

	it('cannot be changed when the stored choice could not be read, and says so', () => {
		renderSetting({ presentation: null })

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"This setting couldn't be loaded. Reload the page to try again."
		)
		expect(document.body.textContent).not.toContain("You can't change")
	})
})
