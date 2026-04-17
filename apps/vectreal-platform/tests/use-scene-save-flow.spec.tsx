import { act, render, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultBoundsOptions } from '../app/constants/viewer-defaults'
import { useSceneSaveFlow } from '../app/hooks/scene-loader/use-scene-save-flow'

import type { ScenePersistenceState } from '../app/hooks/scene-loader/contracts'
import type { SaveSceneResult } from '../app/types/publisher-scene'
import type { SceneOptimizationRuntimeState } from '../app/types/scene-optimization'
import type { SceneMetaState } from '../app/types/publisher-config'
import type { SceneSettings } from '@vctrl/core'

const { mockSetAtom, mockExecuteSceneSaveOrchestrator } = vi.hoisted(() => ({
	mockSetAtom: vi.fn(() => vi.fn()),
	mockExecuteSceneSaveOrchestrator: vi.fn()
}))

vi.mock('jotai/react', async () => {
	const actual =
		await vi.importActual<typeof import('jotai/react')>('jotai/react')

	return {
		...actual,
		useSetAtom: mockSetAtom
	}
})

vi.mock('../app/lib/domain/scene', async () => {
	const actual = await vi.importActual<
		typeof import('../app/lib/domain/scene')
	>('../app/lib/domain/scene')

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
}

interface SceneSaveFlowHarnessProps {
	apiRef: { current: HarnessApi | null }
	initialCurrentSettings: SceneSettings
	initialLastSavedSettings: SceneSettings | null
}

function SceneSaveFlowHarness({
	apiRef,
	initialCurrentSettings,
	initialLastSavedSettings
}: SceneSaveFlowHarnessProps) {
	const [currentSettings, setCurrentSettings] = useState(initialCurrentSettings)
	const [sceneMetaState, setSceneMetaState] = useState(sceneMeta)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettings | null>(initialLastSavedSettings)
	const [lastSavedSceneMeta, setLastSavedSceneMeta] = useState(sceneMeta)
	const [lastSavedSceneId, setLastSavedSceneId] = useState<string | null>(
		'scene-1'
	)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [, setCurrentSceneIdState] = useState<string | null>('scene-1')
	const [optimizationRuntime, setOptimizationRuntime] =
		useState<SceneOptimizationRuntimeState>({
			isPending: false,
			isSceneSizeLoading: false,
			optimizedSceneBytes: null,
			clientSceneBytes: null,
			optimizedTextureBytes: null,
			clientTextureBytes: null,
			lastSavedReportSignature: null,
			latestSceneStats: null
		})

	const scenePersistence: ScenePersistenceState = {
		userId: 'user-1',
		currentSceneId: 'scene-1',
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
		isInitializing: false
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
			maxConcurrentAssetUploadsDefault: 4
		}
	})

	useEffect(() => {
		apiRef.current = {
			saveSceneSettings: () => saveSceneSettings(),
			setCurrentSettings,
			getLastSavedSettings: () => lastSavedSettings,
			getHasUnsavedChanges: () => hasUnsavedChanges
		}
	}, [apiRef, hasUnsavedChanges, lastSavedSettings, saveSceneSettings])

	return null
}

describe('useSceneSaveFlow', () => {
	afterEach(() => {
		vi.clearAllMocks()
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
})
