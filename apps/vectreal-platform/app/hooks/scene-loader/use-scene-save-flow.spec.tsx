// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react'
import { getDefaultStore } from 'jotai'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSceneSaveFlow } from './use-scene-save-flow'
import { defaultBoundsOptions } from '../../constants/viewer-defaults'
import { capturedThumbnailFrameAtom } from '../../lib/stores/publisher-config-store'
import { dispatchSaveProgressAtom } from '../../lib/stores/save-progress-store'
import { hotspotsAtom } from '../../lib/stores/scene-settings-store'

import type { ScenePersistenceState } from './contracts'
import type { SceneMetaState } from '../../types/publisher-config'
import type { SaveSceneResult } from '../../types/publisher-scene'
import type { SceneOptimizationRuntimeState } from '../../types/scene-optimization'
import type { HotspotDefinition, SceneSettings } from '@vctrl/core'

const {
	mockSetAtom,
	mockExecuteSceneSaveOrchestrator,
	dispatchSaveProgress,
	resolveSource,
	recordSavedSource
} = vi.hoisted(() => ({
	mockSetAtom: vi.fn(),
	mockExecuteSceneSaveOrchestrator: vi.fn(),
	dispatchSaveProgress: vi.fn(),
	resolveSource: vi.fn(),
	recordSavedSource: vi.fn()
}))

vi.mock('jotai/react', async () => {
	const actual =
		await vi.importActual<typeof import('jotai/react')>('jotai/react')

	return {
		...actual,
		useSetAtom: mockSetAtom
	}
})

vi.mock('../../lib/domain/scene', async () => {
	const actual = await vi.importActual<typeof import('../../lib/domain/scene')>(
		'../../lib/domain/scene'
	)

	return {
		...actual,
		executeSceneSaveOrchestrator: mockExecuteSceneSaveOrchestrator
	}
})

