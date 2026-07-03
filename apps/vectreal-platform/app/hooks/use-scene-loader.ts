import { usePostHog } from '@posthog/react'
import { type SceneSettings, type ServerSceneData } from '@vctrl/core'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import {
	type EventHandler,
	type ModelFile,
	type StructuredLoadError,
	fetchManifestAssetData,
	useModelContext
} from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { useSceneAggregateBootstrap } from './scene-loader/use-scene-aggregate-bootstrap'
import { useSceneDraftRehydration } from './scene-loader/use-scene-draft-rehydration'
import { useSceneModelEvents } from './scene-loader/use-scene-model-events'
import { useSceneParamsSync } from './scene-loader/use-scene-params-sync'
import { useSceneSaveFlow } from './scene-loader/use-scene-save-flow'
import { useConsent } from '../components/consent/consent-context'
import { optimizationPresets } from '../constants/optimizations'
import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultShadowOptions,
	normalizeShadowOptions
} from '../constants/viewer-defaults'
import { buildSceneUploadFailedAnalyticsProps } from '../lib/domain/analytics/scene-events'
import {
	calculateAggregateReferencedBytes,
	executeAggregateSceneHydration,
	executeOptimizationStateHydration,
	inferOptimizationPreset,
	persistPendingSceneDraftOrchestrator,
	getSceneNameFromFileName,
	serializeSceneAssetData
} from '../lib/domain/scene'
import {
	clearPendingSceneDraft,
	saveOriginalSceneModel
} from '../lib/persistence/pending-scene-idb'
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
	bakedShadowSourceAtom,
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	hotspotsAtom,
	interactionsAtom,
	normalizationAtom,
	rawModelDiagonalAtom,
	shadowsAtom
} from '../lib/stores/scene-settings-store'

import type { SceneAggregateResponse, SceneManifestResponse } from '../types/api'
import type { SceneMetaState } from '../types/publisher-config'
import type { SceneScreenshotOptions, ShadowBakeResult } from '@vctrl/viewer'

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
	initialSceneAggregate?: SceneManifestResponse | null
	sceneMeta?: SceneMetaState | null
	requestSceneScreenshot?: (
		options?: SceneScreenshotOptions
	) => Promise<null | string>
	requestShadowBake?: () => Promise<ShadowBakeResult | null>
}

const DEFAULT_THUMBNAIL_CAPTURE_OPTIONS = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp' as const,
	quality: 0.86,
	mode: 'auto-fit' as const
}

function mapStructuredLoadErrorMessage(error: StructuredLoadError): string {
	switch (error.code) {
		case 'missing_assets':
			return 'Model references missing assets. Upload the full model folder (including textures/buffers) and retry.'
		case 'unsupported_format':
			return 'Unsupported model format. Upload a .gltf, .glb, or .usdz file.'
		case 'quota_exceeded':
			return 'Upload limit reached for this plan. Upgrade to continue uploading models.'
		case 'not_found':
			return 'Scene could not be found. Refresh and try again.'
		default:
			return error.message || 'Failed to load model'
	}
}

