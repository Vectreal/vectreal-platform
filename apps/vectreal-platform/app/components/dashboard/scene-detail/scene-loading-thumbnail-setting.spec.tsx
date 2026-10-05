// @vitest-environment jsdom
/**
 * The dashboard's loading-thumbnail toggle: what it posts, what it shows while
 * a write and the revalidation after it are in flight, and how it fails.
 *
 * A revalidation is modelled the way the router delivers one: the route
 * re-renders with a new `presentation` object, which may commit after the
 * revalidation promise has already settled.
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

const OFF: ScenePresentationSettings = {
	showLoadingThumbnail: false,
	showInfoPopover: false
}
const ON: ScenePresentationSettings = { ...OFF, showLoadingThumbnail: true }

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })
const isOn = () => toggle().getAttribute('aria-checked') === 'true'

const setting = (
	presentation: ScenePresentationSettings | null = OFF,
	{ canUpdate = true, sceneId = 'scene-1' } = {}
) => (
	<SceneLoadingThumbnailSetting
		sceneId={sceneId}
		presentation={presentation}
		canUpdate={canUpdate}
	/>
)

const saved = () =>
	new Response(JSON.stringify({ success: true, data: { presentation: ON } }), {
		status: 200
	})

const refused = (status: number, error: string) =>
	new Response(JSON.stringify({ success: false, error }), { status })

/** A promise the test settles, to look at the state in between. */
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => (resolve = r))
	return { promise, resolve }
}

const click = () =>
	act(async () => {
		fireEvent.click(toggle())
	})

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
		render(setting(ON))

		expect(isOn()).toBe(true)
	})

	it('posts only the field it changes, as JSON, with the CSRF token, then reads it back', async () => {
		fetchMock.mockResolvedValue(saved())
		render(setting())

		await click()

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
		fetchMock.mockResolvedValue(saved())
		revalidate.mockReturnValue(revalidation.promise)
		const view = render(setting())

		await click()
		expect(isOn()).toBe(true)

		// The router can settle before it commits the revalidated data.
		await act(async () => {
			revalidation.resolve()
		})
		expect(isOn()).toBe(true)

		// And the revalidated data is the truth once it lands, whatever it says.
		view.rerender(setting({ ...OFF }))
		expect(isOn()).toBe(false)
	})

	it('ignores a second change while the first is still being written', async () => {
		const answer = deferred<Response>()
		fetchMock.mockReturnValue(answer.promise)
		render(setting())

		await click()
		await click()

		expect(fetchMock).toHaveBeenCalledOnce()
		expect(isOn()).toBe(true)
	})

	it('falls back to the stored choice, and says so, when the write is refused', async () => {
		fetchMock.mockResolvedValue(refused(404, 'Scene not found'))
		render(setting())

		await click()

		expect(isOn()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Scene not found')
		expect(revalidate).not.toHaveBeenCalled()
	})

	it('rolls back rather than throwing when the request never answers', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		render(setting())

		await click()

		expect(isOn()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Failed to fetch')
	})

	it('does not report a saved change as failed when the revalidation fails', async () => {
		fetchMock.mockResolvedValue(saved())
		revalidate.mockRejectedValue(new Error('aborted'))
		render(setting())

		await click()

		expect(toastError).not.toHaveBeenCalled()
		expect(isOn()).toBe(true)
	})

	it("does not carry one scene's choice onto the next", async () => {
		const answer = deferred<Response>()
		fetchMock.mockReturnValue(answer.promise)
		const view = render(setting())

		await click()
		view.rerender(setting({ ...OFF }, { sceneId: 'scene-2' }))

		expect(isOn()).toBe(false)
	})

	it('cannot be changed without scene:update, and says so', () => {
		render(setting(OFF, { canUpdate: false }))

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"You can't change this setting for this scene."
		)
	})

	it('cannot be changed when the stored choice could not be read, and says so', () => {
		render(setting(null))

		fireEvent.click(toggle())

		expect(fetchMock).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"This setting couldn't be loaded. Reload the page to try again."
		)
		expect(document.body.textContent).not.toContain("You can't change")
	})
})
