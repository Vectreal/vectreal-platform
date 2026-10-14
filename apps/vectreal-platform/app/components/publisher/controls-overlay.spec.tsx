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
import { render, screen, waitFor } from '@testing-library/react'
import { getDefaultStore } from 'jotai'
import { createRoutesStub } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OverlayControls from './controls-overlay'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'

import type { PublisherLoaderData } from '../../types/api'

const { model, probe, drawerFlow, sizeLabel } = vi.hoisted(() => ({
	model: { status: 'empty' },
	sizeLabel: { excludesTextureEncoding: false },
	drawerFlow: { args: [] as { isOverSizeLimit: boolean }[] },
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

vi.mock('./sidebars/tool-sidebar', () => ({
	ToolSidebar: probe('tool-sidebar')
}))
vi.mock('./sidebars/dynamic-sidebar', () => ({
	DynamicSidebar: probe('publish-sidebar')
}))
vi.mock('./optimization/optimization-drawer', () => ({
	default: probe('optimization-drawer')
}))
vi.mock('./shell/empty-stage', () => ({
	EmptyStage: ({
		recentScenes
	}: {
		recentScenes: readonly { id: string }[]
	}) => (
		<div
			data-testid="empty-stage"
			data-recent={recentScenes.map((scene) => scene.id).join(',')}
		/>
	)
}))
vi.mock('./shell/tool-bar', () => ({ ToolBar: probe('tool-bar') }))
vi.mock('./shell/publish-card', () => ({
	PublishCard: ({
		isSceneSizeLoading,
		sizeExcludesTextureEncoding
	}: {
		isSceneSizeLoading: boolean
		sizeExcludesTextureEncoding: boolean
	}) => (
		<div
			data-testid="publish-card"
			data-loading={String(isSceneSizeLoading)}
			data-excludes-textures={String(sizeExcludesTextureEncoding)}
		/>
	)
}))
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
vi.mock('./optimization/use-publish-size-projection', () => ({
	usePublishSizeProjection: () => undefined,
	useSizeExcludesTextureEncoding: () => sizeLabel.excludesTextureEncoding
}))
vi.mock('../../hooks/use-publisher-scene', () => ({
	usePublisherScene: () => ({
		openSceneId: null,
		isRestoringDraft: false,
		uploadFiles: vi.fn(),
		retrySceneLoad: vi.fn(),
		saveSceneSettings: vi.fn(),
		saveAvailability: { canSave: false, reason: 'no-model' },
		persistPendingSceneDraft: vi.fn()
	})
}))
vi.mock('../../hooks/use-optimization-drawer-flow', () => ({
	useOptimizationDrawerFlow: (args: { isOverSizeLimit: boolean }) => {
		drawerFlow.args.push(args)
		return {
			effectiveSaveAvailability: { canSave: false, reason: 'no-model' },
			isOptimizationDrawerOpen: false,
			handleOptimizationDrawerChange: vi.fn(),
			handleOpenOptimizationDrawer: vi.fn(),
			openReoptimizeDrawer: vi.fn()
		}
	}
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
	maxSceneBytes: null,
	recentScenes: [
		{
			id: 'scene-1',
			name: 'Chair',
			projectId: 'project-1',
			projectName: 'Shop',
			status: 'draft',
			updatedAt: '2026-09-25T00:00:00.000Z'
		}
	]
}

function renderShell(data: PublisherLoaderData = loaderData) {
	const Stub = createRoutesStub([
		{
			path: '/publisher',
			Component: () => (
				<OverlayControls {...data}>
					<div data-testid="viewer" />
				</OverlayControls>
			)
		}
	])
	render(<Stub initialEntries={['/publisher']} />)
}

const SCENE_CHROME = [
	'tool-bar',
	'tool-sidebar',
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
		// The loader's recent scenes reach the stage that offers them.
		expect(screen.getByTestId('empty-stage').dataset.recent).toBe('scene-1')
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

	// Checked against the size the card shows; publishing checks the stored file.
	it('tells the optimizer flow when the scene shown is over the max scene size', async () => {
		model.status = 'ready'
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 2000
		}))

		renderShell({ ...loaderData, maxSceneBytes: 1000 })
		await screen.findByTestId('header')
		expect(drawerFlow.args.at(-1)?.isOverSizeLimit).toBe(true)

		renderShell({ ...loaderData, maxSceneBytes: 2000 })
		await waitFor(() =>
			expect(drawerFlow.args.at(-1)?.isOverSizeLimit).toBe(false)
		)
	})

	// Meanwhile the figure is the stored package, larger than what publishes.
	it('holds the over-limit nudge while the size is being measured', async () => {
		model.status = 'ready'
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 2000,
			isProjectingSceneBytes: true
		}))

		renderShell({ ...loaderData, maxSceneBytes: 1000 })

		const card = await screen.findByTestId('publish-card')
		expect(card.dataset.loading).toBe('true')
		expect(drawerFlow.args.at(-1)?.isOverSizeLimit).toBe(false)
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			isProjectingSceneBytes: false
		}))
	})

	it('tells the card when its size leaves out GPU textures', async () => {
		model.status = 'ready'
		sizeLabel.excludesTextureEncoding = true

		renderShell()

		const card = await screen.findByTestId('publish-card')
		expect(card.dataset.excludesTextures).toBe('true')
		sizeLabel.excludesTextureEncoding = false
	})

	// Before the projection lands the card shows the stored package, which is
	// uncompressed: no publish size is known yet to judge.
	it('judges no stored package against the max scene size', async () => {
		model.status = 'ready'
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: null,
			clientSceneBytes: 5000,
			latestSceneStats: null
		}))

		renderShell({ ...loaderData, maxSceneBytes: 1000 })

		await screen.findByTestId('publish-card')
		expect(drawerFlow.args.at(-1)?.isOverSizeLimit).toBe(false)
	})

	it('judges the size a publish stored', async () => {
		model.status = 'ready'
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: null,
			latestSceneStats: { currentSceneBytes: 2000 } as never
		}))

		renderShell({ ...loaderData, maxSceneBytes: 1000 })

		await screen.findByTestId('publish-card')
		expect(drawerFlow.args.at(-1)?.isOverSizeLimit).toBe(true)
		getDefaultStore().set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: null
		}))
	})
})
