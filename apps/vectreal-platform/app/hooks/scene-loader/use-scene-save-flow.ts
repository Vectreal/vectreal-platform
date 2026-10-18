import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	applyHotspotArtworkRewrites,
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
	capturedThumbnailFrameAtom,
	currentLocationAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'
import { dispatchSaveProgressAtom } from '../../lib/stores/save-progress-store'
import { hotspotsAtom } from '../../lib/stores/scene-settings-store'
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
		clientSceneBytes,
		lastSavedReportSignature,
		passRevision,
		savedPassRevision,
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
	const setHotspots = useSetAtom(hotspotsAtom)
	const capturedThumbnailFrame = useAtomValue(capturedThumbnailFrameAtom)
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
	}>(null)

	const reportSignature = useMemo(
		() => buildOptimizationReportSignature(optimizationReport),
		[optimizationReport]
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
		// A pass needs no baseline: the save records it when it lands.
		if (settingsSettled && sceneMetaSettled && reportSettled) {
			setOptimisticSaveBaseline(null)
		}
	}, [
		currentSceneId,
		lastSavedSceneId,
		lastSavedReportSignature,
		lastSavedSceneMeta,
		lastSavedSettings,
		optimisticSaveBaseline
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
						capturedThumbnailFrame,
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
						// Uploaded artwork now has its address: the editor holds that
						// rather than the picked image, so the next save relinks it.
						setHotspots((previous) =>
							applyHotspotArtworkRewrites(
								previous,
								result.hotspotArtworkRewrites
							)
						)
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
			capturedThumbnailFrame,
			captureShadowBake,
			createRequestId,
			currentSceneId,
			currentSettings,
			dispatchSaveProgress,
			lastSavedSceneMeta,
			lastSavedSettings,
			sceneMetaState,
			optimizationSettings,
			optimizationReport,
			prepareGltfDocumentForUpload,
			recordSavedSource,
			resolveSource,
			setHotspots,
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
			const passRevisionSnapshot = passRevision
			const requestedSaveLocation = {
				targetProjectId: target?.targetProjectId,
				targetFolderId: target?.targetFolderId ?? null
			}

			const hasOptimizationReportChanges = hasOptimizationChanges({
				reportSignature: reportSignatureSnapshot,
				lastSavedReportSignature,
				passRevision: passRevisionSnapshot,
				savedPassRevision
			})
			const sceneInitialBytes =
				typeof clientSceneBytes === 'number' ? clientSceneBytes : undefined

			setOptimisticSaveBaseline({
				sceneId: currentSceneId,
				settings: settingsSnapshot,
				sceneMeta: sceneMetaSnapshot,
				reportSignature: reportSignatureSnapshot
			})
			setHasUnsavedChanges(false)

			let result: SaveSceneResult | { unchanged: true } | undefined

			try {
				result = await saveToDB({
					includeOptimizationReport: hasOptimizationReportChanges,
					initialSceneBytes: sceneInitialBytes,
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
				// remain detectable as diffs against the new baseline. Artwork the save
				// uploaded is at its new address in both the editor and the baseline.
				const savedSettings = settingsSnapshot.hotspots
					? {
							...settingsSnapshot,
							hotspots: applyHotspotArtworkRewrites(
								settingsSnapshot.hotspots,
								result.hotspotArtworkRewrites ?? []
							)
						}
					: settingsSnapshot
				setLastSavedSettings(savedSettings)
				setLastSavedSceneMeta(savedSceneMeta)

				// Mark which scene was just saved, so the publish panel can act on the
				// new scene during the window before the route param catches up.
				const persistedSceneId = result.sceneId || currentSceneId
				setLastSavedSceneId(persistedSceneId ?? null)
				setOptimisticSaveBaseline({
					sceneId: persistedSceneId ?? null,
					settings: savedSettings,
					sceneMeta: savedSceneMeta,
					reportSignature: reportSignatureSnapshot
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
				// Stored either way, an unchanged answer included: a pass that
				// rebuilt the document the scene already stores changed nothing.
				// The snapshot, not the live revision, so a pass that finished
				// mid-save stays unsaved. Only while the saved scene is still the
				// one open: another scene's runtime has its own saved revision.
				const openSceneId = currentSceneIdRef.current
				if (
					openSceneId === currentSceneId ||
					('sceneId' in result && openSceneId === result.sceneId)
				) {
					setOptimizationRuntime((prev) => ({
						...prev,
						savedPassRevision: passRevisionSnapshot
					}))
				}
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
			passRevision,
			savedPassRevision,
			clientSceneBytes,
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
				passRevision,
				savedPassRevision
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
			passRevision,
			savedPassRevision
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
				hasChanges
			}),
		[hasModel, userId, hasChanges]
	)

	return {
		saveSceneSettings,
		saveAvailability
	}
}
