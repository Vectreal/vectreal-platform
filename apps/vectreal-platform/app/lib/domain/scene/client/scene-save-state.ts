export type SaveAvailabilityReason =
	'ready' | 'opening' | 'no-model' | 'no-user' | 'no-unsaved-changes'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
}

interface SaveAvailabilityArgs {
	/** Whether a model is on the stage. */
	hasModel: boolean
	/**
	 * A saved scene is open and its model is not on the stage yet. What is open
	 * is the stored scene, so there is nothing to save, and it is not the empty
	 * stage `no-model` describes either.
	 */
	isOpeningSavedScene: boolean
	userId?: string
	hasChanges: boolean
}

export const resolveSaveAvailability = ({
	hasModel,
	isOpeningSavedScene,
	userId,
	hasChanges
}: SaveAvailabilityArgs): SaveAvailabilityState => {
	if (isOpeningSavedScene) {
		return { canSave: false, reason: 'opening' }
	}

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
