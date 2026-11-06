// @vitest-environment jsdom
/**
 * The viewer is announced as a 3D viewer, named for what it shows, with the
 * keys it takes read after the name. It sits in the tab order only while it
 * takes keys.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Canvas from './canvas-wrapper'

vi.mock('@react-three/fiber', () => ({ Canvas: () => null }))
vi.mock('@react-three/drei', () => ({ PerformanceMonitor: () => null }))

beforeEach(() => {
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined
	}))
})

const KEY_HELP = 'Arrow keys rotate the view.'

const descriptionOf = (element: HTMLElement) =>
	document.getElementById(element.getAttribute('aria-describedby') ?? '')
		?.textContent

describe('the viewer container', () => {
	it('is a named, tabbable 3D viewer that says which keys it takes', () => {
		render(
			<Canvas
				enableViewportRendering={false}
				label="A walnut lounge chair"
				keyHelp={KEY_HELP}
			>
				{null}
			</Canvas>
		)
		const viewer = screen.getByRole('application', {
			name: 'A walnut lounge chair'
		})
		expect(viewer.getAttribute('aria-roledescription')).toBe('3D viewer')
		expect(viewer.tabIndex).toBe(0)
		expect(descriptionOf(viewer)).toBe(KEY_HELP)
	})

	it('keeps the key help off the page itself', () => {
		render(
			<Canvas enableViewportRendering={false} keyHelp={KEY_HELP}>
				{null}
			</Canvas>
		)
		const viewer = screen.getByRole('application')
		expect(
			document.getElementById(viewer.getAttribute('aria-describedby')!)?.hidden
		).toBe(true)
	})

	it('without keys, stays a named group that focus can land on but Tab skips', () => {
		render(
			<Canvas
				enableViewportRendering={false}
				label="A walnut lounge chair"
				keyHelp=""
			>
				{null}
			</Canvas>
		)
		const viewer = screen.getByRole('group', { name: 'A walnut lounge chair' })
		expect(viewer.getAttribute('aria-roledescription')).toBe('3D viewer')
		expect(viewer.tabIndex).toBe(-1)
		expect(viewer.hasAttribute('aria-describedby')).toBe(false)
	})
})
