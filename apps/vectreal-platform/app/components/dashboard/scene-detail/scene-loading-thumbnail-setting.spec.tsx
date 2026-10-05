// @vitest-environment jsdom
/**
 * The dashboard's loading-thumbnail toggle: what it posts, what it shows while
 * the write and the revalidation after it are in flight, and how it fails.
 *
 * The fetcher is mocked as the router drives it: `submitting` for the write,
 * `loading` for the revalidation the POST triggers, and `idle` once the
 * revalidated loader data has been committed alongside it.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from './scene-loading-thumbnail-setting'

import type { ScenePresentationSettings } from '@vctrl/core'

const { fetcher, fetcherKeys, toastError } = vi.hoisted(() => ({
	fetcher: {
		state: 'idle' as string,
		json: undefined as unknown,
		data: undefined as unknown,
		submit: vi.fn()
	},
	fetcherKeys: [] as Array<string | undefined>,
	toastError: vi.fn()
}))

vi.mock('react-router', () => ({
	useFetcher: (options?: { key?: string }) => {
		fetcherKeys.push(options?.key)
		return fetcher
	}
}))
vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const OFF: ScenePresentationSettings = {
	showLoadingThumbnail: false,
	showInfoPopover: false
}

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })
const isOn = () => toggle().getAttribute('aria-checked') === 'true'

const renderSetting = (
	presentation: ScenePresentationSettings | null = OFF,
	canUpdate = true
) =>
	render(
		<SceneLoadingThumbnailSetting
			sceneId="scene-1"
			presentation={presentation}
			canUpdate={canUpdate}
		/>
	)

const writingOn = (state: 'submitting' | 'loading') => {
	fetcher.state = state
	fetcher.json = { presentation: { showLoadingThumbnail: true } }
}

beforeEach(() => {
	fetcher.state = 'idle'
	fetcher.json = undefined
	fetcher.data = undefined
	fetcher.submit.mockClear()
	fetcherKeys.length = 0
	toastError.mockClear()
})

describe('the dashboard loading thumbnail setting', () => {
	it('shows the stored choice', () => {
		renderSetting({ showLoadingThumbnail: true })

		expect(isOn()).toBe(true)
	})

	it('posts only the field it changes, as JSON, with the CSRF token', () => {
		renderSetting()

		fireEvent.click(toggle())

		expect(fetcher.submit).toHaveBeenCalledWith(
			{
				action: 'update-scene-presentation',
				presentation: { showLoadingThumbnail: true },
				csrf: 'csrf-token'
			},
			{
				method: 'POST',
				encType: 'application/json',
				action: '/api/scenes/scene-1'
			}
		)
	})

	it('keeps one fetcher per scene, so a write never shows on another scene', () => {
		renderSetting()

		expect(fetcherKeys.at(-1)).toBe('scene-presentation:scene-1')
	})

	it('shows the value being written while the request is in flight', () => {
		writingOn('submitting')

		renderSetting()

		expect(isOn()).toBe(true)
	})

	it('keeps showing it through the revalidation the write triggers', () => {
		writingOn('loading')

		renderSetting()

		expect(isOn()).toBe(true)
	})

	it('ignores a second change while the first is still being written', () => {
		writingOn('submitting')
		renderSetting()

		fireEvent.click(toggle())

		expect(fetcher.submit).not.toHaveBeenCalled()
	})

	it('falls back to the stored choice, and says so, when the write is refused', () => {
		fetcher.json = { presentation: { showLoadingThumbnail: true } }
		fetcher.data = { success: false, error: 'Scene not found' }

		renderSetting()

		expect(isOn()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Scene not found')
	})

	it('cannot be changed without scene:update, and says so', () => {
		renderSetting(OFF, false)

		fireEvent.click(toggle())

		expect(fetcher.submit).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"You can't change this setting for this scene."
		)
	})

	it('cannot be changed when the stored choice could not be read, and says so', () => {
		renderSetting(null)

		fireEvent.click(toggle())

		expect(fetcher.submit).not.toHaveBeenCalled()
		expect(document.body.textContent).toContain(
			"This setting couldn't be loaded. Reload the page to try again."
		)
		expect(document.body.textContent).not.toContain("You can't change")
	})
})
