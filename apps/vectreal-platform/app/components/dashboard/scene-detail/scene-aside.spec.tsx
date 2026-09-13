// @vitest-environment jsdom
/**
 * The scene page's one aside.
 *
 * Merged from `scene-facts-panel.spec.tsx` and `scene-summary-bar.spec.tsx`
 * when the two hosts became one. Everything each of them pinned about content
 * is kept; the two claims that follow could not be, and the reason is the point
 * of the change.
 *
 * **"The bar does not flow the asset list into the page" is gone.** It was true
 * of the component and false of the product: the page mounted the facts panel
 * beside the bar, `hidden` rather than unmounted, so the list was in the
 * document at every width already. A spec that holds for a component nobody
 * renders alone is the "well-tested module nothing reaches" shape.
 *
 * **"The details door costs nothing until it is opened" is narrowed** to the
 * sheet's own contents, which is what that claim was actually protecting. The
 * asset list below it is now always in the tree, so the assertion is scoped to
 * the dialog rather than the document.
 *
 * jsdom applies no CSS, so both middles are queryable here regardless of
 * `xl:hidden`. Every lookup that could match in both is therefore scoped to the
 * section it belongs to - unscoped, `Size` and `Assets` each match twice and
 * the query throws or, worse, silently reads the wrong one.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SceneAside } from './scene-aside'

/*
  jsdom ships none of these and the details sheet needs all of them: Radix and
  vaul reach for pointer capture and a `ResizeObserver` on mount, and vaul
  queries `(display-mode: standalone)` from an effect. Carried over from
  `scene-summary-bar.spec.tsx`, which owned the door before this file did.
*/
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
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

/*
  Stubbed. The aside carries a Publish & Embed door, which pulls in the publish
  fetcher and the whole embed panel; this file is about the content surfaces and
  a failure in the door should not read as a failure of the metrics.
  `scene-share-drawer.spec.tsx` covers it.
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

/*
  And the publish panel, which reaches the share drawer and through it a
  fetcher. `scene-publish-panel.spec.tsx` drives its two states directly; here
  it only has to hold its place at the top.
*/
vi.mock('./scene-publish-panel', () => ({
	ScenePublishPanel: () => <button type="button">Publishing</button>
}))

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type {
	SceneAssetSummary,
	SceneDetailsSummary
} from '../../../types/dashboard'

const PUBLISH_STATE: ScenePublishStateResponse = {
	sceneId: 'scene-1',
	status: 'draft',
	publishedAt: null,
	publishedAssetId: null,
	publishedAssetSizeBytes: null
}

const DELETE_REF: DashboardEntityRef = {
	type: 'scene',
	id: 'scene-1',
	name: 'Porsche',
	projectId: 'project-1',
	sceneStatus: 'draft'
}

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

/** Only `details` ever varies; the rest is what the route always passes. */
function renderAside(sceneDetails: SceneDetailsSummary = details()) {
	return render(
		<SceneAside
			details={sceneDetails}
			sceneId="scene-1"
			projectId="project-1"
			publishState={PUBLISH_STATE}
			publisherPath="/publisher/scene-1"
			onPublish={vi.fn()}
			deleteRef={DELETE_REF}
			canDelete
			onDeleted={vi.fn()}
		/>
	)
}

/**
 * The value under one label in the metrics grid.
 *
 * Scoped to the metrics section, because `Assets` is a tile label, the heading
 * of the section below it, and a tile in the at-a-glance grid: unscoped,
 * `getByText('Assets')` throws on three matches, which is why the first version
 * of this file asserted every tile except that one - and `Size` went with it.
 */
const metric = (label: string) => {
	const section = screen
		.getByRole('heading', { name: 'Scene Metrics' })
		.closest('section') as HTMLElement

	return within(section)
		.getByText(label)
		.parentElement?.textContent?.replace(label, '')
		.trim()
}

/** The value under one label in the two-tile grid that shows below `xl`. */
const glance = (label: string) => {
	const grid = screen.getByRole('complementary').querySelector('.xl\\:hidden')

	return within(grid as HTMLElement)
		.getByText(label)
		.parentElement?.textContent?.replace(label, '')
		.trim()
}

describe('what the aside puts on screen', () => {
	it('keeps the two headline figures where there is no column', () => {
		renderAside(details({ assets: [asset(1), asset(2), asset(3)] }))

		expect(glance('Size')).toBe('4.0 MB')
		expect(glance('Assets')).toBe('3')
	})

	it('mounts publishing and delete once each, not once per breakpoint', () => {
		/*
		  The regression this component exists to close. Two hosts rendered a
		  publish panel and a delete button apiece - each with its own fetcher and
		  its own confirmation dialog - and CSS hid one of the pair. Counting is
		  the assertion; "at least one is present" passed the whole time it was
		  broken.
		*/
		renderAside(details({ assets: [asset(1)] }))

		expect(screen.getAllByRole('button', { name: 'Publishing' })).toHaveLength(
			1
		)
		expect(
			screen.getAllByRole('button', { name: 'Delete scene' })
		).toHaveLength(1)
	})

	it('offers its doors in order, and nothing else', () => {
		/*
		  Named, in order, and counted. The order is the claim: publishing first,
		  because getting the scene onto someone else's site is what this page is
		  for; then what the scene is made of; then, quietest, the way to delete
		  it. A surface added anywhere in that sequence fails here, which an
		  assertion that merely checked each one was present would not.
		*/
		renderAside(details({ assets: [asset(1)] }))

		expect(
			screen.getAllByRole('button').map((control) => control.textContent)
		).toEqual([
			'Publishing',
			expect.stringContaining('Scene details'),
			'Delete scene'
		])
	})

	it('keeps every section inside the one landmark', () => {
		renderAside(details({ assets: [asset(1)] }))

		const aside = screen.getByRole('complementary')
		expect(
			within(aside)
				.getAllByRole('heading')
				.map((h) => h.textContent)
		).toEqual(['Scene Metrics', 'Assets'])
	})
})

