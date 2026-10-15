// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ExampleScene } from './example-scene'

const capture = vi.fn()
vi.mock('@posthog/react', () => ({ usePostHog: () => ({ capture }) }))
vi.mock('../consent/consent-context', () => ({
	useConsent: () => ({ consent: { analytics: true } })
}))
/* The real chunk is three.js and a WebGL canvas; what matters here is when it is asked for. */
vi.mock('./example-scene-client', () => ({
	default: () => <div data-testid="viewer" />
}))

function renderScene(id = 'camera-shadows') {
	const Stub = createRoutesStub([
		{
			path: '/news-room/article',
			Component: () => <ExampleScene id={id} caption="Both shadows on." />
		},
		{ path: '/publisher', Component: () => <p>publisher</p> }
	])
	render(<Stub initialEntries={['/news-room/article']} />)
}

describe('ExampleScene', () => {
	it('starts as a picture, and loads the viewer only when asked', async () => {
		renderScene()
		expect(screen.queryByTestId('viewer')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /load 3d scene/i }))

		expect(await screen.findByTestId('viewer')).toBeTruthy()
		expect(capture).toHaveBeenCalledWith('example_scene_activated', {
			example: 'camera-shadows',
			path: '/news-room/article'
		})
	})

	it('moves focus to the scene once the button it replaced is gone', async () => {
		renderScene()
		const button = screen.getByRole('button', { name: /load 3d scene/i })
		button.focus()
		fireEvent.click(button)

		await screen.findByTestId('viewer')
		const frame = screen.getByRole('group', {
			name: /camera with a cast shadow and a ground shadow/i
		})
		expect(document.activeElement).toBe(frame)
	})

	it('says what loading costs before it is pressed', () => {
		renderScene()
		expect(
			screen.getByRole('button', { name: /load 3d scene/i }).textContent
		).toMatch(/\d+(\.\d+)? (KB|MB)/)
	})

	it('opens the same scene in the publisher', () => {
		renderScene()
		const link = screen.getByRole('link', {
			name: /open this scene in the publisher/i
		})
		expect(link.getAttribute('href')).toBe('/publisher?example=camera-shadows')

		fireEvent.click(link)
		expect(capture).toHaveBeenCalledWith('example_opened_in_publisher', {
			example: 'camera-shadows',
			path: '/news-room/article'
		})
	})

	it('fails the render for an id no example has, so a typo cannot ship', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		// Bare: a route stub would catch it in its own error boundary.
		expect(() => render(<ExampleScene id="camera-shadow" />)).toThrow(
			/camera-shadow/
		)
	})
})
