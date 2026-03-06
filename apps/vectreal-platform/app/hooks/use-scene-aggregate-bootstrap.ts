import { useEffect, type MutableRefObject } from 'react'

import type { SceneAggregateResponse } from '../types/api'

interface UseSceneAggregateBootstrapParams {
	sceneLoadAttemptedRef: MutableRefObject<boolean>
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse
	fileModel: unknown
	isFileLoading: boolean
	setIsInitializing: (initializing: boolean) => void
	loadSceneFromAggregate: (
		sceneId: string,
		aggregate: SceneAggregateResponse
	) => Promise<void>
}

export const useSceneAggregateBootstrap = ({
	sceneLoadAttemptedRef,
	paramSceneId,
	initialSceneAggregate,
	fileModel,
	isFileLoading,
	setIsInitializing,
	loadSceneFromAggregate
}: UseSceneAggregateBootstrapParams) => {
	useEffect(() => {
		sceneLoadAttemptedRef.current = false
	}, [paramSceneId, sceneLoadAttemptedRef])

	useEffect(() => {
		if (!paramSceneId) {
			setIsInitializing(false)
			return
		}

		if (!initialSceneAggregate) {
			setIsInitializing(false)
			return
		}

		if (fileModel || isFileLoading || sceneLoadAttemptedRef.current) {
			return
		}

		loadSceneFromAggregate(paramSceneId, initialSceneAggregate).finally(() =>
			setIsInitializing(false)
		)
	}, [
		paramSceneId,
		initialSceneAggregate,
		fileModel,
		isFileLoading,
		loadSceneFromAggregate,
		setIsInitializing,
		sceneLoadAttemptedRef
	])
}
