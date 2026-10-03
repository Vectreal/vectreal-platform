import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	buildOptimizationReportSignature,
	executeSceneSaveOrchestrator,
	hasSceneMetaChanged,
	hasSceneSettingsChanged,
	hasOptimizationChanges,
	hasUnsavedSceneChanges,
	resolveSaveAvailability,
	type SaveSceneOrchestratorOptions,
	type SaveAvailabilityState
} from '../../lib/domain/scene'
import {
	isSceneOverSizeLimit,
	resolveSceneCurrentBytes
} from '../../lib/domain/scene/scene-size-limit'
import {
	currentLocationAtom,
	maxSceneBytesAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'
import { dispatchSaveProgressAtom } from '../../lib/stores/save-progress-store'
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
		hasModel,
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
		suppressDirtyDetection,
		hasUnsavedOriginalChoice
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
		captureShadowBake,
		resolveSource,
		recordSavedSource
	} = actions

	const setCurrentLocation = useSetAtom(currentLocationAtom)
	const setSaveLocation = useSetAtom(saveLocationAtom)
	const dispatchSaveProgress = useSetAtom(dispatchSaveProgressAtom)
	const maxSceneBytes = useAtomValue(maxSceneBytesAtom)
	// What the dirty check last said, for a failed save to put back.
	const hasChangesRef = useRef(false)
	// The open scene when a save settles, which may not be the one it saved.
	const currentSceneIdRef = useRef(currentSceneId)
	currentSceneIdRef.current = currentSceneId
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

	const sceneCurrentBytes = useMemo(
		() =>
			resolveSceneCurrentBytes({
				optimizedSceneBytes,
				persistedCurrentSceneBytes: latestSceneStats?.currentSceneBytes,
				clientSceneBytes
			}),
		[optimizedSceneBytes, latestSceneStats?.currentSceneBytes, clientSceneBytes]
	)

	const sceneOverSizeLimit = useMemo(
		() => isSceneOverSizeLimit(sceneCurrentBytes, maxSceneBytes),
		[sceneCurrentBytes, maxSceneBytes]
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
				const source = resolveSource()
				const savedSceneId = currentSceneId
				try {
					const result = await executeSceneSaveOrchestrator({
						userId,
						currentSceneId,
						currentSettings,
						sceneMetaState,
						lastSavedSceneMeta,
						lastSavedSettings,
						optimizationSettings,
						optimizationReport: optimizationReport ?? null,
						options,
						createRequestId,
						prepareGltfDocumentForUpload,
						captureSceneThumbnail,
						captureShadowBake,
						onProgress: dispatchSaveProgress,
						source
					})
					// What it kept describes the scene it saved. Another scene opened
					// meanwhile has its own original, which this must not overwrite.
					if (currentSceneIdRef.current === savedSceneId) {
						recordSavedSource(result.keptOriginal)
					}
					return result
				} catch (error) {
					console.error('Failed to save scene settings:', {
						sceneId: currentSceneId || null,
						error
					})
					dispatchSaveProgress({
						type: 'failed',
						message:
							error instanceof Error
								? error.message
								: 'The save did not complete.'
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
			captureShadowBake,
			createRequestId,
			currentSceneId,
			currentSettings,
			dispatchSaveProgress,
			lastSavedSceneMeta,
			sceneMetaState,
			optimizationSettings,
			optimizationReport,
			prepareGltfDocumentForUpload,
			recordSavedSource,
			resolveSource,
			userId
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
				// The flag was cleared up front. Dropping the baseline brings back
				// edits it covered, but the sync only runs when the dirty check
				// changes, and a pending choice about the original kept it from
				// changing at all, so the check's own answer is written back.
				setHasUnsavedChanges(hasChangesRef.current)
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

				// Mark which scene was just saved, so the publish panel can act on the
				// new scene during the window before the route param catches up.
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
			(!suppressDirtyDetection && hasUnsavedOriginalChoice) ||
			hasUnsavedSceneChanges({
				suppressDirtyDetection,
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
			suppressDirtyDetection,
			hasUnsavedOriginalChoice,
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

	hasChangesRef.current = hasChanges

	useEffect(() => {
		if (suppressDirtyDetection) {
			return
		}

		setHasUnsavedChanges(hasChanges)
	}, [suppressDirtyDetection, hasChanges, setHasUnsavedChanges])

	const saveAvailability: SaveAvailabilityState = useMemo(
		() =>
			resolveSaveAvailability({
				hasModel,
				userId,
				isSceneOverSizeLimit: sceneOverSizeLimit,
				hasChanges
			}),
		[hasModel, userId, sceneOverSizeLimit, hasChanges]
	)

	return {
		saveSceneSettings,
		saveAvailability
	}
}
