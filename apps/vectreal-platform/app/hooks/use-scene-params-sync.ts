import { useEffect } from 'react'

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
	setSceneMetaState: (sceneMetaState: SceneMetaState) => void
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
	useEffect(() => {
		const isNewUploadFlow = !paramSceneId && !initialSceneAggregate

		if (isNewUploadFlow) {
			resetSceneState()
		}

		setCurrentSceneId(paramSceneId)
		const nextMeta = sceneMeta ?? sceneMetaInitialState
		setSceneMetaState(nextMeta)
		setLastSavedSceneMeta(sceneMeta ?? null)
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
