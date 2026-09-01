// @vitest-environment jsdom
/**
 * The surface for what you *do* with a scene, and the one rule it enforces.
 *
 * The embed block appears only once the scene is published, matching the
 * publisher, whose Embed accordion item is gated the same way. Nothing held that
 * rule after it moved out of the route: flipping the gate to a constant `true`
 * left the whole suite green, and an unpublished scene would have been offered a
 * snippet for a URL that answers 404.
 *
 * The trigger is deliberately not gated with it. A drawer that vanishes for a
 * draft is a worse empty state than one that opens and says where publishing
 * happens.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneShareDrawer } from './scene-share-drawer'

import type { ScenePublishStateResponse } from '../../../types/api'

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
/*
  vaul reads `matchMedia` from a mount effect to decide whether it is on a touch
  device, and jsdom does not ship it - without this the drawer throws before it
  renders anything, which reads as five failing assertions about the embed gate.
*/
window.matchMedia ??= ((query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false
})) as typeof window.matchMedia
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

/*
  The embed panel is stubbed to a marker, not rendered. Its own contents are
  `embed-options-panel.spec.tsx`'s subject; what this file asserts is whether it
  is mounted at all, and a real one would drag two fetchers and a key hook in to
  answer that question.
*/
vi.mock('../../embed/embed-options-panel', () => ({
	EmbedOptionsPanel: ({
		sceneId,
		projectId
	}: {
		sceneId?: string
		projectId?: string
	}) => <div data-testid="embed-panel">{`${projectId}/${sceneId}`}</div>
}))

/*
  Shaped like the real control, not a bare marker. As a propless stub both
  `publishState` and `onPublish` could be deleted from the call site with every
  test still green - and `onPublish` is the whole "publishing happens in the
  Publisher" path, which is the only thing this surface offers a draft.
*/
vi.mock('../../publishing/scene-publish-state-control', () => ({
	ScenePublishStateControl: ({
		publishState,
		onPublish
	}: {
		publishState: ScenePublishStateResponse
		onPublish: () => void
	}) => (
		<div data-testid="publish-control">
			<span data-testid="publish-status">{publishState.status}</span>
			<button type="button" onClick={onPublish}>
				Publish this scene
			</button>
		</div>
	)
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
	publishedAt: '2026-08-31T10:00:00.000Z',
	publishedAssetId: 'asset-1',
	publishedAssetSizeBytes: 2048
}

const onPublish = vi.fn()

function open(publishState: ScenePublishStateResponse) {
	render(
		<SceneShareDrawer
			sceneId="scene-1"
			projectId="project-1"
			publishState={publishState}
			onPublish={onPublish}
		/>
	)

	fireEvent.click(screen.getByRole('button', { name: /publish & embed/i }))
}

beforeEach(() => {
	onPublish.mockClear()
})

describe('the embed block', () => {
	it('is absent while the scene is a draft', () => {
		open(DRAFT)

		expect(screen.getByTestId('publish-control')).not.toBeNull()
		expect(screen.queryByTestId('embed-panel')).toBeNull()
	})

	it('appears once the scene is published', () => {
		open(PUBLISHED)

		expect(screen.getByTestId('embed-panel')).not.toBeNull()
	})

	it('hands the panel this scene, in this project', () => {
		/*
		  Both ids, in order. A swapped pair builds a finished-looking embed URL for
		  a scene that is not in that project, which 404s on every site - the exact
		  failure `use-embed-api-keys` documents having had once already.
		*/
		open(PUBLISHED)

		expect(screen.getByTestId('embed-panel').textContent).toBe(
			'project-1/scene-1'
		)
	})
})

describe('the publish control', () => {
	it("is handed this scene's actual publication state", () => {
		open(DRAFT)

		expect(screen.getByTestId('publish-status').textContent).toBe('draft')
	})

	it('reports it as published once it is', () => {
		open(PUBLISHED)

		expect(screen.getByTestId('publish-status').textContent).toBe('published')
	})

	it('routes publishing back out to the caller', () => {
		/*
		  Publishing is the Publisher's job and this drawer only navigates there.
		  Dropping `onPublish` from the call site leaves a control that renders
		  correctly and does nothing when pressed.
		*/
		open(DRAFT)

		fireEvent.click(screen.getByRole('button', { name: 'Publish this scene' }))

		expect(onPublish).toHaveBeenCalledTimes(1)
	})
})

describe('the trigger', () => {
	it('opens the drawer for a draft too', () => {
		open(DRAFT)

		const dialog = screen.getByRole('dialog')
		expect(dialog.textContent).toContain('Publishing')
		expect(dialog.textContent).toContain('Publish & Embed')
	})
})
