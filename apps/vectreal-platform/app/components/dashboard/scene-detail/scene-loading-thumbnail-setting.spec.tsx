// @vitest-environment jsdom
/**
 * The dashboard's loading-thumbnail toggle: what it posts, and what it shows
 * while the post and the revalidation after it are in flight.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneLoadingThumbnailSetting } from './scene-loading-thumbnail-setting'

const { fetcher, toastError } = vi.hoisted(() => ({
	fetcher: {
		state: 'idle' as string,
		json: undefined as unknown,
		data: undefined as unknown,
		submit: vi.fn()
	},
	toastError: vi.fn()
}))

vi.mock('react-router', () => ({ useFetcher: () => fetcher }))
vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const toggle = () =>
	screen.getByRole('switch', { name: /show thumbnail while loading/i })

const renderSetting = ({
	showLoadingThumbnail = false,
	canUpdate = true
} = {}) =>
	render(
		<SceneLoadingThumbnailSetting
			sceneId="scene-1"
			presentation={{ showLoadingThumbnail, showInfoPopover: false }}
			canUpdate={canUpdate}
		/>
	)

beforeEach(() => {
	fetcher.state = 'idle'
	fetcher.json = undefined
	fetcher.data = undefined
	fetcher.submit.mockClear()
	toastError.mockClear()
})

describe('the dashboard loading thumbnail setting', () => {
	it('shows the stored choice', () => {
		renderSetting({ showLoadingThumbnail: true })

		expect(toggle().getAttribute('aria-checked')).toBe('true')
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

	it('shows the new choice while the request is in flight', () => {
		fetcher.state = 'submitting'
		fetcher.json = { presentation: { showLoadingThumbnail: true } }

		renderSetting({ showLoadingThumbnail: false })

		expect(toggle().getAttribute('aria-checked')).toBe('true')
	})

	it('falls back to the stored choice, and says so, when the write fails', () => {
		fetcher.json = { presentation: { showLoadingThumbnail: true } }
		fetcher.data = { success: false, error: 'Scene not found' }

		renderSetting({ showLoadingThumbnail: false })

		expect(toggle().getAttribute('aria-checked')).toBe('false')
		expect(toastError).toHaveBeenCalledWith('Scene not found')
	})

	it('cannot be changed without scene:update', () => {
		renderSetting({ canUpdate: false })

		fireEvent.click(toggle())

		expect(fetcher.submit).not.toHaveBeenCalled()
	})
})
