import { isLocallyCapturedThumbnail } from './scene-change-detection'
import { thumbnailAssetIdFromUrl } from '../scene-thumbnail-url'

import type { SceneMetaState } from '../../../../types/publisher-config'

interface ThumbnailSavePlanInput {
	sceneMetaState: SceneMetaState
	lastSavedSceneMeta: SceneMetaState | null
	/** True when the frame the scene opens on has moved since the last save. */
	defaultCameraChanged: boolean
	/**
	 * The thumbnail asset the server says this save may relink, from
	 * `existingAssets`. Undefined on a save into another project, where every
	 * asset has to be uploaded into the new project's storage.
	 */
	reusableThumbnailAssetId: string | undefined
}

export interface ThumbnailSavePlan {
	/** An image captured in this session, still inline, waiting to be uploaded. */
	capturedThumbnail: null | string
	/** Whether the save has to take a fresh capture itself. */
	needsCapture: boolean
	/**
	 * The URL to commit if the upload does not happen or fails. Always a URL the
	 * browser can fetch later, never the image itself.
	 */
	fallbackThumbnailUrl: string
}

/**
 * What the thumbnail should be when a scene is saved.
 *
 * The publisher holds a captured thumbnail as a `data:` URL until it is stored,
 * which is right in memory and wrong in a row: the column holds a URL the
 * browser fetches later, so a `data:` URL there is the image itself, inlined
 * into every read of the scene. A capture is therefore always uploaded first,
 * and the value committed if that fails is the last one genuinely stored.
 */
export const planThumbnailForSave = ({
	sceneMetaState,
	lastSavedSceneMeta,
	defaultCameraChanged,
	reusableThumbnailAssetId
}: ThumbnailSavePlanInput): ThumbnailSavePlan => {
	const capturedThumbnail = isLocallyCapturedThumbnail(
		sceneMetaState.thumbnailUrl
	)
		? sceneMetaState.thumbnailUrl
		: null

	const candidateUrl = capturedThumbnail
		? (lastSavedSceneMeta?.thumbnailUrl ?? '')
		: sceneMetaState.thumbnailUrl

	// A stored thumbnail is kept only while the server lists it as reusable for
	// this save, the same rule the model files follow. Relinked after a move to
	// another project, it would name an asset in the old project, and the save
	// refuses that.
	const candidateAssetId = thumbnailAssetIdFromUrl(candidateUrl)
	const storedThumbnailUrl =
		candidateAssetId !== null && candidateAssetId === reusableThumbnailAssetId
			? candidateUrl
			: ''

	return {
		capturedThumbnail,
		needsCapture:
			capturedThumbnail === null &&
			(!storedThumbnailUrl || defaultCameraChanged),
		fallbackThumbnailUrl: storedThumbnailUrl
	}
}
