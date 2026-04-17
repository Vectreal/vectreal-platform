import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	buildOptimizationReportSignature,
	executeSceneSaveOrchestrator,
	hasSceneMetaChanged,
	hasSceneSettingsChanged,
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
	const inFlightSaveTokenRef = useRef<null | symbol>(null)
	const [optimisticSaveBaseline, setOptimisticSaveBaseline] = useState<null | {
		sceneId: null | string
		settings: typeof currentSettings
		sceneMeta: typeof sceneMetaState
		reportSignature: null | string
		sceneBytes: null | number
	}>(null)

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
		if (!optimisticSaveBaseline || inFlightSaveRef.current) {
			return
		}

		const isOptimisticSceneTransitionSettling =
			optimisticSaveBaseline.sceneId === null &&
			currentSceneId !== null &&
			currentSceneId === lastSavedSceneId

		if (
			currentSceneId !== optimisticSaveBaseline.sceneId &&
			!isOptimisticSceneTransitionSettling
		) {
			setOptimisticSaveBaseline(null)
			return
		}

		const settingsSettled =
			lastSavedSettings !== null &&
			!hasSceneSettingsChanged(
				lastSavedSettings,
				optimisticSaveBaseline.settings
			)
		const sceneMetaSettled =
			lastSavedSceneMeta !== null &&
			!hasSceneMetaChanged(lastSavedSceneMeta, optimisticSaveBaseline.sceneMeta)
		const reportSettled =
			lastSavedReportSignature === optimisticSaveBaseline.reportSignature
		const sceneBytesSettled =
			optimisticSaveBaseline.sceneBytes === null ||
			(latestSceneStats?.currentSceneBytes ?? null) ===
				optimisticSaveBaseline.sceneBytes

		if (
			settingsSettled &&
			sceneMetaSettled &&
			reportSettled &&
			sceneBytesSettled
		) {
			setOptimisticSaveBaseline(null)
		}
	}, [
		currentSceneId,
		lastSavedSceneId,
		lastSavedReportSignature,
		lastSavedSceneMeta,
		lastSavedSettings,
		latestSceneStats,
		optimisticSaveBaseline
	])

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

			const saveToken = Symbol('scene-save')
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
			inFlightSaveTokenRef.current = saveToken

			try {
				return await savePromise
			} finally {
				if (inFlightSaveTokenRef.current === saveToken) {
					inFlightSaveRef.current = null
					inFlightSaveTokenRef.current = null
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

			setOptimisticSaveBaseline({
				sceneId: currentSceneId,
				settings: settingsSnapshot,
				sceneMeta: sceneMetaSnapshot,
				reportSignature: reportSignatureSnapshot,
				sceneBytes: sceneCurrentBytes ?? null
			})
			setHasUnsavedChanges(false)

			let result: SaveSceneResult | { unchanged: true } | undefined

			try {
				result = await saveToDB({
					includeOptimizationReport: hasOptimizationReportChanges,
					initialSceneBytes: sceneInitialBytes,
					currentSceneBytes: sceneCurrentBytes,
					targetProjectId: target?.targetProjectId,
					targetFolderId: target?.targetFolderId
				})
			} catch (error) {
				setOptimisticSaveBaseline(null)
				throw error
			}

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
				setOptimisticSaveBaseline({
					sceneId: persistedSceneId ?? null,
					settings: settingsSnapshot,
					sceneMeta: savedSceneMeta,
					reportSignature: reportSignatureSnapshot,
					sceneBytes:
						result.stats?.currentSceneBytes ?? sceneCurrentBytes ?? null
				})

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

			if (!result || result.unchanged) {
				setOptimisticSaveBaseline(null)
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
			setHasUnsavedChanges,
			revalidate,
			clearPendingDraft
		]
	)

	const effectiveLastSavedSettings =
		optimisticSaveBaseline?.settings ?? lastSavedSettings
	const effectiveLastSavedSceneMeta =
		optimisticSaveBaseline?.sceneMeta ?? lastSavedSceneMeta
	const effectiveLastSavedReportSignature =
		optimisticSaveBaseline?.reportSignature ?? lastSavedReportSignature
	const effectiveLastSavedSceneBytes =
		optimisticSaveBaseline?.sceneBytes ?? null

	const hasChanges = useMemo(
		() =>
			hasUnsavedSceneChanges({
				isInitializing,
				currentSettings,
				lastSavedSettings: effectiveLastSavedSettings,
				sceneMetaState,
				lastSavedSceneMeta: effectiveLastSavedSceneMeta,
				reportSignature,
				lastSavedReportSignature: effectiveLastSavedReportSignature,
				lastSavedSceneBytes: effectiveLastSavedSceneBytes,
				optimizedSceneBytes,
				latestSceneStats
			}),
		[
			isInitializing,
			currentSettings,
			effectiveLastSavedSettings,
			sceneMetaState,
			effectiveLastSavedSceneMeta,
			reportSignature,
			effectiveLastSavedReportSignature,
			effectiveLastSavedSceneBytes,
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
