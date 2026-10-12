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

	it("floats in the corner the viewer's own controls leave free", () => {
		/*
		  Top-right and translucent. The viewer draws its camera switcher bottom
		  centre, playback bottom right and "Back to scene view" top centre, and a
		  solid chip would be a hole punched in a model whose colour belongs to
		  the user.
		*/
		render(<ScenePreviewOverlay previewPath="/preview/project-1/scene-1" />)

		const link = screen.getByRole('link', { name: /preview/i })
		expect(link.className).toContain('absolute')
		expect(link.className).toContain('top-3')
		expect(link.className).toContain('right-3')
		expect(link.className).toContain('backdrop-blur')
	})

	it('is still named Preview where only its icon shows', () => {
		/*
		  Below `sm` the word is visually hidden so the button stays clear of the
		  viewer's top-centre "Back to scene view". Hidden, not removed: it is the
		  link's accessible name.
		*/
		render(<ScenePreviewOverlay previewPath="/preview/project-1/scene-1" />)

		const word = screen.getByText('Preview')
		expect(word.className).toContain('sr-only')
		expect(word.className).toContain('sm:not-sr-only')
		expect(screen.getByRole('link').textContent).toBe('Preview')
	})
})