const createDeferred = <T,>() => {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

const createSettings = (margin: number): SceneSettings => ({
	bounds: {
		...defaultBoundsOptions,
		margin
	}
})

const OPTIMIZATION_SETTINGS = {} as never

const sceneMeta: SceneMetaState = {
	name: 'Scene',
	description: 'Test scene',
	thumbnailUrl: ''
}

interface HarnessApi {
	saveSceneSettings: () => Promise<
		SaveSceneResult | { unchanged: true } | undefined
	>
	setCurrentSettings: (settings: SceneSettings) => void
	setLastSavedSettings: (settings: SceneSettings | null) => void
	getLastSavedSettings: () => SceneSettings | null
	getHasUnsavedChanges: () => boolean
	openScene: (sceneId: string) => void
	runPass: () => void
	getSavedPassRevision: () => number | null
}

interface SceneSaveFlowHarnessProps {
	apiRef: { current: HarnessApi | null }
	initialCurrentSettings: SceneSettings
	initialLastSavedSettings: SceneSettings | null
	hasUnsavedOriginalChoice?: boolean
}

function SceneSaveFlowHarness({
	apiRef,
	initialCurrentSettings,
	initialLastSavedSettings,
	hasUnsavedOriginalChoice = false
}: SceneSaveFlowHarnessProps) {
	const [currentSettings, setCurrentSettings] = useState(initialCurrentSettings)
	const [sceneMetaState, setSceneMetaState] = useState(sceneMeta)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettings | null>(initialLastSavedSettings)
	const [lastSavedSceneMeta, setLastSavedSceneMeta] =
		useState<SceneMetaState | null>(sceneMeta)
	const [lastSavedSceneId, setLastSavedSceneId] = useState<string | null>(
		'scene-1'
	)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [currentSceneId, setCurrentSceneIdState] = useState<string | null>(
		'scene-1'
	)
	const [optimizationRuntime, setOptimizationRuntime] =
		useState<SceneOptimizationRuntimeState>({
			isPending: false,
			isSceneSizeLoading: false,
			optimizedSceneBytes: null,
			isProjectingSceneBytes: false,
			clientSceneBytes: null,
			workingSceneBytes: null,
			optimizedTextureBytes: null,
			clientTextureBytes: null,
			lastSavedReportSignature: null,
			latestSceneStats: null,
			dracoReport: null,
			publishedEncoding: null,
			passRevision: 0,
			savedPassRevision: 0
		})

	// Stable across renders, as the publisher's are: callbacks rebuilt every
	// render would recreate the hook's own callbacks on every render too, and
	// hide any dependency they leave out.
	const [stableActions] = useState(() => ({
		revalidate: vi.fn(),
		clearPendingDraft: vi.fn().mockResolvedValue(undefined),
		createRequestId: () => 'request-1',
		prepareGltfDocumentForUpload: vi.fn().mockResolvedValue(null),
		captureSceneThumbnail: vi.fn().mockResolvedValue(null),
		captureShadowBake: vi.fn().mockResolvedValue(null),
		resolveSource,
		recordSavedSource
	}))

	const scenePersistence: ScenePersistenceState = {
		hasModel: true,
		userId: 'user-1',
		currentSceneId,
		setCurrentSceneId: setCurrentSceneIdState,
		currentSettings,
		sceneMetaState,
		setSceneMetaState,
		lastSavedSettings,
		setLastSavedSettings,
		lastSavedSceneMeta,
		setLastSavedSceneMeta,
		lastSavedSceneId,
		setLastSavedSceneId,
		suppressDirtyDetection: false,
		hasUnsavedOriginalChoice
	}

	const { saveSceneSettings } = useSceneSaveFlow({
		scenePersistence,
		optimizationState: {
			optimizationSettings: OPTIMIZATION_SETTINGS,
			optimizationReport: null,
			clientSceneBytes: optimizationRuntime.clientSceneBytes,
			lastSavedReportSignature: optimizationRuntime.lastSavedReportSignature,
			passRevision: optimizationRuntime.passRevision,
			savedPassRevision: optimizationRuntime.savedPassRevision,
			setOptimizationRuntime
		},
		actions: { setHasUnsavedChanges, ...stableActions }
	})

	useEffect(() => {
		apiRef.current = {
			saveSceneSettings: () => saveSceneSettings(),
			setCurrentSettings,
			setLastSavedSettings,
			getLastSavedSettings: () => lastSavedSettings,
			getHasUnsavedChanges: () => hasUnsavedChanges,
			openScene: setCurrentSceneIdState,
			getSavedPassRevision: () => optimizationRuntime.savedPassRevision,
			runPass: () =>
				setOptimizationRuntime((prev) => ({
					...prev,
					passRevision: prev.passRevision + 1
				}))
		}
	}, [
		apiRef,
		hasUnsavedChanges,
		lastSavedSettings,
		optimizationRuntime.savedPassRevision,
		saveSceneSettings
	])

	return null
}

const renderHarnessWith = (props: SceneSaveFlowHarnessProps) =>
	render(<SceneSaveFlowHarness {...props} />)

const renderHarness = () => {
	const apiRef: { current: HarnessApi | null } = { current: null }
	render(
		<SceneSaveFlowHarness
			apiRef={apiRef}
			initialCurrentSettings={createSettings(2)}
			initialLastSavedSettings={createSettings(1)}
		/>
	)
	return apiRef
}

describe('useSceneSaveFlow', () => {
	beforeEach(() => {
		mockSetAtom.mockImplementation((atom: unknown) =>
			atom === dispatchSaveProgressAtom ? dispatchSaveProgress : vi.fn()
		)
		resolveSource.mockReturnValue({ kind: 'none' })
	})

	afterEach(() => {
		vi.clearAllMocks()
		getDefaultStore().set(capturedThumbnailFrameAtom, null)
	})

	/*
	  The save uploads a large picked image and commits the marker at its new
	  address. Left on the picked image, the editor would upload it again on
	  every later save.
	*/
	it('moves the editor and the baseline to the address uploaded artwork got', async () => {
		const picked = 'data:image/png;base64,AAAA'
		const uploaded = '/api/scenes/scene-1/assets/asset-1'
		const marker = {
			id: 'hotspot-1',
			name: 'Badge',
			payloadUrl: picked
		} as HotspotDefinition
		const setHotspots = vi.fn()
		mockSetAtom.mockImplementation((atom: unknown) =>
			atom === dispatchSaveProgressAtom
				? dispatchSaveProgress
				: atom === hotspotsAtom
					? setHotspots
					: vi.fn()
		)
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({
			sceneId: 'scene-1',
			sceneMeta,
			keptOriginal: null,
			hotspotArtworkRewrites: [
				{ hotspotId: 'hotspot-1', from: picked, to: uploaded }
			]
		})
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: { hotspots: [marker] },
			initialLastSavedSettings: null
		})

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		const update = setHotspots.mock.calls[0][0] as (
			previous: HotspotDefinition[]
		) => HotspotDefinition[]
		expect(update([marker])[0].payloadUrl).toBe(uploaded)
		await waitFor(() =>
			expect(
				apiRef.current?.getLastSavedSettings()?.hotspots?.[0].payloadUrl
			).toBe(uploaded)
		)
	})

	it('hands the save panel every event the save reports', async () => {
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({ unchanged: true })
		const apiRef = renderHarness()

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		expect(mockExecuteSceneSaveOrchestrator).toHaveBeenCalledWith(
			expect.objectContaining({ onProgress: dispatchSaveProgress })
		)
	})

	it('tells the save panel when a save fails', async () => {
		mockExecuteSceneSaveOrchestrator.mockRejectedValue(new Error('disk full'))
		const apiRef = renderHarness()

		await act(async () => {
			await expect(apiRef.current?.saveSceneSettings()).rejects.toThrow()
		})

		expect(dispatchSaveProgress).toHaveBeenCalledWith({
			type: 'failed',
			message: 'disk full'
		})
	})

	/*
	  The orchestrator compares the scene against this baseline to decide
	  whether the thumbnail still shows the opening frame. Every writer today
	  happens to change another input in the same render, so a stale closure
	  would only show up once one did not.
	*/
	it('hands the next save a baseline that changed on its own', async () => {
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({ unchanged: true })
		const apiRef = renderHarness()
		const rebased = createSettings(3)

		act(() => {
			apiRef.current?.setLastSavedSettings(rebased)
		})
		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		expect(mockExecuteSceneSaveOrchestrator).toHaveBeenCalledWith(
			expect.objectContaining({ lastSavedSettings: rebased })
		)
	})

	it('keeps dirty state when settings change during an in-flight save', async () => {
		const deferred = createDeferred<SaveSceneResult>()
		const baselineSettings = createSettings(1.5)
		const preSaveSettings = createSettings(2)
		const midFlightSettings = createSettings(3)
		const apiRef: { current: HarnessApi | null } = { current: null }

		mockExecuteSceneSaveOrchestrator.mockReturnValue(deferred.promise)

		render(
			<SceneSaveFlowHarness
				apiRef={apiRef}
				initialCurrentSettings={preSaveSettings}
				initialLastSavedSettings={baselineSettings}
			/>
		)

		expect(apiRef.current).not.toBeNull()

		let savePromise: Promise<
			SaveSceneResult | { unchanged: true } | undefined
		> | null = null

		act(() => {
			savePromise = apiRef.current?.saveSceneSettings() ?? null
		})

		expect(savePromise).toBeDefined()

		act(() => {
			apiRef.current?.setCurrentSettings(midFlightSettings)
		})

		await act(async () => {
			deferred.resolve({
				sceneId: 'scene-1',
				sceneMeta,
				stats: null
			})

			await savePromise
		})

		await waitFor(() => {
			expect(apiRef.current?.getLastSavedSettings()).toEqual(preSaveSettings)
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		})
	})

	it('tells the save which frame the waiting capture painted', async () => {
		const record = { thumbnailUrl: 'data:image/webp;base64,AA==', frame: 'f' }
		getDefaultStore().set(capturedThumbnailFrameAtom, record)
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({ unchanged: true })
		const apiRef = renderHarness()

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		expect(mockExecuteSceneSaveOrchestrator).toHaveBeenCalledWith(
			expect.objectContaining({ capturedThumbnailFrame: record })
		)
	})

	it('sends the original the save resolves to, and records it', async () => {
		const linked = {
			kind: 'linked',
			source: { assetId: 'original-1', url: '/a', fileName: 'source.glb' }
		}
		const keptOriginal = {
			assetId: 'original-2',
			url: '/api/scenes/s1/assets/original-2'
		}
		resolveSource.mockReturnValue(linked)
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({
			unchanged: true,
			keptOriginal
		})
		const apiRef = renderHarness()

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		expect(mockExecuteSceneSaveOrchestrator).toHaveBeenCalledWith(
			expect.objectContaining({ source: linked })
		)
		expect(recordSavedSource).toHaveBeenCalledWith(keptOriginal)
	})

	it('records nothing about the original once another scene has opened', async () => {
		let finish: (result: unknown) => void = () => {}
		mockExecuteSceneSaveOrchestrator.mockReturnValue(
			new Promise((resolve) => (finish = resolve))
		)
		const apiRef = renderHarness()

		let saving: Promise<unknown> = Promise.resolve()
		act(() => {
			saving = apiRef.current?.saveSceneSettings() ?? saving
		})
		act(() => apiRef.current?.openScene('scene-2'))
		await act(async () => {
			finish({ unchanged: true, keptOriginal: null })
			await saving
		})

		expect(recordSavedSource).not.toHaveBeenCalled()
	})

	it('reports a choice about the original as unsaved again when the save fails', async () => {
		mockExecuteSceneSaveOrchestrator.mockRejectedValue(new Error('offline'))
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings,
			hasUnsavedOriginalChoice: true
		})
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)

		await act(async () => {
			await apiRef.current?.saveSceneSettings().catch(() => {})
		})

		expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
	})

	it('reports nothing unsaved after a failed save that had nothing to save', async () => {
		mockExecuteSceneSaveOrchestrator.mockRejectedValue(new Error('offline'))
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})

		await act(async () => {
			await apiRef.current?.saveSceneSettings().catch(() => {})
		})

		expect(apiRef.current?.getHasUnsavedChanges()).toBe(false)
	})

	it('records nothing about the original when the save fails', async () => {
		mockExecuteSceneSaveOrchestrator.mockRejectedValue(new Error('offline'))
		const apiRef = renderHarness()

		await act(async () => {
			await apiRef.current?.saveSceneSettings().catch(() => {})
		})

		expect(recordSavedSource).not.toHaveBeenCalled()
	})

	// Keeping the original or not is part of what a save stores, so changing
	// that choice has to make the scene savable on its own.
	it('counts a changed choice about the original as an unsaved change', async () => {
		const settings = createSettings(1)
		const render = (hasUnsavedOriginalChoice: boolean) => {
			const apiRef: { current: HarnessApi | null } = { current: null }
			const view = renderHarnessWith({
				apiRef,
				initialCurrentSettings: settings,
				initialLastSavedSettings: settings,
				hasUnsavedOriginalChoice
			})
			return { apiRef, view }
		}

		const unchanged = render(false)
		await waitFor(() =>
			expect(unchanged.apiRef.current?.getHasUnsavedChanges()).toBe(false)
		)
		unchanged.view.unmount()

		const changed = render(true)
		await waitFor(() =>
			expect(changed.apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)
	})

	it('counts a pass since the last save as unsaved until it is saved', async () => {
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({
			sceneId: 'scene-1',
			sceneMeta,
			stats: null
		})
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(false)
		)

		act(() => apiRef.current?.runPass())
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(false)
		)
		// What opening the next scene compares against.
		expect(apiRef.current?.getSavedPassRevision()).toBe(1)
	})

	// A pass can rebuild exactly the document the scene stores; the server then
	// answers unchanged, and the scene has to read saved, not stay dirty.
	it('counts a pass as saved when the server finds nothing changed', async () => {
		mockExecuteSceneSaveOrchestrator.mockResolvedValue({ unchanged: true })
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})
		act(() => apiRef.current?.runPass())
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)

		await act(async () => {
			await apiRef.current?.saveSceneSettings()
		})

		expect(apiRef.current?.getSavedPassRevision()).toBe(1)
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(false)
		)
	})

	// The save exported the document as it was when it started.
	it('keeps a pass that finished during a save unsaved', async () => {
		const deferred = createDeferred<SaveSceneResult>()
		mockExecuteSceneSaveOrchestrator.mockReturnValue(deferred.promise)
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})

		let saving: Promise<unknown> = Promise.resolve()
		act(() => {
			saving = apiRef.current?.saveSceneSettings() ?? saving
		})
		act(() => apiRef.current?.runPass())
		await act(async () => {
			deferred.resolve({ sceneId: 'scene-1', sceneMeta, stats: null })
			await saving
		})

		expect(apiRef.current?.getSavedPassRevision()).toBe(0)
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)
	})

	it('keeps a pass unsaved when the save fails', async () => {
		mockExecuteSceneSaveOrchestrator.mockRejectedValue(new Error('offline'))
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})
		act(() => apiRef.current?.runPass())
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)

		await act(async () => {
			await apiRef.current?.saveSceneSettings().catch(() => undefined)
		})

		expect(apiRef.current?.getSavedPassRevision()).toBe(0)
		await waitFor(() =>
			expect(apiRef.current?.getHasUnsavedChanges()).toBe(true)
		)
	})

	// The next scene's runtime holds its own saved revision.
	it('records no saved pass once another scene has opened', async () => {
		const deferred = createDeferred<SaveSceneResult>()
		mockExecuteSceneSaveOrchestrator.mockReturnValue(deferred.promise)
		const settings = createSettings(1)
		const apiRef: { current: HarnessApi | null } = { current: null }
		renderHarnessWith({
			apiRef,
			initialCurrentSettings: settings,
			initialLastSavedSettings: settings
		})
		act(() => apiRef.current?.runPass())

		let saving: Promise<unknown> = Promise.resolve()
		act(() => {
			saving = apiRef.current?.saveSceneSettings() ?? saving
		})
		act(() => apiRef.current?.openScene('scene-2'))
		await act(async () => {
			deferred.resolve({ sceneId: 'scene-1', sceneMeta, stats: null })
			await saving
		})

		expect(apiRef.current?.getSavedPassRevision()).toBe(0)
	})
})
