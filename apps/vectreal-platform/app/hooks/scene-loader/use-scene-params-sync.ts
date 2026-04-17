import { useEffect, useRef } from 'react'

import {
	getSettingsFromAggregate,
	shouldInitializeScene
} from '../../lib/domain/scene'
import { sceneMetaInitialState } from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeInitialState } from '../../lib/stores/scene-optimization-store'

import type { UseSceneParamsSyncArgs } from './contracts'

export const useSceneParamsSync = ({
	routeState,
	actions
}: UseSceneParamsSyncArgs) => {
	const { paramSceneId, sceneMeta, initialSceneAggregate, lastSavedSceneId } =
		routeState
	const {
		resetSceneState,
		setCurrentSceneId,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime,
		setLastSavedSceneId
	} = actions

	const previousParamSceneIdRef = useRef<null | string>(null)

	useEffect(() => {
		const isNewUploadFlow = !paramSceneId && !initialSceneAggregate
		const hasSceneChanged = previousParamSceneIdRef.current !== paramSceneId
		const shouldResetForNewUpload = isNewUploadFlow && hasSceneChanged

		// Detect navigation to the scene that was just saved (null → newId after
		// first save). In this case the save flow already established correct
		// baselines, so we must NOT overwrite them with the initialised/reset values.
		const isPostSaveNavigation =
			hasSceneChanged && !!paramSceneId && paramSceneId === lastSavedSceneId

		if (shouldResetForNewUpload) {
			resetSceneState()
		}

		if (hasSceneChanged) {
			setCurrentSceneId(paramSceneId)
		}

		if (hasSceneChanged || shouldResetForNewUpload) {
			if (isPostSaveNavigation) {
				// Post-save navigation: baselines are already correct. Only sync the
				// server-returned stats and clear the marker so subsequent navigation
				// is treated as a genuine scene change.
				const persistedSettings = getSettingsFromAggregate(
					initialSceneAggregate
				)
				if (persistedSettings) {
					setLastSavedSettings(persistedSettings)
				}
				setLastSavedSceneMeta(sceneMeta ?? null)
				setOptimizationRuntime((prev) => ({
					...prev,
					latestSceneStats:
						initialSceneAggregate?.stats ?? prev.latestSceneStats
				}))
				setLastSavedSceneId(null)
			} else {
				// Genuine scene change: reset meta, unsaved-changes flag, and
				// optimization runtime to the server's ground-truth values.
				const nextMeta = sceneMeta ?? sceneMetaInitialState
				setSceneMetaState(nextMeta)
				setHasUnsavedChanges(false)
				setOptimizationRuntime({
					...optimizationRuntimeInitialState,
					lastSavedReportSignature: null,
					latestSceneStats: initialSceneAggregate?.stats ?? null
				})
			}
		}

		if (!isNewUploadFlow && !isPostSaveNavigation) {
			setLastSavedSceneMeta(sceneMeta ?? null)
		}
		setIsInitializing(
			shouldInitializeScene({
				hasSceneChanged,
				paramSceneId,
				initialSceneAggregate,
				isPostSaveNavigation
			})
		)

		previousParamSceneIdRef.current = paramSceneId
	}, [
		paramSceneId,
		sceneMeta,
		initialSceneAggregate,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		resetSceneState,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime,
		setCurrentSceneId,
		lastSavedSceneId,
		setLastSavedSceneId
	])
}
