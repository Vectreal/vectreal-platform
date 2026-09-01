// @vitest-environment jsdom
/**
 * See it the way a visitor will, on the thing that is showing it to you.
 *
 * Preview was the last survivor of a stack of four controls in the metadata
 * panel, and once publishing took the top of the column it was the only one
 * left down there - a filled button claiming to be the page's primary action
 * after the primary action had moved. It is not that; it opens the chrome-free
 * page a visitor gets, so it belongs on the viewer it is a different view of.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ScenePreviewOverlay } from './scene-preview-overlay'

vi.mock('react-router', () => ({
	Link: ({
		to,
		children,
		...rest
	}: {
		to: string
		children: React.ReactNode
	} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...rest}>
			{children}
		</a>
	)
}))

describe('the preview overlay', () => {
	it('points at the internal preview for this scene', () => {
		render(<ScenePreviewOverlay previewPath="/preview/project-1/scene-1" />)

		/*
		  The preview route, not the embed one. They are deliberately distinct -
		  one is session-authenticated and one is token-authenticated - and this
		  feature has confused them once already.
		*/
		expect(
			screen.getByRole('link', { name: /preview/i }).getAttribute('href')
		).toBe('/preview/project-1/scene-1')
	})

	it('is a link, so it can be opened in a new tab', () => {
		/*
		  A button with an onClick would swallow middle-click and cmd-click, which
		  is exactly how someone compares the preview against the scene beside it.
		*/
		render(<ScenePreviewOverlay previewPath="/preview/project-1/scene-1" />)

		expect(screen.getByRole('link', { name: /preview/i }).tagName).toBe('A')
	})

	it('floats over the viewer without covering it', () => {
		/*
		  Pinned to a corner and translucent. A solid chip would be a hole punched
		  in a model whose colour belongs to the user, and anything but a corner is
		  where a thumb wants to rotate the scene.
		*/
		render(<ScenePreviewOverlay previewPath="/preview/project-1/scene-1" />)

		const overlay = screen.getByRole('link', { name: /preview/i })
		expect(overlay.className).toContain('absolute')
		expect(overlay.className).toContain('top-3')
		expect(overlay.className).toContain('right-3')
		expect(overlay.className).toContain('backdrop-blur')
	})
})
