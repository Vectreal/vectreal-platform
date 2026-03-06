import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
	buildOptimizationReportSignature,
	executeSceneSaveOrchestrator,
	hasOptimizationChanges,
	type SaveSceneOrchestratorOptions,
	hasUnsavedSceneChanges
} from '../lib/domain/scene'

import type {
	SaveAvailabilityState,
	SaveLocationTarget,
	SaveSceneResult,
	SceneSaveFlowArgs
} from './scene-loader.types'

export const useSceneSaveFlow = ({
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
	isInitializing,
	processHasUnsavedChanges,
	setHasUnsavedChanges,
	latestSceneStats,
	optimizedSceneBytes,
	clientSceneBytes,
	lastSavedReportSignature,
	setOptimizationRuntime,
	revalidate,
	clearPendingDraft,
	optimizationSettings,
	optimizationReport,
	createRequestId,
	prepareGltfDocumentForUpload,
	captureSceneThumbnail,
	maxConcurrentAssetUploadsDefault
}: SceneSaveFlowArgs) => {
	const inFlightSaveRef = useRef<Promise<
		SaveSceneResult | { unchanged: true } | undefined
	> | null>(null)

	const reportSignature = useMemo(
		() => buildOptimizationReportSignature(optimizationReport),
		[optimizationReport]
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
			!optimizationReport ||
			typeof optimizationReport !== 'object'
		) {
			return
		}

		const reportCandidate = optimizationReport as {
			originalSize?: unknown
			optimizedSize?: unknown
		}

		const isPersistedReportSignature =
			reportCandidate.originalSize === persistedInitialSceneBytes &&
			reportCandidate.optimizedSize === persistedCurrentSceneBytes

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
		optimizationReport,
		setOptimizationRuntime
	])

	const saveToDB = useCallback(
		async (
			options?: SaveSceneOrchestratorOptions
		): Promise<SaveSceneResult | { unchanged: true } | undefined> => {
			if (inFlightSaveRef.current) {
				return inFlightSaveRef.current
			}

			const savePromise = (async () => {
				try {
					return await executeSceneSaveOrchestrator({
						userId,
						currentSceneId,
						currentSettings,
						sceneMetaState,
						optimizationSettings,
						optimizationReport: optimizationReport ?? null,
						options,
						createRequestId,
						prepareGltfDocumentForUpload,
						captureSceneThumbnail,
						maxConcurrentAssetUploadsDefault
					})
				} catch (error) {
					console.error('Failed to save scene settings:', {
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
			captureSceneThumbnail,
			createRequestId,
			currentSceneId,
			currentSettings,
			sceneMetaState,
			optimizationSettings,
			optimizationReport,
			prepareGltfDocumentForUpload,
			userId,
			maxConcurrentAssetUploadsDefault
		]
	)

	const saveSceneSettings = useCallback(
		async (
			target?: SaveLocationTarget
		): Promise<SaveSceneResult | { unchanged: true } | undefined> => {
			const hasOptimizationReportChanges = hasOptimizationChanges({
				reportSignature,
				lastSavedReportSignature,
				optimizedSceneBytes,
				latestSceneStats
			})
			const sceneInitialBytes =
				typeof clientSceneBytes === 'number' ? clientSceneBytes : undefined
			const sceneCurrentBytes =
				typeof optimizedSceneBytes === 'number'
					? optimizedSceneBytes
					: typeof clientSceneBytes === 'number'
						? clientSceneBytes
						: undefined

			const result = await saveToDB({
				includeOptimizationReport: hasOptimizationReportChanges,
				initialSceneBytes: sceneInitialBytes,
				currentSceneBytes: sceneCurrentBytes,
				targetProjectId: target?.targetProjectId,
				targetFolderId: target?.targetFolderId
			})

			if (result && 'sceneId' in result && result.sceneId && !currentSceneId) {
				setCurrentSceneId(result.sceneId)
			}

			if (result && !result.unchanged) {
				const savedSceneMeta =
					typeof result.sceneMeta === 'object' && result.sceneMeta
						? result.sceneMeta
						: sceneMetaState

				setSceneMetaState(savedSceneMeta)
				setLastSavedSettings(currentSettings)
				setLastSavedSceneMeta(savedSceneMeta)
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

				revalidate()
			}

			if (result) {
				void clearPendingDraft()
			}

			return result
		},
		[
			saveToDB,
			currentSceneId,
			setCurrentSceneId,
			currentSettings,
			sceneMetaState,
			setSceneMetaState,
			setLastSavedSettings,
			setLastSavedSceneMeta,
			reportSignature,
			lastSavedReportSignature,
			optimizedSceneBytes,
			clientSceneBytes,
			latestSceneStats,
			setOptimizationRuntime,
			revalidate,
			clearPendingDraft
		]
	)

	const hasChanges = useMemo(
		() =>
			hasUnsavedSceneChanges({
				isInitializing,
				currentSettings,
				lastSavedSettings,
				sceneMetaState,
				lastSavedSceneMeta,
				reportSignature,
				lastSavedReportSignature,
				optimizedSceneBytes,
				latestSceneStats
			}),
		[
			isInitializing,
			currentSettings,
			lastSavedSettings,
			sceneMetaState,
			lastSavedSceneMeta,
			reportSignature,
			lastSavedReportSignature,
			optimizedSceneBytes,
			latestSceneStats
		]
	)

	useEffect(() => {
		if (isInitializing) {
			return
		}

		setHasUnsavedChanges(hasChanges)
	}, [isInitializing, hasChanges, setHasUnsavedChanges])

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

		if (!processHasUnsavedChanges) {
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
	}, [userId, isFirstSavePendingOptimization, processHasUnsavedChanges])

	return {
		saveSceneSettings,
		saveAvailability
	}
}
