import { useEffect, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import { executePendingSceneDraftHydration } from '../lib/domain/scene'
import { loadPendingSceneDraft } from '../lib/persistence/pending-scene-idb'

import type { SceneAggregateResponse } from '../types/api'
import type { SceneMetaState } from '../types/publisher-config'
import type {
	OptimizationPreset,
	OptimizationState
} from '../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'
import type {
	SceneDataLoadOptions,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model'

interface UseSceneDraftRehydrationParams {
	pendingSceneHydratedRef: MutableRefObject<boolean>
	shouldRestorePendingDraft: boolean
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse
	fileModel: unknown
	isFileLoading: boolean
	locationPathname: string
	onRestoreHandled?: () => void
	setIsDownloading: (loading: boolean) => void
	inferOptimizationPreset: (optimizations: Optimizations) => OptimizationPreset
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	loadFromData: (params: SceneDataLoadOptions) => Promise<SceneLoadResult>
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
}

export const useSceneDraftRehydration = ({
	pendingSceneHydratedRef,
	shouldRestorePendingDraft,
	paramSceneId,
	initialSceneAggregate,
	fileModel,
	isFileLoading,
	locationPathname,
	onRestoreHandled,
	setIsDownloading,
	inferOptimizationPreset,
	setOptimizationState,
	loadFromData,
	setSceneMetaState,
	setLastSavedSceneMeta
}: UseSceneDraftRehydrationParams) => {
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
				const draft = await loadPendingSceneDraft()
				if (!draft) {
					return
				}

				await executePendingSceneDraftHydration({
					draft,
					inferOptimizationPreset,
					setOptimizationState,
					loadFromData,
					setSceneMetaState,
					setLastSavedSceneMeta
				})
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
		paramSceneId,
		initialSceneAggregate,
		fileModel,
		isFileLoading,
		onRestoreHandled,
		setIsDownloading,
		inferOptimizationPreset,
		setOptimizationState,
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
