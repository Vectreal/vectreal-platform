import { optimizationsMatch } from './optimization-inference'
import { originalPreset } from '../../../../constants/optimizations'
import { MAX_STORED_FILE_BYTES } from '../../../../constants/utility-constants'

import type { KeptOriginalRef } from './scene-save-orchestrator'
import type { SceneSourceRef } from '../../../../types/api'
import type { KeptOriginalState } from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

/** What a save does with the scene's original. */
export type SourceToSave =
	/** Keeps no original; any the scene had is unlinked and reclaimed. */
	| { kind: 'none' }
	/** Re-links the original the server already holds, sending no bytes. */
	| { kind: 'linked'; source: SceneSourceRef }
	/** Sends the optimizer's source as the original. */
	| { kind: 'upload'; bytes: Uint8Array }

interface SourceState {
	/** The original the server holds and the optimizer has not loaded yet. */
	stored: SceneSourceRef | null
	/** What the optimizer's source embodies. */
	sourceSettings: Optimizations
	/** What the document on screen was derived from. */
	derivedFrom: Optimizations
	/** The optimizer's source, which a save sends as the original. */
	source: Uint8Array | null
}

/** An untouched source the document on screen was optimized from. */
const isUntouchedOriginal = ({
	sourceSettings,
	derivedFrom
}: Pick<SourceState, 'sourceSettings' | 'derivedFrom'>) =>
	optimizationsMatch(sourceSettings, originalPreset) &&
	!optimizationsMatch(derivedFrom, originalPreset)

/**
 * Whether the scene has an original worth keeping: one the server already
 * holds, or an untouched source the document on screen was optimized from,
 * small enough for storage to accept as one file.
 *
 * A source that is itself a saved, optimized version is not an original, and
 * a document that is the original needs no second copy of itself.
 */
export const hasOriginalToKeep = (state: SourceState): boolean =>
	state.stored !== null ||
	(isUntouchedOriginal(state) &&
		state.source !== null &&
		state.source.byteLength <= MAX_STORED_FILE_BYTES)

/**
 * Whether the scene has an original storage cannot take: sending it would
 * fail the whole save, so it is not kept, and the author is told why.
 */
export const isOriginalTooLargeToKeep = (state: SourceState): boolean =>
	state.stored === null &&
	isUntouchedOriginal(state) &&
	state.source !== null &&
	state.source.byteLength > MAX_STORED_FILE_BYTES

/**
 * Whether every pass starts from the saved, already optimized document: the
 * scene was saved without its original, or its kept original could not be
 * read. A stored original that loads is the source from the first pass on.
 */
export const derivesFromSavedVersion = ({
	stored,
	unreadable,
	sourceSettings
}: Pick<SourceState, 'stored' | 'sourceSettings'> & {
	unreadable: boolean
}): boolean =>
	(stored === null || unreadable) &&
	!optimizationsMatch(sourceSettings, originalPreset)

/** Whether the next save keeps an original. */
export const wouldKeepOriginal = ({
	keep,
	...state
}: SourceState & { keep: boolean }): boolean => keep && hasOriginalToKeep(state)

/**
 * What the next save does with the original.
 *
 * A stored original is re-linked by id while it is still stored: until the
 * optimizer has loaded it, the optimizer's source is the saved document, and
 * sending that would replace the original with an optimized copy.
 */
export const resolveSourceToSave = ({
	keep,
	...state
}: SourceState & { keep: boolean }): SourceToSave => {
	if (!wouldKeepOriginal({ keep, ...state })) return { kind: 'none' }
	if (state.stored) return { kind: 'linked', source: state.stored }
	return state.source
		? { kind: 'upload', bytes: state.source }
		: { kind: 'none' }
}

/**
 * The kept-original state once a save has finished. It is saved exactly when
 * the save kept one, and an original the optimizer has not loaded yet is read
 * back from wherever the save left it: a move re-uploads it under a new id.
 */
export const recordSavedOriginal = (
	prev: KeptOriginalState,
	kept: KeptOriginalRef | null
): KeptOriginalState => ({
	...prev,
	saved: kept !== null,
	stored:
		kept && prev.stored
			? { ...prev.stored, assetId: kept.assetId, url: kept.url }
			: null
})

/**
 * Whether the drawer can hold the source up against the document: only while
 * it is open and settled, and only when the document differs from its source.
 * Never during a save, whose thumbnail and shadow bake capture whatever model
 * is mounted.
 */
export const canCompareWithSource = ({
	isOpen,
	isPending,
	isLoadingOriginal,
	isSaving,
	sourceSettings,
	derivedFrom
}: Pick<SourceState, 'sourceSettings' | 'derivedFrom'> & {
	isOpen: boolean
	isPending: boolean
	isLoadingOriginal: boolean
	isSaving: boolean
}): boolean =>
	isOpen &&
	!isPending &&
	!isLoadingOriginal &&
	!isSaving &&
	!optimizationsMatch(derivedFrom, sourceSettings)
