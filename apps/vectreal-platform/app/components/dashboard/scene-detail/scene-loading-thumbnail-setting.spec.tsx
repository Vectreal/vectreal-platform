// @vitest-environment jsdom
/**
 * The dashboard's loading-thumbnail toggle: what it posts, what it shows while
 * a write is in flight and after it lands, and how it fails.
 *
 * The scene route does not re-run its loader for a plain revalidation, so the
 * `presentation` prop stays the pre-write value after a write. The cases below
 * keep it there unless a test is about a newer loader value arriving.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from './scene-loading-thumbnail-setting'

import type { ScenePresentationSettings } from '@vctrl/core'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const fetchMock = vi.fn()

const OFF: ScenePresentationSettings = {
	showLoadingThumbnail: false,
	showInfoPopover: false
}

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })
const isOn = () => toggle().getAttribute('aria-checked') === 'true'

const setting = (
	presentation: ScenePresentationSettings | null = OFF,
	canUpdate = true
) => (
	<SceneLoadingThumbnailSetting
		sceneId="scene-1"
		presentation={presentation}
		canUpdate={canUpdate}
	/>
)

const stored = (presentation: ScenePresentationSettings) =>
	new Response(JSON.stringify({ success: true, data: { presentation } }), {
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
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
	toastError.mockClear()
})

describe('the dashboard loading thumbnail setting', () => {
	it('shows the stored choice', () => {
		render(setting({ showLoadingThumbnail: true }))

		expect(isOn()).toBe(true)
	})

	it('posts only the field it changes, as JSON, with the CSRF token', async () => {
		fetchMock.mockResolvedValue(stored({ ...OFF, showLoadingThumbnail: true }))
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
	})

	it('shows the value being written while the write is in flight', async () => {
		const answer = deferred<Response>()
		fetchMock.mockReturnValue(answer.promise)
		render(setting())

		await click()

		expect(isOn()).toBe(true)
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

	it('shows what the server stored once the write lands', async () => {
		// The answer, not the click, is the truth: here the server kept it off.
		fetchMock.mockResolvedValue(stored(OFF))
		render(setting())

		await click()

		expect(isOn()).toBe(false)
	})

	it('keeps the stored value although the loader still holds the old one', async () => {
		fetchMock.mockResolvedValue(stored({ ...OFF, showLoadingThumbnail: true }))
		render(setting())

		await click()

		expect(isOn()).toBe(true)
	})

	it('falls back to the last stored value, not the stale loader, when a later write fails', async () => {
		fetchMock
			.mockResolvedValueOnce(stored({ ...OFF, showLoadingThumbnail: true }))
			.mockResolvedValueOnce(refused(500, 'Failed to update presentation'))
		render(setting())

		await click()
		await click()

		expect(isOn()).toBe(true)
		expect(toastError).toHaveBeenCalledWith('Failed to update presentation')
	})

	it('lets a write that lands supersede a loader value that arrived mid-write', async () => {
		const answer = deferred<Response>()
		fetchMock.mockReturnValue(answer.promise)
		const view = render(setting())

		await click()
		view.rerender(setting({ ...OFF }))
		await act(async () => {
			answer.resolve(stored({ ...OFF, showLoadingThumbnail: true }))
		})

		expect(isOn()).toBe(true)
	})

	it('gives way to a loader value that arrives after the write', async () => {
		fetchMock.mockResolvedValue(stored({ ...OFF, showLoadingThumbnail: true }))
		const view = render(setting())

		await click()
		view.rerender(setting({ ...OFF }))

		expect(isOn()).toBe(false)
	})

	it('falls back to the stored choice, and says so, when the write is refused', async () => {
		fetchMock.mockResolvedValue(refused(404, 'Scene not found'))
		render(setting())

		await click()

		expect(isOn()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Scene not found')
	})

	it('rolls back rather than throwing when the request never answers', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		render(setting())

		await click()

		expect(isOn()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Failed to fetch')
	})

	it('cannot be changed without scene:update, and says so', () => {
		render(setting(OFF, false))

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
