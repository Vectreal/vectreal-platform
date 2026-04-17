import { type SceneSettings } from '@vctrl/core'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import {
	type EventHandler,
	type ModelFile,
	useModelContext
} from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { useSceneAggregateBootstrap } from './scene-loader/use-scene-aggregate-bootstrap'
import { useSceneDraftRehydration } from './scene-loader/use-scene-draft-rehydration'
import { useSceneModelEvents } from './scene-loader/use-scene-model-events'
import { useSceneParamsSync } from './scene-loader/use-scene-params-sync'
import { useSceneSaveFlow } from './scene-loader/use-scene-save-flow'
import { optimizationPresets } from '../constants/optimizations'
import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions
} from '../constants/viewer-defaults'
import {
	calculateAggregateReferencedBytes,
	executeAggregateSceneHydration,
	executeOptimizationStateHydration,
	inferOptimizationPreset,
	persistPendingSceneDraftOrchestrator,
	getSceneNameFromFileName
} from '../lib/domain/scene'
import { clearPendingSceneDraft } from '../lib/persistence/pending-scene-idb'
import {
	processAtom,
	sceneMetaAtom,
	sceneMetaInitialState,
	lastSavedSettingsAtom,
	lastSavedSceneMetaAtom,
	lastSavedSceneIdAtom
} from '../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../lib/stores/scene-optimization-store'
import {
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	shadowsAtom
} from '../lib/stores/scene-settings-store'
import { requestSceneScreenshot } from '../lib/viewer/scene-screenshot-bus'

import type { SceneAggregateResponse } from '../types/api'
import type { SceneMetaState } from '../types/publisher-config'

export type {
	SaveLocationTarget,
	SaveSceneResult,
	SaveSceneFn
} from '../types/publisher-scene'
export type {
	SaveAvailabilityReason,
	SaveAvailabilityState
} from '../lib/domain/scene'

export interface UseSceneLoaderParams {
	sceneId: null | string
	userId?: string
	initialSceneAggregate?: SceneAggregateResponse | null
	sceneMeta?: SceneMetaState | null
}

const DEFAULT_MAX_CONCURRENT_SCENE_ASSET_UPLOADS = 4
const DEFAULT_THUMBNAIL_CAPTURE_OPTIONS = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp' as const,
	quality: 0.86,
	mode: 'auto-fit' as const
}

/**
 * Manages scene load/save side effects and shared store synchronization.
 *
 * This hook keeps scene state in Jotai/model context as the source of truth,
 * while exposing only `saveSceneSettings` for UI actions.
 *
 * Internal state (`currentSceneId`, `lastSavedSettings`) is used for
 * orchestration/change tracking and is intentionally not returned.
 */
