import type { OptimizationReport, SceneSettings } from '@vctrl/core'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import type {
	EventHandler,
	ModelFile,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model/types'
import {
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions
} from '@vctrl/viewer'
import { useAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { processAtom } from '../lib/stores/publisher-config-store'
import {
	cameraAtom,
	controlsAtom,
	environmentAtom,
	metaAtom,
	shadowsAtom
} from '../lib/stores/scene-settings-store'

import { useScenePersistence } from './use-scene-persistence'

export interface UseSceneLoaderParams {
	sceneId: null | string
	userId?: string
	autoLoad?: boolean // Control whether to auto-load scene on mount
}

export interface SaveSceneResult {
	sceneId?: string
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
 * 3. NOT returning values already available via context/atoms (prevents duplication)
 *
 * ### State Sources (Single Source of Truth):
 * - **Scene Settings**: `scene-settings-store` atoms (env, toneMapping, controls, shadows, meta)
 *   - Access via: `useAtomValue(environmentAtom)`, etc.
 * - **Process State**: `publisher-config-store.processAtom` (isInitializing, hasUnsavedChanges, isLoading, step, showSidebar, showInfo)
 *   - Access via: `useAtomValue(processAtom)` or `useAtom(processAtom)`
 * - **Model State**: `useModelContext()` (file, isFileLoading, reset, loadFromServer, etc.)
 *   - Access via: `const { file } = useModelContext()`
 * - **Hook-Local State** (NOT shared):
 *   - `currentSceneId` - Active scene ID tracking
 *   - `lastSavedSettings` - Baseline for change detection (internal comparison state)
 *
 * ### What This Hook Returns:
 * Only returns hook-specific state and actions that are NOT available elsewhere:
 * - `currentSceneId: string | null` - Current active scene ID (hook-managed)
 * - `lastSavedSettings: SceneSettingsData | null` - Saved state baseline for comparison
 * - `loadScene: (sceneId?: string) => Promise<SceneLoadResult | void>` - Load scene from server
 * - `saveSceneSettings: () => Promise<SaveSceneResult>` - Save current settings to server
 * - `loadSceneSettings: (sceneId: string) => Promise<void>` - Load settings only (from useScenePersistence)
 * - `saveSceneSettings: (options?) => Promise<SaveSceneResult | { unchanged: true } | undefined>`
 *
 * ### What This Hook Does NOT Return (access via atoms/context instead):
 * ❌ Do NOT return these - they create duplicate state and violate single source of truth:
 * - `env`, `toneMapping`, `controls`, `shadows`, `meta` → Use `scene-settings-store` atoms
 * - `file`, `reset`, `isFileLoading` → Use `useModelContext()`
 * - `isInitializing`, `hasUnsavedChanges`, `isLoading`, `step` → Use `processAtom`
 * - `currentSettings` → Derive from atoms where needed using `useMemo`
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
 *   const { hasUnsavedChanges } = useSceneLoader({ sceneId }) // Instance A
 *   // ...
 * }
 *
 * const Component2 = () => {
 *   const { hasUnsavedChanges } = useSceneLoader({ sceneId }) // Instance B ❌ Duplicate!
 *   // Each instance has separate lastSavedSettings state!
 * }
 * ```
 *
 * @param params - Configuration object or sceneId string
 * @param params.sceneId - Scene ID to load (null for new scene)
 * @param params.userId - User ID for saving operations
 * @param params.autoLoad - Whether to auto-load scene on mount (default: true)
 */
export function useSceneLoader(
	params: UseSceneLoaderParams | string | null = null
) {
	// Handle both object params and simple sceneId string for backwards compatibility
	const {
		sceneId: paramSceneId,
		userId,
		autoLoad = true
	} = typeof params === 'string' || params === null
		? { sceneId: params, userId: undefined, autoLoad: true }
		: params

	const sceneLoadAttemptedRef = useRef(false)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettings | null>(null)
	const [lastSavedReportSignature, setLastSavedReportSignature] = useState<
		string | null
	>(null)
	const [currentSceneId, setCurrentSceneId] = useState<string | null>(
		paramSceneId
	)
	// Model context and loading
	const {
		isFileLoading,
		file,
		on,
		off,
		loadFromServer,
		optimizer,
		file: modelFile
	} = useModelContext()

	// Scene state atoms
	const [env, setEnv] = useAtom(environmentAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [controls, setControls] = useAtom(controlsAtom)
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [meta, setMeta] = useAtom(metaAtom)

	// Process state atom - use full atom access for reading and writing
	const [processState, setProcess] = useAtom(processAtom)
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

	// Scene persistence operations
	const { saveSceneSettings: saveToDB, loadSceneSettings } =
		useScenePersistence({
			currentSceneId,
			userId,
			currentSettings,
			optimizer,
			modelFile
		})

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
		// Only set initializing to true if we have a sceneId AND autoLoad is enabled
		setIsInitializing(!!paramSceneId && autoLoad)
		setLastSavedReportSignature(null)
	}, [paramSceneId, autoLoad, setIsInitializing])
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
		if (!reportSignature || lastSavedReportSignature) {
			return
		}

		setLastSavedReportSignature(reportSignature)
	}, [reportSignature, lastSavedReportSignature])

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
				toast.success(
					`Loaded scene: ${result.settings.meta?.sceneName || idToLoad}`
				)

				return result
			} catch (error) {
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
		const hasOptimizationChanges =
			reportSignature !== null &&
			lastSavedReportSignature !== null &&
			reportSignature !== lastSavedReportSignature
		const shouldUploadModel = !currentSceneId || hasOptimizationChanges

		const result = await saveToDB({
			includeModel: shouldUploadModel,
			includeOptimizationReport: hasOptimizationChanges
		})

		if (result && 'sceneId' in result && result.sceneId && !currentSceneId) {
			setCurrentSceneId(result.sceneId)
		}

		if (result && !result.unchanged) {
			setLastSavedSettings(currentSettings)
			if (reportSignature) {
				setLastSavedReportSignature(reportSignature)
			}
		}

		return result
	}, [
		saveToDB,
		currentSceneId,
		currentSettings,
		reportSignature,
		lastSavedReportSignature
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
			reportSignature !== null &&
			lastSavedReportSignature !== null &&
			reportSignature !== lastSavedReportSignature

		return settingsChanged || optimizationChanged
	}, [
		currentSettings,
		lastSavedSettings,
		isInitializing,
		reportSignature,
		lastSavedReportSignature
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

	// Auto-load scene when component mounts with a sceneId
	useEffect(() => {
		if (
			!autoLoad ||
			!paramSceneId ||
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
		file?.model,
		isFileLoading,
		loadScene,
		setIsInitializing
	])

	return {
		// Scene management - hook-specific state
		currentSceneId,
		lastSavedSettings,

		// Actions - hook-specific functions
		loadScene,
		saveSceneSettings,
		loadSceneSettings

		// Note: The following values are NOT returned as they're available via context/store:
		// - env, toneMapping, controls, shadows, meta -> Use scene settings atoms directly
		// - file, reset -> Use useModelContext() directly
		// - isInitializing, hasUnsavedChanges -> Use processAtom directly
		// - currentSettings -> Derive from atoms where needed
	}
}
