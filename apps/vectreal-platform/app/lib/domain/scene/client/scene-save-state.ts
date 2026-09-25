export type SaveAvailabilityReason =
	| 'ready'
	| 'no-model'
	| 'no-user'
	| 'no-unsaved-changes'
	| 'requires-size-reduction'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
}

interface SaveAvailabilityArgs {
	/** Whether a model is on the stage. */
	hasModel: boolean
	userId?: string
	isSceneOverSizeLimit: boolean
	hasChanges: boolean
}

export const resolveSaveAvailability = ({
	hasModel,
	userId,
	isSceneOverSizeLimit,
	hasChanges
}: SaveAvailabilityArgs): SaveAvailabilityState => {
	/*
	  First, ahead of the account. The header is on screen before anything is
	  loaded, and a signed-out visitor with an empty stage would otherwise be
	  offered "Sign In to Save" and sent to sign in carrying an empty draft.
	*/
	if (!hasModel) {
		return { canSave: false, reason: 'no-model' }
	}

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

/**
 * Whether a Save control should refuse the click. Every refusal does, except
 * the one for want of an account: that click is the way to sign in, with the
 * scene kept as a draft. Both Save controls read it, the header's and the
 * publish panel's, so they cannot disagree about an empty stage.
 */
export const isSaveActionBlocked = ({
	canSave,
	reason
}: SaveAvailabilityState): boolean => !canSave && reason !== 'no-user'
