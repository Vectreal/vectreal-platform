export type SaveAvailabilityReason =
	'ready' | 'no-user' | 'no-unsaved-changes' | 'requires-size-reduction'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
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
