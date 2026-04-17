import type { SceneAggregateResponse } from '../../../../types/api'

export type SaveAvailabilityReason =
	| 'ready'
	| 'no-user'
	| 'no-unsaved-changes'
	| 'requires-first-optimization'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
	isFirstSavePendingOptimization: boolean
}

interface SceneInitializationArgs {
	hasSceneChanged: boolean
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse
	isPostSaveNavigation: boolean
}

export const shouldInitializeScene = ({
	hasSceneChanged,
	paramSceneId,
	initialSceneAggregate,
	isPostSaveNavigation
}: SceneInitializationArgs): boolean => {
	return (
		hasSceneChanged &&
		!!paramSceneId &&
		!!initialSceneAggregate &&
		!isPostSaveNavigation
	)
}

interface FirstSaveOptimizationArgs {
	currentSceneId: null | string
	lastSavedSceneId: null | string
	hasAppliedOptimization: boolean
}

export const shouldRequireFirstSaveOptimization = ({
	currentSceneId,
	lastSavedSceneId,
	hasAppliedOptimization
}: FirstSaveOptimizationArgs): boolean => {
	return !currentSceneId && !lastSavedSceneId && !hasAppliedOptimization
}

interface SaveAvailabilityArgs {
	userId?: string
	isFirstSavePendingOptimization: boolean
	hasChanges: boolean
}

export const resolveSaveAvailability = ({
	userId,
	isFirstSavePendingOptimization,
	hasChanges
}: SaveAvailabilityArgs): SaveAvailabilityState => {
	if (!userId) {
		return {
			canSave: false,
			reason: 'no-user',
			isFirstSavePendingOptimization
		}
	}

	if (isFirstSavePendingOptimization) {
		return {
			canSave: false,
			reason: 'requires-first-optimization',
			isFirstSavePendingOptimization: true
		}
	}

	if (!hasChanges) {
		return {
			canSave: false,
			reason: 'no-unsaved-changes',
			isFirstSavePendingOptimization: false
		}
	}

	return {
		canSave: true,
		reason: 'ready',
		isFirstSavePendingOptimization: false
	}
}