function isStructuredLoadError(error: unknown): error is StructuredLoadError {
	if (!error || typeof error !== 'object') {
		return false
	}

	const candidate = error as Partial<StructuredLoadError>
	return (
		typeof candidate.code === 'string' &&
		typeof candidate.message === 'string' &&
		typeof candidate.recoverable === 'boolean' &&
		typeof candidate.source === 'string'
	)
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
		sceneMeta = null,
		requestSceneScreenshot,
		requestShadowBake
	} = params === null
		? {
				sceneId: null,
				userId: undefined,
				initialSceneAggregate: null,
				sceneMeta: null,
				requestSceneScreenshot: undefined,
				requestShadowBake: undefined
			}
		: params

	const sceneLoadAttemptedRef = useRef(false)
	const pendingSceneHydratedRef = useRef(false)
	const originalSavedRef = useRef(false)
	const lastLoadErrorToastRef = useRef<{
		signature: string
		at: number
	} | null>(null)
	const loadStartTimeRef = useRef<number | null>(null)
	const posthog = usePostHog()
	const { consent } = useConsent()
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
	const [interactions, setInteractions] = useAtom(interactionsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [controls, setControls] = useAtom(controlsAtom)
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [normalization, setNormalization] = useAtom(normalizationAtom)
	const setBakedShadowSource = useSetAtom(bakedShadowSourceAtom)
	const setRawModelDiagonal = useSetAtom(rawModelDiagonalAtom)
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)

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
		if (!requestSceneScreenshot) {
			return null
		}

		try {
			// Get the default/first scene camera ID to capture from
			const defaultCameraId =
				camera.cameras?.find((c) => !c.kind || c.kind === 'scene')?.cameraId ??
				camera.cameras?.[0]?.cameraId ??
				undefined

			return await requestSceneScreenshot({
				...DEFAULT_THUMBNAIL_CAPTURE_OPTIONS,
				// Capture from the default camera perspective for seamless loading
				targetCameraId: defaultCameraId
			})
		} catch (error) {
			console.warn('[scene-settings] thumbnail capture failed', {
				sceneId: currentSceneId || null,
				error
			})
			return null
		}
	}, [currentSceneId, camera.cameras, requestSceneScreenshot])

	const captureShadowBake = useCallback(async (): Promise<ShadowBakeResult | null> => {
		if (!requestShadowBake) {
			return null
		}
		try {
			return await requestShadowBake()
		} catch (error) {
			console.warn('[scene-settings] shadow bake capture failed', {
				sceneId: currentSceneId || null,
				error
			})
			return null
		}
	}, [currentSceneId, requestShadowBake])

	// Get current settings from atoms
	const currentSettings: SceneSettings = useMemo(
		() => ({
			bounds,
			environment,
			interactions,
			camera,
			controls,
			shadows,
			normalization,
			hotspots: hotspots.length > 0 ? hotspots : undefined
		}),
		[bounds, environment, interactions, camera, controls, shadows, normalization, hotspots]
	)

	const resetSceneState = useCallback(() => {
		setBounds(defaultBoundsOptions)
		setEnv(defaultEnvOptions)
		setInteractions(undefined)
		setCamera(defaultCameraOptions)
		setControls(defaultControlsOptions)
		setShadows(defaultShadowOptions)
		setNormalization(defaultNormalizationOptions)
		setHotspots([])
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
		setNormalization,
		setHotspots,
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

			if (!paramSceneId && consent?.analytics) {
				const fileFormat = data.name.includes('.')
					? data.name.split('.').pop()?.toLowerCase() ?? 'unknown'
					: 'unknown'
				const duration_ms =
					loadStartTimeRef.current != null
						? Date.now() - loadStartTimeRef.current
						: undefined
				posthog?.capture('scene_upload_succeeded', {
					file_format: fileFormat,
					duration_ms
				})
			}
		},
		[
			paramSceneId,
			consent?.analytics,
			posthog,
			currentSettings,
			setCurrentSceneId,
			setProcess,
			getSceneNameFromFileName,
			setSceneMetaState
		]
	) as EventHandler<'load-complete'>

	const handleLoadError = useCallback(
		(error: unknown) => {
			console.error('Load error:', error)

			let errorMessage = 'Failed to load model'
			let analyticsProps: ReturnType<
				typeof buildSceneUploadFailedAnalyticsProps
			> | null = null
			if (isStructuredLoadError(error)) {
				errorMessage = mapStructuredLoadErrorMessage(error)
				analyticsProps = buildSceneUploadFailedAnalyticsProps(
					error,
					errorMessage
				)
			} else if (error instanceof Error) {
				errorMessage = error.message
			} else if (typeof error === 'string') {
				errorMessage = error
			}

			const signature = `${analyticsProps?.error_code ?? 'unknown'}:${errorMessage}`
			const now = Date.now()
			const isDuplicateToast =
				lastLoadErrorToastRef.current?.signature === signature &&
				now - lastLoadErrorToastRef.current.at < 2000

			if (!isDuplicateToast) {
				toast.error(errorMessage)
				lastLoadErrorToastRef.current = { signature, at: now }
			}

			if (consent?.analytics) {
				if (analyticsProps) {
					posthog?.capture('scene_upload_failed', analyticsProps)
				} else {
					posthog?.capture('scene_upload_failed', {
						file_format: 'unknown',
						error_code: 'unknown',
						error_message: errorMessage
					})
				}
			}
		},
		[consent?.analytics, posthog]
	)

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
			setInteractions(settings.interactions)
			setCamera(settings.camera || defaultCameraOptions)
			setControls(settings.controls || defaultControlsOptions)
			setShadows(normalizeShadowOptions(settings.shadows))
			setNormalization(settings.normalization || defaultNormalizationOptions)
			setRawModelDiagonal(0)
			setHotspots(settings.hotspots ?? [])

			const loadedSettings: SceneSettings = {
				bounds: settings.bounds || defaultBoundsOptions,
				environment: settings.environment || defaultEnvOptions,
				interactions: settings.interactions,
				camera: settings.camera || defaultCameraOptions,
				controls: settings.controls || defaultControlsOptions,
				shadows: normalizeShadowOptions(settings.shadows),
				normalization: settings.normalization || defaultNormalizationOptions,
				hotspots: settings.hotspots
			}
			setLastSavedSettings(loadedSettings)
		},
		[
			setBounds,
			setCamera,
			setControls,
			setEnv,
			setHotspots,
			setInteractions,
			setNormalization,
			setRawModelDiagonal,
			setShadows
		]
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
		async (sceneId: string, manifest: SceneManifestResponse) => {
			if (sceneLoadAttemptedRef.current) {
				return
			}

			sceneLoadAttemptedRef.current = true
			setIsDownloading(true)

			try {
				const assetData = manifest.assetRefs
					? await fetchManifestAssetData(manifest.assetRefs)
					: {}

				const aggregate: SceneAggregateResponse = {
					sceneId: manifest.sceneId,
					meta: manifest.meta,
					stats: manifest.stats,
					settings: manifest.settings,
					gltfJson: manifest.gltfJson,
					assetData,
					assets: manifest.assets
				}

				const sceneName = await executeAggregateSceneHydration({
					sceneId,
					aggregate,
					hydrateOptimizationState,
					applySceneSettings,
					applyBakedShadowSource: setBakedShadowSource,
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
			setBakedShadowSource,
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
		captureShadowBake
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
		locationPathname: location.pathname
	}

	const draftHydrationActions = {
		setIsDownloading,
		loadFromData,
		setSceneMetaState,
		setLastSavedSceneMeta,
		onRestoreHandled: handleRestoreHandled
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

	// Reset the save guard when a genuinely new file is dropped by the user.
	// Using load-start (not file?.model) because applyOptimization() also changes
	// file.model after each optimization pass - we must NOT reset the guard then,
	// or the save effect would re-fire and overwrite IDB with an optimized snapshot.
	useEffect(() => {
		const handleLoadStart = () => {
			originalSavedRef.current = false
			loadStartTimeRef.current = Date.now()
		}
		on('load-start', handleLoadStart)
		on('load-reset', handleLoadStart)
		return () => {
			off('load-start', handleLoadStart)
			off('load-reset', handleLoadStart)
		}
	}, [on, off])

	// Stable refs so the save effect below can read current values without
	// listing them as dependencies (which would re-trigger the effect on every
	// scene-meta or settings change, including those caused by applyOptimization).
	const prepareGltfRef = useRef(prepareGltfDocumentForUpload)
	const sceneMetaRef = useRef(sceneMetaState)
	const settingsRef = useRef(currentSettings)
	useEffect(() => {
		prepareGltfRef.current = prepareGltfDocumentForUpload
	})
	useEffect(() => {
		sceneMetaRef.current = sceneMetaState
	})
	useEffect(() => {
		settingsRef.current = currentSettings
	})

	// Capture and persist the original un-optimized scene to IDB immediately
	// after the optimizer finishes loading a locally uploaded file.
	// Skipped for server-loaded scenes (paramSceneId / initialSceneAggregate).
	// Guarded by originalSavedRef so it only runs once per file drop - the ref
	// is reset by the load-start listener above, never by applyOptimization.
	useEffect(() => {
		if (!optimizer?.isReady) return
		if (paramSceneId || initialSceneAggregate) return
		if (originalSavedRef.current) return
		originalSavedRef.current = true

		void (async () => {
			const gltfJson = await prepareGltfRef.current()
			if (!gltfJson || typeof gltfJson !== 'object') return

			const gltfData = (gltfJson as { data?: unknown }).data ?? gltfJson
			const gltfAssets = (gltfJson as { assets?: unknown }).assets
			const assetData = await serializeSceneAssetData(gltfData, gltfAssets)

			const meta = sceneMetaRef.current
			const settings = settingsRef.current

			const sceneData: ServerSceneData = {
				meta: {
					name: meta.name,
					description: meta.description,
					thumbnailUrl: meta.thumbnailUrl
				},
				gltfJson: gltfData as ServerSceneData['gltfJson'],
				assetData,
				...settings
			}

			await saveOriginalSceneModel({ sceneData })
		})()
	}, [optimizer?.isReady, paramSceneId, initialSceneAggregate])

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
