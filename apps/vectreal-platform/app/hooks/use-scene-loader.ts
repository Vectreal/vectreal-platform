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
	ServerSceneData
} from '@vctrl/hooks/use-load-model/types'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRevalidator } from 'react-router'
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
	initialSceneAggregate?: SceneAggregateResponse | null
}

export interface SaveSceneResult {
	sceneId?: string
	stats?: SceneStatsData | null
	unchanged?: boolean
	[key: string]: unknown
}

export type SaveAvailabilityReason =
	| 'ready'
	| 'no-user'
	| 'no-unsaved-changes'
	| 'requires-first-optimization'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
	isFirstSavePendingOptimization: boolean
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
		initialSceneAggregate = null
	} = params === null
		? {
				sceneId: null,
				userId: undefined,
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
		optimizer,
		file: modelFile
	} = useModelContext()
	const revalidator = useRevalidator()
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

	const calculateAggregateReferencedBytes = useCallback(
		(aggregate: SceneAggregateResponse | null) => {
			if (!aggregate?.gltfJson && !aggregate?.assetData) {
				return {
					sourcePackageBytes: null,
					textureBytes: null
				}
			}

			const gltfJson = aggregate.gltfJson
			const assets = Object.values(aggregate.assetData ?? {}).map((asset) => ({
				fileName: asset.fileName,
				size: asset.data.length
			}))

			const normalizeUri = (value: string) =>
				decodeURIComponent(value).replace(/^\.\//, '')

			const resolveAssetSize = (uri: string) => {
				const normalizedUri = normalizeUri(uri)
				const uriBasename = normalizedUri.split('/').pop() || normalizedUri

				for (const asset of assets) {
					const normalizedName = normalizeUri(asset.fileName)
					const basename = normalizedName.split('/').pop() || normalizedName

					if (
						normalizedName === normalizedUri ||
						basename === normalizedUri ||
						normalizedName === uriBasename ||
						basename === uriBasename
					) {
						return asset.size
					}
				}

				return 0
			}

			const imageUris = new Set<string>()
			const bufferUris = new Set<string>()

			if (!gltfJson) {
				return {
					sourcePackageBytes: null,
					textureBytes: null
				}
			}

			const extractGltfDocument = (
				value: unknown
			): {
				images?: Array<{ uri?: unknown }>
				buffers?: Array<{ uri?: unknown }>
			} | null => {
				if (!value || typeof value !== 'object') {
					return null
				}

				const candidate = value as {
					images?: unknown
					buffers?: unknown
					json?: unknown
				}

				if (
					Array.isArray(candidate.images) ||
					Array.isArray(candidate.buffers)
				) {
					return candidate as {
						images?: Array<{ uri?: unknown }>
						buffers?: Array<{ uri?: unknown }>
					}
				}

				if (candidate.json && typeof candidate.json === 'object') {
					const nested = candidate.json as {
						images?: unknown
						buffers?: unknown
					}

					if (Array.isArray(nested.images) || Array.isArray(nested.buffers)) {
						return nested as {
							images?: Array<{ uri?: unknown }>
							buffers?: Array<{ uri?: unknown }>
						}
					}
				}

				return null
			}

			const gltfDocument = extractGltfDocument(gltfJson)

			const images = Array.isArray(gltfDocument?.images)
				? gltfDocument.images
				: []
			for (const image of images) {
				if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
					imageUris.add(image.uri)
				}
			}

			const buffers = Array.isArray(gltfDocument?.buffers)
				? gltfDocument.buffers
				: []
			for (const buffer of buffers) {
				if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
					bufferUris.add(buffer.uri)
				}
			}

			const textureBytes = Array.from(imageUris).reduce(
				(total, uri) => total + resolveAssetSize(uri),
				0
			)
			const bufferBytes = Array.from(bufferUris).reduce(
				(total, uri) => total + resolveAssetSize(uri),
				0
			)
			const gltfBytes = new TextEncoder().encode(
				JSON.stringify(gltfDocument ?? gltfJson)
			).byteLength

			return {
				sourcePackageBytes: gltfBytes + bufferBytes + textureBytes,
				textureBytes
			}
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
		on('load-error', handleLoadError)

		return () => {
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('load-error', handleLoadError)
		}
	}, [on, off, handleLoadComplete, handleLoadError, handleNotLoadedFiles])

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
		setIsInitializing(!!paramSceneId && !!initialSceneAggregate)
		setOptimizationRuntime({
			...optimizationRuntimeInitialState,
			lastSavedReportSignature: null
		})
		if (initialSceneAggregate) {
			setHasUnsavedChanges(false)
		}
	}, [
		paramSceneId,
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

	const hasAppliedOptimization = useMemo(
		() => typeof optimizedSceneBytes === 'number',
		[optimizedSceneBytes]
	)

	const isFirstSavePendingOptimization = useMemo(
		() => !currentSceneId && !hasAppliedOptimization,
		[currentSceneId, hasAppliedOptimization]
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
			const { sourcePackageBytes, textureBytes } =
				calculateAggregateReferencedBytes(aggregate)

			if (!persistedOptimizationSettings) {
				setOptimizationState((prev) => ({
					...prev,
					optimizationPreset: 'medium',
					optimizations: optimizationPresets.medium
				}))

				setOptimizationRuntime({
					...optimizationRuntimeInitialState,
					latestSceneStats,
					clientSceneBytes: sourcePackageBytes,
					clientTextureBytes: textureBytes
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
				optimizedTextureBytes: null,
				clientSceneBytes: sourcePackageBytes,
				clientTextureBytes: textureBytes,
				latestSceneStats
			}))
		},
		[
			calculateAggregateReferencedBytes,
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
					const normalizedGltfJson =
						typeof aggregate.gltfJson === 'object' &&
						aggregate.gltfJson !== null &&
						'json' in aggregate.gltfJson &&
						typeof (aggregate.gltfJson as { json?: unknown }).json ===
							'object' &&
						(aggregate.gltfJson as { json?: unknown }).json !== null
							? ((aggregate.gltfJson as { json: unknown }).json as Record<
									string,
									unknown
								>)
							: (aggregate.gltfJson as unknown as Record<string, unknown>)

					const sceneData: ServerSceneData = {
						gltfJson: normalizedGltfJson,
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

			revalidator.revalidate()
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
		setOptimizationRuntime,
		revalidator
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

	const saveAvailability: SaveAvailabilityState = useMemo(() => {
		if (!userId) {
			return {
				canSave: false,
				reason: 'no-user',
				isFirstSavePendingOptimization
			}
		}

		if (isFirstSavePendingOptimization) {
			return {
				canSave: false,
				reason: 'requires-first-optimization',
				isFirstSavePendingOptimization: true
			}
		}

		if (!processState.hasUnsavedChanges) {
			return {
				canSave: false,
				reason: 'no-unsaved-changes',
				isFirstSavePendingOptimization: false
			}
		}

		return {
			canSave: true,
			reason: 'ready',
			isFirstSavePendingOptimization: false
		}
	}, [userId, isFirstSavePendingOptimization, processState.hasUnsavedChanges])

	useEffect(() => {
		if (!paramSceneId) {
			setIsInitializing(false)
			return
		}

		if (!initialSceneAggregate) {
			setIsInitializing(false)
			return
		}

		if (file?.model || isFileLoading || sceneLoadAttemptedRef.current) {
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

	return { saveSceneSettings, saveAvailability }
}
