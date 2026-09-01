// @vitest-environment jsdom
/**
 * The surface that says what the scene *is*.
 *
 * Two things were being asserted by nothing at all. The stat labels existed
 * twice, in an aside and in a drawer, and had drifted (`Size` against
 * `Current Size`, `Meshes` against `Meshes / Vertices`) - so "the two agree" was
 * never a property anything held, it was a coincidence that had already stopped
 * being true. And the asset list was truncated to four in one place and
 * expandable in the other, which is why the collapse threshold is pinned here
 * rather than the row count on first paint.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SceneFactsPanel } from './scene-facts-panel'

/*
  Stubbed. The panel gained a Publish & Embed door at its foot, which pulls in
  the publish fetcher and the whole embed panel; this file is about the two
  content surfaces above it, and a failure in either of those should not read as
  a failure of the metrics. `scene-share-drawer.spec.tsx` covers the door.
*/
vi.mock('./scene-share-drawer', () => ({
	SceneShareDrawer: () => <button type="button">Publish &amp; Embed</button>
}))

/*
  Stubbed too. It reaches `useFetcher`, which needs a data router; the delete
  path is driven end to end in `scene-delete-button.spec.tsx`, and here it only
  has to occupy its place.
*/
vi.mock('./scene-delete-button', () => ({
	SceneDeleteButton: () => <button type="button">Delete scene</button>
}))

const PUBLISH_STATE: ScenePublishStateResponse = {
	sceneId: 'scene-1',
	status: 'draft',
	publishedAt: null,
	publishedAssetId: null,
	publishedAssetSizeBytes: null
}

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type {
	SceneAssetSummary,
	SceneDetailsSummary
} from '../../../types/dashboard'

function asset(index: number): SceneAssetSummary {
	return {
		id: `asset-${index}`,
		name: `asset-${index}.png`,
		type: 'texture',
		fileSize: 1024,
		mimeType: 'image/png'
	}
}

function details(
	overrides: Partial<SceneDetailsSummary> = {}
): SceneDetailsSummary {
	const assets = overrides.assets ?? []

	return {
		fileSizeBytes: 4_194_304,
		assetCount: assets.length,
		textureBytes: 1_048_576,
		textureCount: 3,
		meshesCount: 12,
		verticesCount: 48_000,
		...overrides,
		assets
	}
}

/**
 * The value under one stat label.
 *
 * Scoped to the metrics section, because `Assets` is both a tile label and the
 * heading of the section below it: unscoped, `getByText('Assets')` throws on two
 * matches, which is why the first version of this file asserted every tile
 * except that one - and `Size` went with it. Both then read whichever field a
 * typo pointed them at with nothing failing.
 */

const DELETE_REF: DashboardEntityRef = {
	type: 'scene',
	id: 'scene-1',
	name: 'Porsche',
	projectId: 'project-1',
	sceneStatus: 'draft'
}

/** Only `details` ever varies; the rest is what the route always passes. */
function renderPanel(details: SceneDetailsSummary) {
	return render(
		<SceneFactsPanel
			details={details}
			sceneId="scene-1"
			projectId="project-1"
			publishState={PUBLISH_STATE}
			onPublish={vi.fn()}
			deleteRef={DELETE_REF}
			canDelete
			onDeleted={vi.fn()}
		/>
	)
}

const tileValue = (label: string) => {
	const section = screen
		.getByRole('heading', { name: 'Scene Metrics' })
		.closest('section') as HTMLElement

	return within(section)
		.getByText(label)
		.parentElement?.textContent?.replace(label, '')
		.trim()
}