describe('scene metrics', () => {
	it('puts each figure under its own label', () => {
		/*
		  Every field a distinct value, which is the whole point of this test: the
		  first version left `assetCount` at three assets beside a `textureCount` of
		  three, so the Assets tile could read either one and the mutation swapping
		  them survived. No two numbers here collide.
		*/
		renderAside(
			details({
				assets: [asset(1), asset(2), asset(3)],
				fileSizeBytes: 4_194_304,
				textureBytes: 1_048_576,
				textureCount: 7,
				meshesCount: 12,
				verticesCount: 48_000
			})
		)

		expect(metric('Size')).toBe('4.0 MB')
		expect(metric('Assets')).toBe('3')
		expect(metric('Texture Size')).toBe('1.0 MB')
		expect(metric('Meshes / Vertices')).toBe('12 / 48000')
	})

	it('renders one label set, not two', () => {
		renderAside()

		/*
		  The labels the drawer used and the aside did not. Asserting the survivors
		  alone passes with both sets rendered somewhere on the page, which is the
		  state this surface replaced.
		*/
		expect(screen.queryByText('Current Size')).toBeNull()
		expect(screen.queryByText('Meshes')).toBeNull()
	})

	it('reports texture weight when it is known and the count when it is not', () => {
		const { unmount } = renderAside()
		expect(metric('Texture Size')).toBe('1.0 MB')
		unmount()

		renderAside(details({ textureBytes: null }))
		/*
		  Not a dash. A scene saved before `currentTextureBytes` existed has only a
		  count, and the count is true where the dash is not.
		*/
		expect(metric('Texture Size')).toBe('3 textures')
	})

	it('falls back to a dash rather than printing null', () => {
		renderAside(
			details({
				fileSizeBytes: null,
				textureBytes: null,
				textureCount: null,
				meshesCount: null,
				verticesCount: null
			})
		)

		expect(metric('Size')).toBe('-')
		expect(metric('Texture Size')).toBe('-')
		expect(metric('Meshes / Vertices')).toBe('- / -')
		expect(glance('Size')).toBe('-')
	})
})

describe('the asset list', () => {
	it('says so when there are none', () => {
		renderAside()

		expect(screen.getByText('No linked assets.')).not.toBeNull()
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('shows every asset when the list is short enough to fit', () => {
		const assets = [asset(1), asset(2), asset(3)]
		renderAside(details({ assets }))

		for (const item of assets) {
			expect(screen.getByText(item.name)).not.toBeNull()
		}
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('collapses past six and expands on demand', () => {
		const assets = Array.from({ length: 9 }, (_, index) => asset(index))
		renderAside(details({ assets }))

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
		renderAside(details({ assets }))

		expect(screen.getByText('asset-5.png')).not.toBeNull()
		expect(screen.queryByRole('button', { name: /show/i })).toBeNull()
	})

	it('counts the hidden rows, not the whole list', () => {
		const assets = Array.from({ length: 7 }, (_, index) => asset(index))
		renderAside(details({ assets }))

		expect(screen.getByRole('button', { name: 'Show 1 more' })).not.toBeNull()
	})
})

describe('the scene details door', () => {
	const withAssets = () =>
		details({
			assets: Array.from({ length: 7 }, (_, index) => asset(index)),
			fileSizeBytes: 632_832
		})

	it('says what is behind it', () => {
		renderAside(withAssets())

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('7 assets · 618 KB')
	})

	it('speaks of one asset in the singular', () => {
		renderAside(details({ assets: [asset(0)], fileSizeBytes: 632_832 }))

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('1 asset ·')
	})

	it('says so when the scene has none', () => {
		renderAside(details({ fileSizeBytes: 632_832 }))

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('No linked assets')
	})

	it('costs nothing until it is opened', () => {
		/*
		  The point of the door: its contents mount on demand. Scoped to the dialog
		  rather than the document, because the aside's own asset list is always in
		  the tree now - an unscoped `queryByText('asset-0.png')` would match that
		  and report a sheet that had not opened.
		*/
		renderAside(withAssets())

		expect(screen.queryByRole('dialog')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /scene details/i }))

		const sheet = screen.getByRole('dialog')
		expect(sheet.textContent).toContain('Scene Metrics')
		expect(within(sheet).getByText('asset-0.png')).not.toBeNull()
	})
})
