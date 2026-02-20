import type {
	OptimizationReport,
	Optimizations,
	SceneSettings
} from '@vctrl/core'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import {
	reconstructGltfFiles,
	useModelContext
} from '@vctrl/hooks/use-load-model'
import type {
	EventHandler,
	ModelFile,
	ServerSceneData,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model/types'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { optimizationPresets } from '../constants/optimizations'
import {
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions
} from '../constants/viewer-defaults'
import { processAtom } from '../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../lib/stores/scene-optimization-store'
import {
	cameraAtom,
	controlsAtom,
	environmentAtom,
	metaAtom,
	shadowsAtom
} from '../lib/stores/scene-settings-store'
import type { SceneAggregateResponse, SceneStatsData } from '../types/api'
import { OptimizationPreset } from '../types/scene-optimization'

export interface UseSceneLoaderParams {
	sceneId: null | string
	userId?: string
	autoLoad?: boolean // Control whether to auto-load scene on mount
	initialSceneAggregate?: SceneAggregateResponse | null
}

export interface SaveSceneResult {
	sceneId?: string
	stats?: SceneStatsData | null
	unchanged?: boolean
	[key: string]: unknown
}

/**
 * Unified hook to handle scene loading and settings management.
 *
 * ## Architecture & State Management
 *
 * This hook follows a "single source of truth" pattern by:
 * 1. Managing scene-specific operations (load, save) as actions
 * 2. Reading/writing to shared Jotai atoms for ALL shared state
 * 3. Returning only scene actions needed by consumers
 *
 * ### State Sources (Single Source of Truth):
 * - **Scene Settings**: `scene-settings-store` atoms (environment, camera, controls, shadows, meta)
 *   - Access via: `useAtomValue(environmentAtom)`, etc.
 * - **Process State**: `publisher-config-store.processAtom` (isInitializing, hasUnsavedChanges, isLoading, step, showSidebar, showInfo)
 *   - Access via: `useAtomValue(processAtom)` or `useAtom(processAtom)`
 * - **Model State**: `useModelContext()` (file, isFileLoading, reset, loadFromServer, etc.)
 *   - Access via: `const { file } = useModelContext()`
 * - **Hook-Local State** (NOT shared and not returned):
 *   - `currentSceneId` - Active scene ID tracking
 *   - `lastSavedSettings` - Baseline for change detection (internal comparison state)
 *
 * ### What This Hook Returns:
 * Returns only the action consumed by layout/publishing UI:
 * - `saveSceneSettings: () => Promise<SaveSceneResult>` - Save current settings to server
 *
 * ### What This Hook Does NOT Return (access via atoms/context instead):
 * ❌ Do NOT return these - they create duplicate state and violate single source of truth:
 * - `environment`, `camera`, `controls`, `shadows`, `meta` → Use `scene-settings-store` atoms
 * - `file`, `isFileLoading` → Use `useModelContext()`
 * - `isInitializing`, `hasUnsavedChanges`, `isLoading`, `step` → Use `processAtom`
 * - `currentSceneId`, `lastSavedSettings`, `currentSettings` → Internal hook state only
 *
 * ### Side Effects:
 * This hook automatically:
 * - Loads scene on mount when `sceneId` is provided and `autoLoad` is true
 * - Tracks unsaved changes by comparing current settings with `lastSavedSettings`
 * - Updates `processAtom.hasUnsavedChanges` when changes are detected
 * - Updates `processAtom.isInitializing` during scene load
 * - Updates `processAtom.isLoading` during downloads
 * - Subscribes to model load events and updates meta/process state
 *
 * @example
 * ```tsx
 * // ✅ CORRECT: In parent layout component
 * import { useAtomValue } from 'jotai'
 * import { processAtom } from '../stores/publisher-config-store'
 * import { environmentAtom } from '../stores/scene-settings-store'
 *
 * const Layout = ({ sceneId, userId }) => {
 *   // Call hook once in parent - it manages state via atoms
 *   const { saveSceneSettings } = useSceneLoader({ sceneId, userId })
 *
 *   // Access state directly from atoms
 *   const { hasUnsavedChanges, isInitializing } = useAtomValue(processAtom)
 *   const env = useAtomValue(environmentAtom)
 *
 *   // Pass only actions to children
 *   return (
 *     <SaveButton
 *       saveSceneSettings={saveSceneSettings}
 *       hasUnsavedChanges={hasUnsavedChanges}
 *     />
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // ❌ INCORRECT: Multiple hook instances
 * const Component1 = () => {
 *   const { saveSceneSettings } = useSceneLoader({ sceneId, userId }) // Instance A
 *   // ...
 * }
 *
 * const Component2 = () => {
 *   const { saveSceneSettings } = useSceneLoader({ sceneId, userId }) // Instance B ❌ Duplicate!
 *   // Each instance has separate lastSavedSettings state!
 * }
 * ```
 *
 * @param params - Configuration object
 * @param params.sceneId - Scene ID to load (null for new scene)
 * @param params.userId - User ID for saving operations
 * @param params.autoLoad - Whether to auto-load scene on mount (default: true)
 */
export function useSceneLoader(params: UseSceneLoaderParams | null = null) {
	// Handle nullable params by applying defaults
	const {
		sceneId: paramSceneId,
		userId,
		autoLoad = true,
		initialSceneAggregate = null
	} = params === null
		? {
				sceneId: null,
				userId: undefined,
				autoLoad: true,
				initialSceneAggregate: null
			}
		: params

	const sceneLoadAttemptedRef = useRef(false)
	const inFlightSaveRef = useRef<Promise<
		SaveSceneResult | { unchanged: true } | undefined
	> | null>(null)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettings | null>(null)
	const [currentSceneId, setCurrentSceneId] = useState<string | null>(
		paramSceneId
	)
	// Model context and loading
	const {
		isFileLoading,
		file,
		on,
		off,
		load,
		loadFromServer,
		optimizer,
		file: modelFile
	} = useModelContext()
	const { handleDocumentGltfExport } = useExportModel()

	// Scene state atoms
	const [env, setEnv] = useAtom(environmentAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [controls, setControls] = useAtom(controlsAtom)
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [meta, setMeta] = useAtom(metaAtom)

	// Process state atom - use full atom access for reading and writing
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

	const calculateAggregateSceneBytes = useCallback(
		(aggregate: SceneAggregateResponse | null) => {
			if (!aggregate?.gltfJson && !aggregate?.assetData) {
				return null
			}

			const gltfBytes = aggregate.gltfJson
				? new TextEncoder().encode(JSON.stringify(aggregate.gltfJson))
						.byteLength
				: 0

			const assetBytes = aggregate.assetData
				? Object.values(aggregate.assetData).reduce(
						(total, asset) => total + asset.data.length,
						0
					)
				: 0

			return gltfBytes + assetBytes
		},
		[]
	)

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

	// Get current settings from atoms
	const currentSettings: SceneSettings = useMemo(
		() => ({
			environment: env,
			camera,
			controls,
			shadows,
			meta
		}),
		[env, camera, controls, shadows, meta]
	)

	const createRequestId = useCallback(() => {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID()
		}

		return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	}, [])

	const serializeGltfDocument = useCallback(async () => {
		if (!optimizer || !modelFile || !optimizer._getDocument()) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
		const gltfJson = await handleDocumentGltfExport(
			gltfDocument,
			modelFile,
			false,
			false
		)

		if (!gltfJson || typeof gltfJson !== 'object' || !('assets' in gltfJson)) {
			return gltfJson
		}

		const assets = gltfJson.assets
		if (!(assets instanceof Map)) {
			return gltfJson
		}

		const serializedAssets = Array.from(assets.entries()).map(
			([fileName, data]) => ({
				fileName,
				data: Array.from(data),
				mimeType: fileName.endsWith('.bin')
					? 'application/octet-stream'
					: fileName.endsWith('.png')
						? 'image/png'
						: fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
							? 'image/jpeg'
							: fileName.endsWith('.webp')
								? 'image/webp'
								: 'application/octet-stream'
			})
		)

		return {
			...gltfJson,
			assets: serializedAssets
		}
	}, [optimizer, modelFile, handleDocumentGltfExport])

	const saveToDB = useCallback(
		async (options?: {
			includeModel?: boolean
			includeOptimizationReport?: boolean
			initialSceneBytes?: number
			currentSceneBytes?: number
		}): Promise<SaveSceneResult | { unchanged: true } | undefined> => {
			if (inFlightSaveRef.current) {
				return inFlightSaveRef.current
			}

			const savePromise = (async () => {
				if (!userId) {
					throw new Error('No user ID provided for saving settings')
				}

				let requestId: string | undefined

				try {
					requestId = createRequestId()
					const shouldIncludeModel = options?.includeModel ?? true
					const gltfJsonToSend = shouldIncludeModel
						? await serializeGltfDocument()
						: null

					let optimizationReport = null
					if (optimizer && optimizer.report) {
						optimizationReport = optimizer.report
					}

					const formData = new FormData()
					formData.append('action', 'save-scene-settings')
					formData.append('requestId', requestId)
					formData.append('sceneId', currentSceneId || '')
					formData.append('userId', userId)
					formData.append('settings', JSON.stringify(currentSettings))
					formData.append(
						'optimizationSettings',
						JSON.stringify(optimizationSettings)
					)

					if (shouldIncludeModel) {
						formData.append('gltfJson', JSON.stringify(gltfJsonToSend))
					}

					if (typeof options?.initialSceneBytes === 'number') {
						formData.append(
							'initialSceneBytes',
							String(options.initialSceneBytes)
						)
					}

					if (typeof options?.currentSceneBytes === 'number') {
						formData.append(
							'currentSceneBytes',
							String(options.currentSceneBytes)
						)
					}

					if (
						optimizationReport &&
						options?.includeOptimizationReport !== false
					) {
						formData.append(
							'optimizationReport',
							JSON.stringify(optimizationReport)
						)
					}

					console.info('[scene-settings] save request started', {
						requestId,
						sceneId: currentSceneId || null,
						includeModel: shouldIncludeModel
					})

					const endpoint = currentSceneId
						? `/api/scenes/${currentSceneId}`
						: '/api/scenes'

					const response = await fetch(endpoint, {
						method: 'POST',
						body: formData
					})

					const result = await response.json()

					if (!response.ok || result.error) {
						throw new Error(
							result.error || `HTTP error! status: ${response.status}`
						)
					}

					const data = result.data || result

					console.info('[scene-settings] save request completed', {
						requestId,
						sceneId: data.sceneId || currentSceneId || null,
						unchanged: Boolean(data.unchanged)
					})

					if (data.unchanged) {
						return { unchanged: true }
					}

					return data
				} catch (error) {
					console.error('Failed to save scene settings:', {
						requestId,
						sceneId: currentSceneId || null,
						error
					})
					throw error
				}
			})()

			inFlightSaveRef.current = savePromise

			try {
				return await savePromise
			} finally {
				if (inFlightSaveRef.current === savePromise) {
					inFlightSaveRef.current = null
				}
			}
		},
		[
			createRequestId,
			currentSceneId,
			currentSettings,
			optimizationSettings,
			optimizer,
			serializeGltfDocument,
			userId
		]
	)

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

			const sceneName = data.name.split('.').at(0) || ''
			setMeta((prev) => ({
				...prev,
				sceneName
			}))

			if (!paramSceneId) {
				setLastSavedSettings({
					...currentSettings,
					meta: {
						...currentSettings.meta,
						sceneName
					}
				})
			}

			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: true,
				showSidebar: false
			}))
		},
		[paramSceneId, currentSettings, setMeta, setProcess]
	) as EventHandler<'load-complete'>

	const handleServerLoadComplete = useCallback(
		(data?: SceneLoadResult) => {
			if (!data) return

			setMeta((prev) => ({
				...prev,
				sceneName: data.settings.meta?.sceneName || prev.sceneName
			}))

			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: true,
				showSidebar: false
			}))
		},
		[setMeta, setProcess]
	) as EventHandler<'server-load-complete'>

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

	// Subscribe to model loading events
	useEffect(() => {
		on('not-loaded-files', handleNotLoadedFiles)
		on('load-complete', handleLoadComplete)
		on('server-load-complete', handleServerLoadComplete)
		on('load-error', handleLoadError)

		return () => {
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('server-load-complete', handleServerLoadComplete)
			off('load-error', handleLoadError)
		}
	}, [
		on,
		off,
		handleLoadComplete,
		handleServerLoadComplete,
		handleLoadError,
		handleNotLoadedFiles
	])

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

	// Update currentSceneId when sceneId prop changes
	useEffect(() => {
		setCurrentSceneId(paramSceneId)
		setIsInitializing(!!paramSceneId && (autoLoad || !!initialSceneAggregate))
		setOptimizationRuntime({
			...optimizationRuntimeInitialState,
			lastSavedReportSignature: null
		})
		setHasUnsavedChanges(false)
	}, [
		paramSceneId,
		autoLoad,
		initialSceneAggregate,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime
	])
	const getReportSignature = useCallback(
		(report?: OptimizationReport | null) => {
			if (!report) return null
			return JSON.stringify({
				originalSize: report.originalSize,
				optimizedSize: report.optimizedSize,
				stats: report.stats,
				appliedOptimizations: report.appliedOptimizations
			})
		},
		[]
	)

	const reportSignature = useMemo(
		() => getReportSignature(optimizer?.report),
		[getReportSignature, optimizer?.report]
	)

	useEffect(() => {
		if (!reportSignature || lastSavedReportSignature || !latestSceneStats) {
			return
		}

		const persistedInitialSceneBytes = latestSceneStats.initialSceneBytes
		const persistedCurrentSceneBytes = latestSceneStats.currentSceneBytes

		if (
			typeof persistedInitialSceneBytes !== 'number' ||
			typeof persistedCurrentSceneBytes !== 'number' ||
			!optimizer?.report
		) {
			return
		}

		const isPersistedReportSignature =
			optimizer.report.originalSize === persistedInitialSceneBytes &&
			optimizer.report.optimizedSize === persistedCurrentSceneBytes

		if (!isPersistedReportSignature) {
			return
		}

		setOptimizationRuntime((prev) => ({
			...prev,
			lastSavedReportSignature: reportSignature
		}))
	}, [
		reportSignature,
		lastSavedReportSignature,
		latestSceneStats,
		optimizer?.report,
		setOptimizationRuntime
	])

	// Reset the scene load flag when sceneId changes
	useEffect(() => {
		sceneLoadAttemptedRef.current = false
	}, [paramSceneId])

	/**
	 * Apply scene settings to atoms and track as saved state
	 */
	const applySceneSettings = useCallback(
		(settings: SceneSettings) => {
			if (settings.environment) setEnv(settings.environment)
			if (settings.camera) setCamera(settings.camera)
			if (settings.controls) setControls(settings.controls)
			if (settings.shadows) setShadows(settings.shadows)
			if (settings.meta) setMeta(settings.meta)

			const loadedSettings: SceneSettings = {
				environment: settings.environment || defaultEnvOptions,
				camera: settings.camera || defaultCameraOptions,
				controls: settings.controls || defaultControlsOptions,
				shadows: settings.shadows || defaultShadowOptions,
				meta: settings.meta || { sceneName: '', thumbnailUrl: null }
			}
			setLastSavedSettings(loadedSettings)
		},
		[setCamera, setControls, setEnv, setMeta, setShadows]
	)

	const inferOptimizationPreset = useCallback(
		(optimizations: Optimizations) => {
			const entries = Object.entries(optimizationPresets) as Array<
				[keyof Optimizations, Optimizations]
			>

			const exactMatch = entries.find(([, presetValue]) => {
				return JSON.stringify(presetValue) === JSON.stringify(optimizations)
			})

			return (exactMatch?.[0] ?? 'medium') as OptimizationPreset
		},
		[]
	)

	const hydrateOptimizationState = useCallback(
		(aggregate: SceneAggregateResponse | null) => {
			const persistedOptimizationSettings =
				aggregate?.stats?.optimizationSettings
			const latestSceneStats = aggregate?.stats ?? null
			const aggregateSceneBytes = calculateAggregateSceneBytes(aggregate)

			if (!persistedOptimizationSettings) {
				setOptimizationState((prev) => ({
					...prev,
					optimizationPreset: 'medium',
					optimizations: optimizationPresets.medium
				}))

				setOptimizationRuntime({
					...optimizationRuntimeInitialState,
					latestSceneStats,
					clientSceneBytes: aggregateSceneBytes
				})
				return
			}

			const inferredPreset = inferOptimizationPreset(
				persistedOptimizationSettings
			)

			setOptimizationState((prev) => ({
				...prev,
				optimizationPreset: inferredPreset,
				optimizations: persistedOptimizationSettings
			}))

			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: false,
				optimizedSceneBytes: null,
				clientSceneBytes: aggregateSceneBytes,
				latestSceneStats
			}))
		},
		[
			calculateAggregateSceneBytes,
			inferOptimizationPreset,
			setOptimizationRuntime,
			setOptimizationState
		]
	)

	const getSettingsFromAggregate = useCallback(
		(aggregate: SceneAggregateResponse | null): SceneSettings | null => {
			if (!aggregate) {
				return null
			}

			if (aggregate.settings) {
				return aggregate.settings
			}

			const fallbackSettings = aggregate as SceneAggregateResponse & {
				environment?: SceneSettings['environment']
				controls?: SceneSettings['controls']
				shadows?: SceneSettings['shadows']
				meta?: SceneSettings['meta']
			}

			if (
				fallbackSettings.environment ||
				fallbackSettings.controls ||
				fallbackSettings.shadows ||
				fallbackSettings.meta
			) {
				return {
					environment: fallbackSettings.environment,
					controls: fallbackSettings.controls,
					shadows: fallbackSettings.shadows,
					meta: fallbackSettings.meta
				}
			}

			return null
		},
		[]
	)

	const loadSceneFromAggregate = useCallback(
		async (sceneId: string, aggregate: SceneAggregateResponse) => {
			if (sceneLoadAttemptedRef.current) {
				return
			}

			sceneLoadAttemptedRef.current = true
			setIsDownloading(true)

			try {
				hydrateOptimizationState(aggregate)

				const settings = getSettingsFromAggregate(aggregate)
				if (settings) {
					applySceneSettings(settings)
				}

				if (aggregate.gltfJson && aggregate.assetData) {
					const sceneData: ServerSceneData = {
						gltfJson: aggregate.gltfJson as unknown as Record<string, unknown>,
						assetData: aggregate.assetData,
						environment: settings?.environment,
						controls: settings?.controls,
						shadows: settings?.shadows,
						meta: settings?.meta
					}

					const files = reconstructGltfFiles(sceneData)
					await load(files)
				}

				const sceneName = settings?.meta?.sceneName || sceneId
				toast.success(`Loaded scene: ${sceneName}`)
			} catch (error) {
				sceneLoadAttemptedRef.current = false
				console.error('Failed to load scene from bootstrap data:', error)
				toast.error(
					`Failed to load scene: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
				throw error
			} finally {
				setIsDownloading(false)
			}
		},
		[
			hydrateOptimizationState,
			getSettingsFromAggregate,
			applySceneSettings,
			load,
			setIsDownloading
		]
	)

	/**
	 * Load scene from server via loadFromServer
	 */
	const loadScene = useCallback(
		async (targetSceneId?: string) => {
			const idToLoad = targetSceneId || currentSceneId
			if (!idToLoad) {
				setIsInitializing(false)
				return
			}

			if (sceneLoadAttemptedRef.current) {
				return
			}

			sceneLoadAttemptedRef.current = true
			setIsDownloading(true)

			try {
				const result: SceneLoadResult = await loadFromServer({
					sceneId: idToLoad
				})
				applySceneSettings(result.settings)
				hydrateOptimizationState(
					initialSceneAggregate && idToLoad === paramSceneId
						? initialSceneAggregate
						: null
				)
				toast.success(
					`Loaded scene: ${result.settings.meta?.sceneName || idToLoad}`
				)

				return result
			} catch (error) {
				sceneLoadAttemptedRef.current = false
				console.error('Failed to load scene:', error)
				toast.error(
					`Failed to load scene: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
				throw error
			} finally {
				setIsDownloading(false)
			}
		},
		[
			currentSceneId,
			loadFromServer,
			applySceneSettings,
			hydrateOptimizationState,
			initialSceneAggregate,
			paramSceneId,
			setIsDownloading,
			setIsInitializing
		]
	)

	/**
	 * Save scene settings and update local state on success
	 */
	const saveSceneSettings = useCallback(async (): Promise<
		SaveSceneResult | { unchanged: true } | undefined
	> => {
		const hasReportChanges =
			reportSignature !== null &&
			lastSavedReportSignature !== null &&
			reportSignature !== lastSavedReportSignature
		const hasSceneSizeChanges =
			typeof optimizedSceneBytes === 'number' &&
			optimizedSceneBytes !== (latestSceneStats?.currentSceneBytes ?? null)
		const hasOptimizationChanges = hasReportChanges || hasSceneSizeChanges
		const shouldUploadModel = !currentSceneId || hasOptimizationChanges
		const sceneInitialBytes =
			typeof clientSceneBytes === 'number' ? clientSceneBytes : undefined
		const sceneCurrentBytes =
			typeof optimizedSceneBytes === 'number'
				? optimizedSceneBytes
				: typeof clientSceneBytes === 'number'
					? clientSceneBytes
					: undefined

		const result = await saveToDB({
			includeModel: shouldUploadModel,
			includeOptimizationReport: hasOptimizationChanges,
			initialSceneBytes: sceneInitialBytes,
			currentSceneBytes: sceneCurrentBytes
		})

		if (result && 'sceneId' in result && result.sceneId && !currentSceneId) {
			setCurrentSceneId(result.sceneId)
		}

		if (result && !result.unchanged) {
			setLastSavedSettings(currentSettings)
			const latestStats = result.stats
			if (latestStats) {
				setOptimizationRuntime((prev) => ({
					...prev,
					latestSceneStats: latestStats
				}))
			}
			if (reportSignature) {
				setOptimizationRuntime((prev) => ({
					...prev,
					lastSavedReportSignature: reportSignature
				}))
			}
		}

		return result
	}, [
		saveToDB,
		currentSceneId,
		currentSettings,
		reportSignature,
		lastSavedReportSignature,
		optimizedSceneBytes,
		clientSceneBytes,
		latestSceneStats,
		setOptimizationRuntime
	])

	/**
	 * Returns whether there are unsaved changes compared to last saved settings
	 */
	const calHasChanges = useCallback(() => {
		if (isInitializing) {
			return false
		}

		const settingsBaseline = lastSavedSettings || currentSettings
		const settingsChanged =
			JSON.stringify(currentSettings.environment) !==
				JSON.stringify(settingsBaseline.environment) ||
			JSON.stringify(currentSettings.controls) !==
				JSON.stringify(settingsBaseline.controls) ||
			JSON.stringify(currentSettings.shadows) !==
				JSON.stringify(settingsBaseline.shadows) ||
			JSON.stringify(currentSettings.meta) !==
				JSON.stringify(settingsBaseline.meta)

		const optimizationChanged =
			(reportSignature !== null &&
				lastSavedReportSignature !== null &&
				reportSignature !== lastSavedReportSignature) ||
			(typeof optimizedSceneBytes === 'number' &&
				optimizedSceneBytes !== (latestSceneStats?.currentSceneBytes ?? null))

		return settingsChanged || optimizationChanged
	}, [
		currentSettings,
		lastSavedSettings,
		isInitializing,
		reportSignature,
		lastSavedReportSignature,
		optimizedSceneBytes,
		latestSceneStats
	])

	useEffect(() => {
		if (isInitializing || !currentSettings) {
			return
		}

		const hasChanges = calHasChanges()
		setHasUnsavedChanges(hasChanges)
	}, [
		calHasChanges,
		lastSavedSettings,
		currentSettings,
		isInitializing,
		setHasUnsavedChanges
	])

	useEffect(() => {
		if (
			!paramSceneId ||
			!initialSceneAggregate ||
			file?.model ||
			isFileLoading ||
			sceneLoadAttemptedRef.current
		) {
			return
		}

		loadSceneFromAggregate(paramSceneId, initialSceneAggregate).finally(() =>
			setIsInitializing(false)
		)
	}, [
		paramSceneId,
		initialSceneAggregate,
		file?.model,
		isFileLoading,
		loadSceneFromAggregate,
		setIsInitializing
	])

	// Auto-load scene when component mounts with a sceneId
	useEffect(() => {
		if (
			!autoLoad ||
			!paramSceneId ||
			initialSceneAggregate ||
			file?.model ||
			isFileLoading ||
			sceneLoadAttemptedRef.current
		) {
			// If autoLoad is disabled but we have a sceneId, ensure we're not stuck initializing
			if (!autoLoad && paramSceneId) {
				setIsInitializing(false)
			}
			return
		}

		loadScene(paramSceneId).finally(() => setIsInitializing(false))
	}, [
		autoLoad,
		paramSceneId,
		initialSceneAggregate,
		file?.model,
		isFileLoading,
		loadScene,
		setIsInitializing
	])

	return { saveSceneSettings }
}
