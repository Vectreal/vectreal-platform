// @vitest-environment jsdom
/**
 * Whether the scene is on the web, and the way forward from wherever it is.
 *
 * Publishing used to be three understated fragments: a chip in the header's
 * meta row, a quiet door in the aside, and an `Open in Publisher` call to action
 * that led to the same route the door's own publish button did. This panel is
 * all three, which is what lets it be the top of the column.
 *
 * Two designs, not one with blanks in it, and that is what this file holds: a
 * draft has no date and no size to report, so it must not render the slots for
 * them, and a published scene must not be offered a "publish" prompt.
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ScenePublishPanel } from './scene-publish-panel'

import type { ScenePublishStateResponse } from '../../../types/api'

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

/*
  The door has its own spec. Here it only has to be present or absent, and a
  real one would drag the publish fetcher and the embed panel in with it.
*/
vi.mock('./scene-share-drawer', () => ({
	SceneShareDrawer: () => <button type="button">Publish &amp; Embed</button>
}))

const DRAFT: ScenePublishStateResponse = {
	sceneId: 'scene-1',
	status: 'draft',
	publishedAt: null,
	publishedAssetId: null,
	publishedAssetSizeBytes: null
}

const PUBLISHED: ScenePublishStateResponse = {
	...DRAFT,
	status: 'published',
	publishedAt: '2026-08-27T09:41:20.000Z',
	publishedAssetId: 'asset-1',
	publishedAssetSizeBytes: 2_202_009
}

function renderPanel(publishState: ScenePublishStateResponse) {
	return render(
		<ScenePublishPanel
			sceneId="scene-1"
			projectId="project-1"
			publishState={publishState}
			publisherPath="/publisher/scene-1"
			onPublish={vi.fn()}
		/>
	)
}

describe('a draft', () => {
	it('says it is not live, and makes publishing the one thing to do', () => {
		renderPanel(DRAFT)

		expect(screen.getByText('Not live')).not.toBeNull()

		const action = screen.getByRole('link', { name: /open in publisher/i })
		expect(action.getAttribute('href')).toBe('/publisher/scene-1')
	})

	it('does not offer the heading-row Publisher link', () => {
		/*
		  A draft's whole surface is the invitation to publish, and the button below
		  says so louder than a muted link on the heading row could. Two routes to
		  one place on one card is what this panel was built to end.
		*/
		renderPanel(DRAFT)

		expect(screen.getAllByRole('link')).toHaveLength(1)
	})

	it('offers no door onto an empty drawer', () => {
		/*
		  There is nothing behind it while the scene is a draft: no snippet, no
		  allowed domains, and a publication section whose only control does what
		  the prompt above already does. An earlier version kept the door open in
		  both states, which meant a draft could open a drawer to be told to go
		  somewhere else.
		*/
		renderPanel(DRAFT)

		expect(
			screen.queryByRole('button', { name: /publish & embed/i })
		).toBeNull()
	})

	it('reports no date and no size, rather than empty ones', () => {
		/*
		  A draft has neither. Rendering the rows with a dash in them is the
		  understatement this redesign removed - the surface would look like a
		  readout that had failed to load.
		*/
		renderPanel(DRAFT)

		expect(screen.queryByText(/published/i)).toBeNull()
		expect(screen.queryByText(/MB|KB/)).toBeNull()
	})
})

describe('a published scene', () => {
	it('says it is live, with the two facts it is asked for', () => {
		const { container } = renderPanel(PUBLISHED)

		expect(screen.getByText('Live')).not.toBeNull()
		/*
		  Date and size in one line. The size is what a visitor pays to load it,
		  which is the number this product exists to keep small.
		*/
		expect(container.textContent).toContain('2.1 MB')
		expect(container.textContent).toMatch(/Published\s/)
	})

	it('opens onto the snippet rather than prompting a publish', () => {
		renderPanel(PUBLISHED)

		expect(
			screen.getByRole('button', { name: /publish & embed/i })
		).not.toBeNull()
		expect(screen.queryByText('Not live')).toBeNull()
	})

	it('keeps the Publisher reachable, on the heading row', () => {
		/*
		  The header's call to action was folded into this panel, so this is now the
		  only route to the Publisher for a live scene. Losing it strands anyone who
		  wants to recompose one.

		  On the heading row rather than under the door, which is where it was: a
		  centred ghost link with air on both sides, reading as something stranded
		  rather than as part of the section.
		*/
		renderPanel(PUBLISHED)

		const link = screen.getByRole('link', { name: /open in publisher/i })
		expect(link.getAttribute('href')).toBe('/publisher/scene-1')

		/*
		  Inside the header that `DetailPanelSection` draws, which is the slot the
		  `action` prop fills - not loose in the content below it.
		*/
		const heading = screen.getByRole('heading', { name: 'Publishing' })
		expect(heading.parentElement?.contains(link)).toBe(true)
	})

	it('names the section, so it is not the only one without a heading', () => {
		/*
		  It was a bare eyebrow. Every other section in this column has a heading,
		  and `DetailPanelSection` puts its `action` on the title row - so without
		  one there was nowhere for the Publisher link to sit.
		*/
		renderPanel(PUBLISHED)

		expect(screen.getByRole('heading', { name: 'Publishing' }).tagName).toBe(
			'H2'
		)
	})
})

describe('the status dot', () => {
	it('is the only thing carrying colour, and it changes with the state', () => {
		/*
		  Brand orange for a draft, because that is the state with something to do
		  about it; the success token once it is live. The card itself stays on the
		  same raised step as its neighbours - a tinted surface would read as an
		  alert on a page where nothing is wrong.
		*/
		const draft = renderPanel(DRAFT)
		const draftDot = draft.container.querySelector('span[aria-hidden]')
		expect(draftDot?.className).toContain('bg-orange')
		draft.unmount()

		const live = renderPanel(PUBLISHED)
		const liveDot = live.container.querySelector('span[aria-hidden]')
		expect(liveDot?.className).toContain('bg-success')
	})

	it('is hidden from assistive technology, because the words carry it', () => {
		const { container } = renderPanel(PUBLISHED)

		const dot = container.querySelector('span[aria-hidden]') as HTMLElement
		expect(dot.getAttribute('aria-hidden')).not.toBeNull()
		/* The state is readable without it. */
		expect(within(container).getByText('Live')).not.toBeNull()
	})
})
