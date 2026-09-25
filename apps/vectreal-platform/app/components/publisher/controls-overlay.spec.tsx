// @vitest-environment jsdom
/**
 * What the publisher shell puts on screen, by state.
 *
 * An empty publisher used to be a separate page under the site nav, swapped
 * for the editor when a file arrived. It is the editor now: the header is
 * always there, and the controls that act on a scene arrive with the scene.
 *
 * Every child is a probe, so this reads the shell's own decisions and nothing
 * the children decide for themselves.
 */
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OverlayControls from './controls-overlay'

import type { PublisherLoaderData } from '../../types/api'

const { model, probe } = vi.hoisted(() => ({
	model: { status: 'empty' },
	probe: (name: string) => () => <div data-testid={name} />
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		status: model.status,
		optimizer: { isPreparing: false, report: null, info: null }
	})
}))
vi.mock('@shared/components/hooks/use-mobile', () => ({
	useIsMobile: () => false
}))
vi.mock('posthog-js', () => ({ default: { reset: vi.fn() } }))

vi.mock('./index', () => ({
	ToolSidebar: probe('tool-rail'),
	DynamicSidebar: probe('publish-sidebar')
}))
vi.mock('./optimization/optimization-drawer', () => ({
	default: probe('optimization-drawer')
}))
vi.mock('./preview-camera-controls', () => ({ default: probe('camera') }))
vi.mock('./shell/empty-stage', () => ({ EmptyStage: probe('empty-stage') }))
vi.mock('./shell/preview-mode-badge', () => ({
	PreviewModeBadge: probe('preview-badge')
}))
vi.mock('./shell/publish-card', () => ({ PublishCard: probe('publish-card') }))
vi.mock('./shell/publisher-header', () => ({
	PublisherHeader: ({ showSceneControls }: { showSceneControls: boolean }) => (
		<div data-testid="header" data-scene-controls={String(showSceneControls)} />
	)
}))
vi.mock('./shell/publisher-surface-fallback', () => ({
	PublisherSurfaceFallback: probe('fallback')
}))
vi.mock('./sidebars/use-scene-size-initializer', () => ({
	useSceneSizeInitializer: () => undefined
}))
vi.mock('../../hooks', () => ({
	usePublisherScene: () => ({
		openSceneId: null,
		isRestoringDraft: false,
		uploadFiles: vi.fn(),
		retrySceneLoad: vi.fn(),
		saveSceneSettings: vi.fn(),
		saveAvailability: { canSave: false, reason: 'no-model' },
		persistPendingSceneDraft: vi.fn()
	}),
	useOptimizationDrawerFlow: () => ({
		effectiveSaveAvailability: { canSave: false, reason: 'no-model' },
		requiresSizeReduction: false,
		isOptimizationDrawerOpen: false,
		handleOptimizationDrawerChange: vi.fn(),
		handleOpenOptimizationDrawer: vi.fn(),
		openReoptimizeDrawer: vi.fn()
	})
}))
vi.mock('../../hooks/use-location-change-state', () => ({
	useLocationChangeState: () => ({ hasUnsavedLocationChange: false })
}))

const loaderData: PublisherLoaderData = {
	isMobileRequest: false,
	user: null,
	sceneId: null,
	projectId: null,
	currentLocation: null as never,
	sceneManifest: null,
	publishedMeta: null,
	maxSceneBytes: null
}

function renderShell() {
	const Stub = createRoutesStub([
		{
			path: '/publisher',
			Component: () => (
				<OverlayControls {...loaderData}>
					<div data-testid="viewer" />
				</OverlayControls>
			)
		}
	])
	render(<Stub initialEntries={['/publisher']} />)
}

const SCENE_CHROME = [
	'tool-rail',
	'publish-card',
	'publish-sidebar',
	'optimization-drawer'
]

describe('the publisher shell', () => {
	beforeEach(() => {
		model.status = 'empty'
	})

	it('opens on the editor: its header over an empty stage, and no scene controls yet', async () => {
		renderShell()

		const header = await screen.findByTestId('header')
		expect(header.dataset.sceneControls).toBe('false')
		expect(screen.getByTestId('empty-stage')).toBeTruthy()
		for (const id of SCENE_CHROME) {
			expect(screen.queryByTestId(id), id).toBeNull()
		}
	})

	it('brings the scene controls with the model, under the same header', async () => {
		model.status = 'ready'
		renderShell()

		const header = await screen.findByTestId('header')
		expect(header.dataset.sceneControls).toBe('true')
		expect(screen.getByTestId('viewer')).toBeTruthy()
		expect(screen.queryByTestId('empty-stage')).toBeNull()
		for (const id of SCENE_CHROME) {
			expect(screen.getByTestId(id), id).toBeTruthy()
		}
	})
})
