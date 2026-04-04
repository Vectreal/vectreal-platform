import { useAtomValue } from 'jotai/react'

import {
	currentLocationAtom,
	saveLocationAtom
} from '../lib/stores/publisher-config-store'

export interface LocationChangeState {
	/** Effective project id that would be used on save (explicit selection or fallback to persisted). */
	effectiveTargetProjectId: string | undefined
	/** Effective folder id that would be used on save. Null means "root of project". */
	effectiveTargetFolderId: string | null
	/** True when the effective target differs from the currently persisted location. */
	hasUnsavedLocationChange: boolean
}

/**
 * Derives the effective save-target location and whether it differs from
 * the currently persisted scene location.
 *
 * Both ControlsOverlay and LocationRow in SceneNameAndLocation need this
 * identical logic; this hook is the single canonical source.
 */
export function useLocationChangeState(): LocationChangeState {
	const currentLocation = useAtomValue(currentLocationAtom)
	const saveLocation = useAtomValue(saveLocationAtom)

	const effectiveTargetProjectId =
		saveLocation.targetProjectId ?? currentLocation.projectId ?? undefined

	// When an explicit project is selected, honour its folder selection
	// (null → root).  Otherwise fall back to the persisted folder so we
	// never accidentally move the scene to a different folder on save.
	const effectiveTargetFolderId = saveLocation.targetProjectId
		? (saveLocation.targetFolderId ?? null)
		: currentLocation.folderId

	const hasUnsavedLocationChange =
		effectiveTargetProjectId !== (currentLocation.projectId ?? undefined) ||
		effectiveTargetFolderId !== currentLocation.folderId

	return {
		effectiveTargetProjectId,
		effectiveTargetFolderId,
		hasUnsavedLocationChange
	}
}
