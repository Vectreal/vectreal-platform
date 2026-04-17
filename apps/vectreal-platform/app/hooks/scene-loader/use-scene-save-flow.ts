import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
	buildOptimizationReportSignature,
	executeSceneSaveOrchestrator,
	hasOptimizationChanges,
	hasUnsavedSceneChanges,
	resolveSaveAvailability,
	shouldRequireFirstSaveOptimization,
	type SaveSceneOrchestratorOptions,
	type SaveAvailabilityState
} from '../../lib/domain/scene'
import {
	currentLocationAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'
import { isSceneCurrentLocation } from '../../types/api'

import type { UseSceneSaveFlowArgs } from './contracts'
import type {
	SaveLocationTarget,
	SaveSceneResult
} from '../../types/publisher-scene'

export const useSceneSaveFlow = ({
	scenePersistence,
	optimizationState,
	actions
}: UseSceneSaveFlowArgs) => {
	const {
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
	} = scenePersistence
	const {
		optimizationSettings,
		optimizationReport,
		latestSceneStats,
		optimizedSceneBytes,
		clientSceneBytes,
		lastSavedReportSignature,
		setOptimizationRuntime
	} = optimizationState
	const {
		setHasUnsavedChanges,
		revalidate,
		clearPendingDraft,
		createRequestId,
		prepareGltfDocumentForUpload,
		captureSceneThumbnail,
		maxConcurrentAssetUploadsDefault
	} = actions

	const setCurrentLocation = useSetAtom(currentLocationAtom)
	const setSaveLocation = useSetAtom(saveLocationAtom)
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
		() =>
			shouldRequireFirstSaveOptimization({
				currentSceneId,
				lastSavedSceneId,
				hasAppliedOptimization
			}),
		[currentSceneId, lastSavedSceneId, hasAppliedOptimization]
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
			// Snapshot all state that determines the new baseline BEFORE the async
			// save. Any mutations the user makes after this point (mid-flight) must
			// remain visible as unsaved diffs once the request completes.
			const settingsSnapshot = currentSettings
			const sceneMetaSnapshot = sceneMetaState
			const reportSignatureSnapshot = reportSignature
			const requestedSaveLocation = {
				targetProjectId: target?.targetProjectId,
				targetFolderId: target?.targetFolderId ?? null
			}

			const hasOptimizationReportChanges = hasOptimizationChanges({
				reportSignature: reportSignatureSnapshot,
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
				// Prefer the server-returned meta; fall back to the pre-save snapshot
				// (never the live state) so we don't absorb mid-flight edits.
				const savedSceneMeta =
					typeof result.sceneMeta === 'object' && result.sceneMeta
						? result.sceneMeta
						: sceneMetaSnapshot

				const locationCandidate = result.currentLocation
				if (isSceneCurrentLocation(locationCandidate)) {
					setCurrentLocation(locationCandidate)
					setSaveLocation((prev) => {
						const didLocationChangeDuringSave =
							prev.targetProjectId !== requestedSaveLocation.targetProjectId ||
							(prev.targetFolderId ?? null) !==
								requestedSaveLocation.targetFolderId

						if (didLocationChangeDuringSave) {
							return prev
						}

						return {
							targetProjectId: locationCandidate.projectId ?? undefined,
							targetFolderId: locationCandidate.folderId ?? null
						}
					})
				}

				// Only patch server-generated fields (thumbnail URL) in the live state
				// so that any user edits made during the in-flight save are preserved.
				setSceneMetaState((prev) => ({
					...prev,
					thumbnailUrl: savedSceneMeta.thumbnailUrl
				}))

				// Set baselines to the pre-save snapshots so that mid-flight mutations
				// remain detectable as diffs against the new baseline.
				setLastSavedSettings(settingsSnapshot)
				setLastSavedSceneMeta(savedSceneMeta)

				// Mark which scene was just saved. useSceneParamsSync reads this to
				// distinguish "navigated to new scene after save" from a genuine user
				// scene change, and skips destructive resets in that case.
				const persistedSceneId = result.sceneId || currentSceneId
				setLastSavedSceneId(persistedSceneId ?? null)

				const latestStats = result.stats
				if (latestStats) {
					setOptimizationRuntime((prev) => ({
						...prev,
						latestSceneStats: latestStats
					}))
				}
				if (reportSignatureSnapshot) {
					setOptimizationRuntime((prev) => ({
						...prev,
						lastSavedReportSignature: reportSignatureSnapshot
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
			setLastSavedSceneId,
			reportSignature,
			lastSavedReportSignature,
			optimizedSceneBytes,
			clientSceneBytes,
			latestSceneStats,
			setOptimizationRuntime,
			setCurrentLocation,
			setSaveLocation,
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

	const saveAvailability: SaveAvailabilityState = useMemo(
		() =>
			resolveSaveAvailability({
				userId,
				isFirstSavePendingOptimization,
				hasChanges
			}),
		[userId, isFirstSavePendingOptimization, hasChanges]
	)

	return {
		saveSceneSettings,
		saveAvailability
	}
}
