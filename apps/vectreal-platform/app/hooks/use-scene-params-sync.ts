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
	setOptimizationRuntime: (next: SceneOptimizationRuntimeState) => void
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
	setOptimizationRuntime
}: UseSceneParamsSyncParams) => {
	const previousParamSceneIdRef = useRef<null | string>(null)

	useEffect(() => {
		const isNewUploadFlow = !paramSceneId && !initialSceneAggregate
		const hasSceneChanged = previousParamSceneIdRef.current !== paramSceneId

		if (isNewUploadFlow) {
			resetSceneState()
		}

		setCurrentSceneId(paramSceneId)

		// Only reset live scene meta when the scene itself changes (new scene or
		// navigation to a different scene). On same-scene revalidations (e.g. after
		// a save) we must NOT overwrite the live state because the user may have
		// made edits during the in-flight save that would be silently discarded.
		if (hasSceneChanged || isNewUploadFlow) {
			const nextMeta = sceneMeta ?? sceneMetaInitialState
			setSceneMetaState(nextMeta)
			setHasUnsavedChanges(false)
		}

		setLastSavedSceneMeta(sceneMeta ?? null)
		setIsInitializing(!!paramSceneId && !!initialSceneAggregate)

		if (hasSceneChanged || isNewUploadFlow) {
			setOptimizationRuntime({
				...optimizationRuntimeInitialState,
				lastSavedReportSignature: null,
				latestSceneStats: initialSceneAggregate?.stats ?? null
			})
		}

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
		setCurrentSceneId
	])
}
