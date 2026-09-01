// @vitest-environment jsdom
/**
 * The aside, for viewports that have no room for one.
 *
 * Below `xl` the facts panel used to flow its full asset list into the page.
 * That made the page taller than the shell could scroll, and because the grid
 * was pinned to the viewport height the list was clipped with nothing able to
 * reach it - the surface was not merely cramped, it was unusable.
 *
 * What replaces it is two figures and two doors. This file holds the part of
 * that a test can see: which numbers stay on screen, that both doors exist, and
 * that what is behind them costs nothing until it is asked for.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SceneSummaryBar } from './scene-summary-bar'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
/* vaul queries `(display-mode: standalone)` from a mount effect; jsdom ships no
   `matchMedia`, and without this the sheet throws before rendering anything. */
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

/* The publish door has its own spec; here it only has to be a door. */
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

const DELETE_REF: DashboardEntityRef = {
	type: 'scene',
	id: 'scene-1',
	name: 'Porsche',
	projectId: 'project-1',
	sceneStatus: 'draft'
}

const DETAILS: SceneDetailsSummary = {
	fileSizeBytes: 632_832,
	assetCount: 7,
	textureBytes: 265_216,
	textureCount: 4,
	meshesCount: 12,
	verticesCount: 40_968,
	assets: Array.from({ length: 7 }, (_, index) => ({
		id: `asset-${index}`,
		name: `asset-${index}.png`,
		type: 'texture',
		fileSize: 1024,
		mimeType: 'image/png'
	}))
}

function renderBar(details: SceneDetailsSummary = DETAILS) {
	return render(
		<SceneSummaryBar
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

const tileValue = (label: string) =>
	screen.getByText(label).parentElement?.textContent?.replace(label, '').trim()

describe('what stays on screen', () => {
	it('keeps the two figures that drive the page', () => {
		renderBar()

		/*
		  Two decimals is what `formatFileSize` renders today. The unification that
		  makes it adaptive stacks on top of this branch and declares the shift to
		  `618 KB` as its own visible change; this asserts the current truth rather
		  than a future one.
		*/
		expect(tileValue('Size')).toBe('618.00 KB')
		expect(tileValue('Assets')).toBe('7')
	})

	it('does not flow the asset list into the page', () => {
		/*
		  The regression itself. Every asset rendering here is what made the page
		  unscrollable, so their absence is the assertion - and it is anchored on
		  the figures above, which a component rendering nothing would fail.
		*/
		renderBar()

		expect(screen.queryByText('asset-0.png')).toBeNull()
		expect(screen.queryByRole('heading', { name: 'Assets' })).toBeNull()
	})

	it('offers two doors and one quiet way out, and nothing else', () => {
		renderBar()

		/*
		  Named, in order, and counted. The count is what holds the rule this
		  surface exists for - two doors, with Delete beneath them as the quietest
		  thing here - and a third door added beside them would pass any assertion
		  that only checked the two were present.
		*/
		expect(
			screen.getAllByRole('button').map((control) => control.textContent)
		).toEqual([
			expect.stringContaining('Scene details'),
			'Publish & Embed',
			'Delete scene'
		])
	})
})

describe('the scene details door', () => {
	it('says what is behind it', () => {
		renderBar()

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('7 assets · 618.00 KB')
	})

	it('speaks of one asset in the singular', () => {
		renderBar({ ...DETAILS, assetCount: 1, assets: [DETAILS.assets[0]] })

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('1 asset ·')
	})

	it('says so when the scene has none', () => {
		renderBar({ ...DETAILS, assetCount: 0, assets: [] })

		expect(
			screen.getByRole('button', { name: /scene details/i }).textContent
		).toContain('No linked assets')
	})

	it('costs nothing until it is opened', () => {
		/*
		  The point of the door. If the sheet's contents mounted with the page, the
		  asset list would be back in the document and the only thing gained would
		  be that it is invisible.
		*/
		renderBar()

		expect(screen.queryByRole('dialog')).toBeNull()
		expect(screen.queryByText('asset-0.png')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /scene details/i }))

		const sheet = screen.getByRole('dialog')
		expect(sheet.textContent).toContain('Scene Metrics')
		expect(screen.getByText('asset-0.png')).not.toBeNull()
	})
})
