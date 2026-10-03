// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSceneSaveFlow } from './use-scene-save-flow'
import { defaultBoundsOptions } from '../../constants/viewer-defaults'
import { dispatchSaveProgressAtom } from '../../lib/stores/save-progress-store'

import type { ScenePersistenceState } from './contracts'
import type { SceneMetaState } from '../../types/publisher-config'
import type { SaveSceneResult } from '../../types/publisher-scene'
import type { SceneOptimizationRuntimeState } from '../../types/scene-optimization'
import type { SceneSettings } from '@vctrl/core'

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
	getLastSavedSettings: () => SceneSettings | null
	getHasUnsavedChanges: () => boolean
	openScene: (sceneId: string) => void
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
			clientSceneBytes: null,
			workingSceneBytes: null,
			optimizedTextureBytes: null,
			clientTextureBytes: null,
			lastSavedReportSignature: null,
			latestSceneStats: null,
			dracoReport: null
		})

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
			optimizationSettings: {} as never,
			optimizationReport: null,
			latestSceneStats: optimizationRuntime.latestSceneStats,
			optimizedSceneBytes: optimizationRuntime.optimizedSceneBytes,
			clientSceneBytes: optimizationRuntime.clientSceneBytes,
			lastSavedReportSignature: optimizationRuntime.lastSavedReportSignature,
			setOptimizationRuntime
		},
		actions: {
			setHasUnsavedChanges,
			revalidate: vi.fn(),
			clearPendingDraft: vi.fn().mockResolvedValue(undefined),
			createRequestId: () => 'request-1',
			prepareGltfDocumentForUpload: vi.fn().mockResolvedValue(null),
			captureSceneThumbnail: vi.fn().mockResolvedValue(null),
			captureShadowBake: vi.fn().mockResolvedValue(null),
			resolveSource,
			recordSavedSource
		}
	})

	useEffect(() => {
		apiRef.current = {
			saveSceneSettings: () => saveSceneSettings(),
			setCurrentSettings,
			getLastSavedSettings: () => lastSavedSettings,
			getHasUnsavedChanges: () => hasUnsavedChanges,
			openScene: setCurrentSceneIdState
		}
	}, [apiRef, hasUnsavedChanges, lastSavedSettings, saveSceneSettings])

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
})