describe('scene metrics', () => {
	it('puts each figure under its own label', () => {
		/*
		  Every field a distinct value, which is the whole point of this test: the
		  first version left `assetCount` at three assets beside a `textureCount` of
		  three, so the Assets tile could read either one and the mutation swapping
		  them survived. No two numbers here collide.
		*/
		renderPanel(
			details({
				assets: [asset(1), asset(2), asset(3)],
				fileSizeBytes: 4_194_304,
				textureBytes: 1_048_576,
				textureCount: 7,
				meshesCount: 12,
				verticesCount: 48_000
			})
		)

		expect(tileValue('Size')).toBe('4.0 MB')
		expect(tileValue('Assets')).toBe('3')
		expect(tileValue('Texture Size')).toBe('1.0 MB')
		expect(tileValue('Meshes / Vertices')).toBe('12 / 48000')
	})

	it('renders one label set, not two', () => {
		renderPanel(details())

		expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
			'Scene Metrics',
			'Assets'
		])
		/*
		  The labels the drawer used and the aside did not. Asserting the survivors
		  alone passes with both sets rendered somewhere on the page, which is the
		  state this surface replaced.
		*/
		expect(screen.queryByText('Current Size')).toBeNull()
		expect(screen.queryByText('Meshes')).toBeNull()
	})

	it('reports texture weight when it is known and the count when it is not', () => {
		const { unmount } = renderPanel(details())
		expect(tileValue('Texture Size')).toBe('1.0 MB')
		unmount()

		renderPanel(details({ textureBytes: null }))
		/*
		  Not a dash. A scene saved before `currentTextureBytes` existed has only a
		  count, and the count is true where the dash is not.
		*/
		expect(tileValue('Texture Size')).toBe('3 textures')
	})

	it('falls back to a dash rather than printing null', () => {
		renderPanel(
			details({
				fileSizeBytes: null,
				textureBytes: null,
				textureCount: null,
				meshesCount: null,
				verticesCount: null
			})
		)

		expect(tileValue('Size')).toBe('-')
		expect(tileValue('Texture Size')).toBe('-')
		expect(tileValue('Meshes / Vertices')).toBe('- / -')
	})
})

describe('the asset list', () => {
	it('says so when there are none', () => {
		renderPanel(details())

		expect(screen.getByText('No linked assets.')).not.toBeNull()
		/*
		  The expand toggle by name, not "no buttons at all". The panel now ends in
		  a Publish & Embed door, so an unnamed query matches that instead and the
		  three assertions this shape appears in stopped being about the list.
		*/
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('shows every asset when the list is short enough to fit', () => {
		const assets = [asset(1), asset(2), asset(3)]
		renderPanel(details({ assets }))

		for (const item of assets) {
			expect(screen.getByText(item.name)).not.toBeNull()
		}
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('collapses past six and expands on demand', () => {
		const assets = Array.from({ length: 9 }, (_, index) => asset(index))
		renderPanel(details({ assets }))

		/*
		  The seventh, not "some are hidden": an off-by-one in the slice renders
		  five or seven rows and every looser assertion still passes.
		*/
		expect(screen.queryByText('asset-6.png')).toBeNull()
		expect(screen.getByText('asset-5.png')).not.toBeNull()

		const toggle = screen.getByRole('button', { name: 'Show 3 more' })
		expect(toggle.getAttribute('aria-expanded')).toBe('false')

		fireEvent.click(toggle)

		expect(screen.getByText('asset-8.png')).not.toBeNull()
		const collapse = screen.getByRole('button', { name: 'Show fewer' })
		expect(collapse.getAttribute('aria-expanded')).toBe('true')
	})

	it('leaves a list that exactly fills the limit alone', () => {
		/*
		  Six, the boundary itself. `> COLLAPSED_LIMIT` written as `>=` renders a
		  "Show 0 more" toggle over a complete list, and the seven- and nine-asset
		  cases below pass either way.
		*/
		const assets = Array.from({ length: 6 }, (_, index) => asset(index))
		renderPanel(details({ assets }))

		expect(screen.getByText('asset-5.png')).not.toBeNull()
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('counts the hidden rows, not the whole list', () => {
		const assets = Array.from({ length: 7 }, (_, index) => asset(index))
		renderPanel(details({ assets }))

		expect(screen.getByRole('button', { name: 'Show 1 more' })).not.toBeNull()
	})

	it('keeps the two sections in one landmark', () => {
		renderPanel(details({ assets: [asset(1)] }))

		const panel = screen.getByRole('complementary')
		expect(within(panel).getAllByRole('heading')).toHaveLength(2)
	})
})