export function useSceneLoader(params: UseSceneLoaderParams | null = null) {
	// Handle nullable params by applying defaults
	const {
		sceneId: paramSceneId,
		userId,
		initialSceneAggregate = null,
		sceneMeta = null
	} = params === null
		? {
				sceneId: null,
				userId: undefined,
				initialSceneAggregate: null,
				sceneMeta: null
			}
		: params

	const sceneLoadAttemptedRef = useRef(false)
	const pendingSceneHydratedRef = useRef(false)
	// Last-saved baselines live in atoms (not useState) so they survive route
	// transitions without being reset by component remounting.
	const [lastSavedSettings, setLastSavedSettings] = useAtom(
		lastSavedSettingsAtom
	)
	const [lastSavedSceneMeta, setLastSavedSceneMeta] = useAtom(
		lastSavedSceneMetaAtom
	)
	// Tracks the scene ID of the last completed save, used to detect post-save
	// navigation so useSceneParamsSync can skip destructive resets.
	const [lastSavedSceneId, setLastSavedSceneId] = useAtom(lastSavedSceneIdAtom)
	const [currentSceneId, setCurrentSceneId] = useState<string | null>(
		paramSceneId
	)
	const revalidator = useRevalidator()
	const location = useLocation()
	const navigate = useNavigate()
	const shouldRestorePendingDraft =
		new URLSearchParams(location.search).get('restore_draft') === '1'
	const pendingDraftId =
		new URLSearchParams(location.search).get('draft_id') || null

	const handleRestoreHandled = useCallback(() => {
		if (!shouldRestorePendingDraft) {
			return
		}

		const searchParams = new URLSearchParams(location.search)
		if (!searchParams.has('restore_draft')) {
			return
		}

		searchParams.delete('restore_draft')
		searchParams.delete('draft_id')
		const nextSearch = searchParams.toString()

		navigate(
			{
				pathname: location.pathname,
				search: nextSearch ? `?${nextSearch}` : ''
			},
			{ replace: true }
		)
	}, [location.pathname, location.search, navigate, shouldRestorePendingDraft])

	// Model context and loading
	const {
		isFileLoading,
		file,
		on,
		off,
		loadFromData,
		optimizer,
		file: modelFile
	} = useModelContext()
	const { handleDocumentGltfExport } = useExportModel()

	// Scene state atoms
	const [bounds, setBounds] = useAtom(boundsAtom)
	const [environment, setEnv] = useAtom(environmentAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [controls, setControls] = useAtom(controlsAtom)
	const [shadows, setShadows] = useAtom(shadowsAtom)

	// Process state atom - use full atom access for reading and writing
	const [sceneMetaState, setSceneMetaState] = useAtom(sceneMetaAtom)
	const [processState, setProcess] = useAtom(processAtom)
	const [, setOptimizationState] = useAtom(optimizationAtom)
	const { optimizations: optimizationSettings } = useAtomValue(optimizationAtom)
	const [optimizationRuntime, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)
	const {
		lastSavedReportSignature,
		latestSceneStats,
		optimizedSceneBytes,
		clientSceneBytes
	} = optimizationRuntime
	const { isInitializing } = processState

	// Helper functions to update specific process state fields
	const setIsDownloading = useCallback(
		(loading: boolean) => {
			setProcess((prev) => ({
				...prev,
				isLoading: loading
			}))
		},
		[setProcess]
	)

	const setIsInitializing = useCallback(
		(initializing: boolean) => {
			setProcess((prev) => ({
				...prev,
				isInitializing: initializing
			}))
		},
		[setProcess]
	)

	const setHasUnsavedChanges = useCallback(
		(hasChanges: boolean) => {
			setProcess((prev) => ({
				...prev,
				hasUnsavedChanges: hasChanges
			}))
		},
		[setProcess]
	)

	const createRequestId = useCallback(() => {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID()
		}

		return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	}, [])

	const prepareGltfDocumentForUpload = useCallback(async () => {
		if (!optimizer || !modelFile || !optimizer.isReady) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
		if (!gltfDocument) {
			return null
		}

		const gltfJson = await handleDocumentGltfExport(
			gltfDocument,
			modelFile,
			false,
			false
		)

		if (!gltfJson || typeof gltfJson !== 'object' || !('assets' in gltfJson)) {
			return gltfJson
		}

		return gltfJson
	}, [optimizer, modelFile, handleDocumentGltfExport])

	const captureSceneThumbnail = useCallback(async (): Promise<
		null | string
	> => {
		try {
			return await requestSceneScreenshot(DEFAULT_THUMBNAIL_CAPTURE_OPTIONS)
		} catch (error) {
			console.warn('[scene-settings] thumbnail capture failed', {
				sceneId: currentSceneId || null,
				error
			})
			return null
		}
	}, [currentSceneId])

	// Get current settings from atoms
	const currentSettings: SceneSettings = useMemo(
		() => ({
			bounds,
			environment,
			camera,
			controls,
			shadows
		}),
		[bounds, environment, camera, controls, shadows]
	)

	const resetSceneState = useCallback(() => {
		setBounds(defaultBoundsOptions)
		setEnv(defaultEnvOptions)
		setCamera(defaultCameraOptions)
		setControls(defaultControlsOptions)
		setShadows(defaultShadowOptions)
		setSceneMetaState(sceneMetaInitialState)
		setLastSavedSettings(null)
		setLastSavedSceneMeta(null)
		setLastSavedSceneId(null)
		setHasUnsavedChanges(false)
		setOptimizationRuntime({
			...optimizationRuntimeInitialState,
			lastSavedReportSignature: null
		})
	}, [
		setBounds,
		setEnv,
		setCamera,
		setControls,
		setShadows,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		setLastSavedSceneId,
		setHasUnsavedChanges,
		setOptimizationRuntime
	])

	// Model loading event handlers
	const handleNotLoadedFiles = useCallback((files?: File[]) => {
		toast.error(`Not loaded files: ${files?.map((f) => f.name).join(', ')}`)
	}, [])

	const handleLoadComplete = useCallback(
		(data: ModelFile) => {
			if (!data) {
				toast.error('Loaded data is empty')
				return
			}

			// Only show toast if this is NOT a scene being loaded
			if (!paramSceneId) {
				toast.success(`Loaded ${data.name}`)
			}

			if (!paramSceneId) {
				// A newly dropped model in upload flow must always start as a new
				// unsaved scene. Clearing the id keeps first-optimization gating
				// deterministic even after saving a previous upload.
				setCurrentSceneId(null)

				setLastSavedSettings({
					...currentSettings
				})

				const initialSceneName = getSceneNameFromFileName(data.name)
				setSceneMetaState((prev) => ({
					...prev,
					name: initialSceneName
				}))
			}

			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: true,
				showSidebar: false
			}))
		},
		[
			paramSceneId,
			currentSettings,
			setCurrentSceneId,
			setProcess,
			getSceneNameFromFileName,
			setSceneMetaState
		]
	) as EventHandler<'load-complete'>

	const handleLoadError = useCallback((error: unknown) => {
		console.error('Load error:', error)

		let errorMessage = 'Failed to load model'
		if (error instanceof Error) {
			errorMessage = error.message
		} else if (typeof error === 'string') {
			errorMessage = error
		}

		toast.error(errorMessage)
	}, [])

	useSceneModelEvents({
		on,
		off,
		handleNotLoadedFiles,
		handleLoadComplete,
		handleLoadError
	})

	// Update process step when file loads
	useEffect(() => {
		if (file?.model) {
			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: false
			}))
		}
	}, [file, setProcess])

	const routeSyncState = {
		paramSceneId,
		sceneMeta,
		initialSceneAggregate,
		lastSavedSceneId
	}

	const routeSyncActions = {
		resetSceneState,
		setCurrentSceneId,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime,
		setLastSavedSceneId
	}

	useSceneParamsSync({
		routeState: routeSyncState,
		actions: routeSyncActions
	})

	/**
	 * Apply scene settings to atoms and track as saved state
	 */
	const applySceneSettings = useCallback(
		(settings: SceneSettings) => {
			setBounds(settings.bounds || defaultBoundsOptions)
			setEnv(settings.environment || defaultEnvOptions)
			setCamera(settings.camera || defaultCameraOptions)
			setControls(settings.controls || defaultControlsOptions)
			setShadows(settings.shadows || defaultShadowOptions)

			const loadedSettings: SceneSettings = {
				bounds: settings.bounds || defaultBoundsOptions,
				environment: settings.environment || defaultEnvOptions,
				camera: settings.camera || defaultCameraOptions,
				controls: settings.controls || defaultControlsOptions,
				shadows: settings.shadows || defaultShadowOptions
			}
			setLastSavedSettings(loadedSettings)
		},
		[setBounds, setCamera, setControls, setEnv, setShadows]
	)

	const hydrateOptimizationState = useCallback(
		(aggregate: SceneAggregateResponse | null) => {
			executeOptimizationStateHydration({
				aggregate,
				calculateAggregateReferencedBytes,
				inferOptimizationPreset,
				setOptimizationState,
				setOptimizationRuntime,
				optimizationRuntimeInitialState,
				mediumOptimizations: optimizationPresets.medium
			})
		},
		[
			calculateAggregateReferencedBytes,
			inferOptimizationPreset,
			optimizationRuntimeInitialState,
			setOptimizationRuntime,
			setOptimizationState
		]
	)

	const loadSceneFromAggregate = useCallback(
		async (sceneId: string, aggregate: SceneAggregateResponse) => {
			if (sceneLoadAttemptedRef.current) {
				return
			}

			sceneLoadAttemptedRef.current = true
			setIsDownloading(true)

			try {
				const sceneName = await executeAggregateSceneHydration({
					sceneId,
					aggregate,
					hydrateOptimizationState,
					applySceneSettings,
					setSceneMetaState,
					setLastSavedSceneMeta,
					loadFromData
				})
				toast.success(`Loaded scene: ${sceneName}`)
			} catch (error) {
				sceneLoadAttemptedRef.current = false
				console.error('Failed to load scene from bootstrap data:', error)
				toast.error(
					`Failed to load scene: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
			} finally {
				setIsDownloading(false)
			}
		},
		[
			hydrateOptimizationState,
			applySceneSettings,
			setSceneMetaState,
			setLastSavedSceneMeta,
			loadFromData,
			setIsDownloading
		]
	)

	/**
	 * Stores the current scene in IndexedDB before redirecting to auth.
	 *
	 * This preserves local publisher progress across OAuth/email auth navigations.
	 * Returns the draft id string on success (to embed in the redirect URL for
	 * cross-tab restoration) or false on failure.
	 */
	const persistPendingSceneDraft = useCallback(async () => {
		return persistPendingSceneDraftOrchestrator({
			modelAvailable: Boolean(modelFile),
			prepareGltfDocumentForUpload,
			sceneMetaState,
			currentSettings,
			optimizationSettings: optimizationSettings ?? null,
			optimizedSceneBytes: optimizedSceneBytes ?? null,
			clientSceneBytes: clientSceneBytes ?? null
		})
	}, [
		modelFile,
		prepareGltfDocumentForUpload,
		sceneMetaState,
		currentSettings,
		optimizationSettings,
		optimizedSceneBytes,
		clientSceneBytes
	])

	const scenePersistence = {
		userId,
		currentSceneId,
		setCurrentSceneId,
		currentSettings,
		sceneMetaState,
		setSceneMetaState,
		lastSavedSettings,
		setLastSavedSettings,
		lastSavedSceneMeta,
		setLastSavedSceneMeta,
		lastSavedSceneId,
		setLastSavedSceneId,
		isInitializing
	}

	const optimizationSaveState = {
		optimizationSettings,
		optimizationReport: optimizer?.report,
		latestSceneStats,
		optimizedSceneBytes,
		clientSceneBytes,
		lastSavedReportSignature,
		setOptimizationRuntime
	}

	const saveFlowActions = {
		setHasUnsavedChanges,
		revalidate: () => revalidator.revalidate(),
		clearPendingDraft: clearPendingSceneDraft,
		createRequestId,
		prepareGltfDocumentForUpload,
		captureSceneThumbnail,
		maxConcurrentAssetUploadsDefault: DEFAULT_MAX_CONCURRENT_SCENE_ASSET_UPLOADS
	}

	const { saveSceneSettings, saveAvailability } = useSceneSaveFlow({
		scenePersistence,
		optimizationState: optimizationSaveState,
		actions: saveFlowActions
	})

	const draftRestoreRequest = {
		pendingSceneHydratedRef,
		shouldRestorePendingDraft,
		draftId: pendingDraftId,
		paramSceneId,
		initialSceneAggregate,
		fileModel: file?.model,
		isFileLoading,
		locationPathname: location.pathname,
		onRestoreHandled: handleRestoreHandled
	}

	const draftHydrationActions = {
		setIsDownloading,
		loadFromData,
		setSceneMetaState,
		setLastSavedSceneMeta
	}

	const draftOptimizationActions = {
		inferOptimizationPreset,
		setOptimizationState,
		setOptimizationRuntime
	}

	useSceneDraftRehydration({
		restoreRequest: draftRestoreRequest,
		hydrationActions: draftHydrationActions,
		optimizationActions: draftOptimizationActions
	})

	const aggregateBootstrapState = {
		sceneLoadAttemptedRef,
		paramSceneId,
		initialSceneAggregate,
		fileModel: file?.model,
		isFileLoading
	}

	const aggregateBootstrapActions = {
		setIsInitializing,
		loadSceneFromAggregate
	}

	useSceneAggregateBootstrap({
		bootstrapState: aggregateBootstrapState,
		actions: aggregateBootstrapActions
	})

	return { saveSceneSettings, saveAvailability, persistPendingSceneDraft }
}
