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
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'draft' }}
			/>
		)

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
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'draft' }}
			/>
		)

		expect(screen.getByRole('link', { name: /preview/i }).tagName).toBe('A')
	})

	it('floats over the viewer without covering it', () => {
		/*
		  Pinned to a corner and translucent. A solid chip would be a hole punched
		  in a model whose colour belongs to the user, and anything but a corner is
		  where a thumb wants to rotate the scene.
		*/
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'draft' }}
			/>
		)

		const link = screen.getByRole('link', { name: /preview/i })
		expect(link.className).toContain('backdrop-blur')
		expect(link.className).toContain('pointer-events-auto')
		expect(link.parentElement?.className).toContain('pointer-events-none')
	})

	it("keeps both overlays in the top-right, out of the viewer's own controls", () => {
		/*
		  The viewer's camera switcher sits bottom centre and reserves 5rem per
		  side, narrower than "What visitors see", so on a phone it covered the
		  label in the bottom-left. "Back to scene view" takes the top centre.
		  One column in the corner the viewer never draws in, Preview first and
		  the label beneath it.
		*/
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'published' }}
			/>
		)

		const link = screen.getByRole('link', { name: /preview/i })
		const label = screen.getByText('What visitors see')
		const column = link.parentElement

		expect(label.parentElement).toBe(column)
		expect(column?.className).toContain('absolute')
		expect(column?.className).toContain('top-3')
		expect(column?.className).toContain('right-3')
		expect(label.className).not.toContain('bottom-3')
		expect(
			link.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy()
	})

	it('is still named Preview where only its icon shows', () => {
		/*
		  Below `sm` the word is visually hidden so the button stays clear of the
		  viewer's top-centre "Back to scene view". Hidden, not removed: it is the
		  link's accessible name.
		*/
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'draft' }}
			/>
		)

		const word = screen.getByText('Preview')
		expect(word.className).toContain('sr-only')
		expect(word.className).toContain('sm:not-sr-only')
		expect(screen.getByRole('link').textContent).toBe('Preview')
	})

	it('says a published scene shows what visitors see', () => {
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'published' }}
			/>
		)

		expect(screen.getByText('What visitors see')).not.toBeNull()
		expect(screen.queryByText('Draft')).toBeNull()
	})

	it('says a draft is the draft', () => {
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'draft' }}
			/>
		)

		expect(screen.getByText('Draft')).not.toBeNull()
		expect(screen.queryByText('What visitors see')).toBeNull()
	})

	it('names what it labels for a screen reader', () => {
		render(
			<ScenePreviewOverlay
				previewPath="/preview/project-1/scene-1"
				publishState={{ status: 'published' }}
			/>
		)

		const label = screen.getByText('What visitors see')
		expect(label.textContent).toBe('Viewer showing: What visitors see')
		expect(label.className).toContain('text-foreground')
		expect(label.className).not.toContain('text-muted-foreground')
	})
})
