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

	it('shows the new choice until the revalidation after the write settles', async () => {
		const revalidation = deferred<void>()
		fetchMock.mockResolvedValue(answer(200, { success: true, data: {} }))
		revalidate.mockReturnValue(revalidation.promise)
		renderSetting()

		await act(async () => {
			fireEvent.click(toggle())
		})
		expect(toggle().getAttribute('aria-checked')).toBe('true')

		await act(async () => {
			revalidation.resolve()
		})
		// The loader in this test never changes, so settled means stored again.
		expect(toggle().getAttribute('aria-checked')).toBe('false')
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

	it('cannot be changed without scene:update', () => {
		renderSetting({ canUpdate: false })

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('cannot be changed when the stored choice could not be read', () => {
		renderSetting({ presentation: null })

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
	})
})
