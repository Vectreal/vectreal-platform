import { useEffect, useRef } from 'react'

import { sceneMetaInitialState } from '../lib/stores/publisher-config-store'
import { optimizationRuntimeInitialState } from '../lib/stores/scene-optimization-store'

import type { SceneAggregateResponse } from '../types/api'
import type { SceneMetaState } from '../types/publisher-config'
import type { SceneOptimizationRuntimeState } from '../types/scene-optimization'

interface UseSceneParamsSyncParams {
	paramSceneId: null | string
	sceneMeta: null | SceneMetaState
	initialSceneAggregate: null | SceneAggregateResponse
	resetSceneState: () => void
	setCurrentSceneId: (sceneId: null | string) => void
	setSceneMetaState: (
		next: SceneMetaState | ((prev: SceneMetaState) => SceneMetaState)
	) => void
	setLastSavedSceneMeta: (sceneMetaState: null | SceneMetaState) => void
	setIsInitializing: (initializing: boolean) => void
	setHasUnsavedChanges: (hasChanges: boolean) => void
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	/** The scene ID of the most recent successfully-persisted save. Used to
	 *  detect post-save navigation so we can skip destructive resets. */
	lastSavedSceneId: string | null
	setLastSavedSceneId: (sceneId: string | null) => void
}

export const useSceneParamsSync = ({
	paramSceneId,
	sceneMeta,
	initialSceneAggregate,
	resetSceneState,
	setCurrentSceneId,
	setSceneMetaState,
	setLastSavedSceneMeta,
	setIsInitializing,
	setHasUnsavedChanges,
	setOptimizationRuntime,
	lastSavedSceneId,
	setLastSavedSceneId
}: UseSceneParamsSyncParams) => {
	const previousParamSceneIdRef = useRef<null | string>(null)

	useEffect(() => {
		const isNewUploadFlow = !paramSceneId && !initialSceneAggregate
		const hasSceneChanged = previousParamSceneIdRef.current !== paramSceneId

		// Detect navigation to the scene that was just saved (null → newId after
		// first save). In this case the save flow already established correct
		// baselines, so we must NOT overwrite them with the initialised/reset values.
		const isPostSaveNavigation =
			hasSceneChanged && !!paramSceneId && paramSceneId === lastSavedSceneId

		if (isNewUploadFlow) {
			resetSceneState()
		}

		setCurrentSceneId(paramSceneId)

		if (hasSceneChanged || isNewUploadFlow) {
			if (isPostSaveNavigation) {
				// Post-save navigation: baselines are already correct. Only sync the
				// server-returned stats and clear the marker so subsequent navigation
				// is treated as a genuine scene change.
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

		setLastSavedSceneMeta(sceneMeta ?? null)
		setIsInitializing(!!paramSceneId && !!initialSceneAggregate)

		previousParamSceneIdRef.current = paramSceneId
	}, [
		paramSceneId,
		sceneMeta,
		initialSceneAggregate,
		setSceneMetaState,
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
