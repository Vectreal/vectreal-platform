import { useEffect } from 'react'
import { toast } from 'sonner'

import { executePendingSceneDraftHydration } from '../../lib/domain/scene'
import {
	loadPendingSceneDraft,
	setTabDraftId
} from '../../lib/persistence/pending-scene-idb'

import type { UseSceneDraftRehydrationArgs } from './contracts'

export const useSceneDraftRehydration = ({
	restoreRequest,
	hydrationActions,
	optimizationActions
}: UseSceneDraftRehydrationArgs) => {
	const {
		pendingSceneHydratedRef,
		shouldRestorePendingDraft,
		draftId,
		paramSceneId,
		initialSceneAggregate,
		fileModel,
		isFileLoading,
		locationPathname,
		onRestoreHandled
	} = restoreRequest
	const {
		setIsDownloading,
		loadFromData,
		setSceneMetaState,
		setLastSavedSceneMeta
	} = hydrationActions
	const {
		inferOptimizationPreset,
		setOptimizationState,
		setOptimizationRuntime
	} = optimizationActions

	useEffect(() => {
		if (pendingSceneHydratedRef.current) {
			return
		}

		if (!shouldRestorePendingDraft) {
			return
		}

		if (paramSceneId || initialSceneAggregate || fileModel || isFileLoading) {
			return
		}

		pendingSceneHydratedRef.current = true

		void (async () => {
			setIsDownloading(true)

			try {
				const draft = await loadPendingSceneDraft(draftId)
				if (!draft) {
					return
				}

				await executePendingSceneDraftHydration({
					draft,
					inferOptimizationPreset,
					setOptimizationState,
					setOptimizationRuntime,
					loadFromData,
					setSceneMetaState,
					setLastSavedSceneMeta
				})

				// Re-anchor sessionStorage tab ID so subsequent IDB lookups
				// (e.g. loadOriginalSceneModel) resolve the correct entries in a
				// new OAuth tab that started with a fresh sessionStorage.
				if (draftId) {
					setTabDraftId(draftId)
				}

				toast.success('Restored your unsaved scene from this browser')
			} catch (error) {
				console.error('Failed to restore pending scene draft:', error)
				toast.error('Failed to restore your saved draft')
			} finally {
				setIsDownloading(false)
				onRestoreHandled?.()
			}
		})()
	}, [
		shouldRestorePendingDraft,
		draftId,
		paramSceneId,
		initialSceneAggregate,
		fileModel,
		isFileLoading,
		onRestoreHandled,
		setIsDownloading,
		inferOptimizationPreset,
		setOptimizationState,
		setOptimizationRuntime,
		loadFromData,
		setSceneMetaState,
		setLastSavedSceneMeta,
		pendingSceneHydratedRef
	])

	useEffect(() => {
		if (!locationPathname.startsWith('/publisher')) {
			pendingSceneHydratedRef.current = false
		}
	}, [locationPathname, pendingSceneHydratedRef])
}
