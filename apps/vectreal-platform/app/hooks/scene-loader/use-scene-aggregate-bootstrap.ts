import { useEffect } from 'react'

import type { UseSceneAggregateBootstrapArgs } from './contracts'

export const useSceneAggregateBootstrap = ({
	bootstrapState,
	actions
}: UseSceneAggregateBootstrapArgs) => {
	const {
		sceneLoadAttemptedRef,
		paramSceneId,
		initialSceneAggregate,
		fileModel,
		isFileLoading
	} = bootstrapState
	const { setIsInitializing, loadSceneFromAggregate } = actions

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

		// When a model is already present (e.g. right after first-save navigation
		// from /publisher -> /publisher/:sceneId), bootstrap loading is skipped.
		// Ensure initialization still completes so unsaved-change detection can run.
		if (fileModel) {
			setIsInitializing(false)
			return
		}

		if (isFileLoading || sceneLoadAttemptedRef.current) {
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
