import type { SceneAggregateResponse } from '../../../../types/api'

export type SaveAvailabilityReason =
	| 'ready'
	| 'no-user'
	| 'no-unsaved-changes'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
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

interface SaveAvailabilityArgs {
	userId?: string
	hasChanges: boolean
}

export const resolveSaveAvailability = ({
	userId,
	hasChanges
}: SaveAvailabilityArgs): SaveAvailabilityState => {
	if (!userId) {
		return {
			canSave: false,
			reason: 'no-user'
		}
	}

	if (!hasChanges) {
		return {
			canSave: false,
			reason: 'no-unsaved-changes'
		}
	}

	return {
		canSave: true,
		reason: 'ready'
	}
}
