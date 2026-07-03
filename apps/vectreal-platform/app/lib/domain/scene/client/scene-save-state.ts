import type { SceneAggregateResponse, SceneManifestResponse } from '../../../../types/api'

export type SaveAvailabilityReason =
	| 'ready'
	| 'no-user'
	| 'no-unsaved-changes'
	| 'requires-size-reduction'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
}

interface SceneInitializationArgs {
	hasSceneChanged: boolean
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse | SceneManifestResponse
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
	isSceneOverSizeLimit: boolean
	hasChanges: boolean
}

export const resolveSaveAvailability = ({
	userId,
	isSceneOverSizeLimit,
	hasChanges
}: SaveAvailabilityArgs): SaveAvailabilityState => {
	if (!userId) {
		return { canSave: false, reason: 'no-user' }
	}

	if (isSceneOverSizeLimit) {
		return { canSave: false, reason: 'requires-size-reduction' }
	}

	if (!hasChanges) {
		return { canSave: false, reason: 'no-unsaved-changes' }
	}

	return { canSave: true, reason: 'ready' }
}
