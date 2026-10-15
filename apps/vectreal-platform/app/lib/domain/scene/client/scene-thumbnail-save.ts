import { isLocallyCapturedThumbnail } from './scene-change-detection'
import { thumbnailAssetIdFromUrl } from '../scene-thumbnail-url'

import type { SceneMetaState } from '../../../../types/publisher-config'

interface ThumbnailSavePlanInput {
	sceneMetaState: SceneMetaState
	lastSavedSceneMeta: SceneMetaState | null
	/**
	 * True when anything the capture paints has changed since the last save:
	 * the default camera's frame, or the background or stage behind the model.
	 */
	frameChanged: boolean
	/**
	 * Whether the pending capture painted the frame the scene now opens into,
	 * when "Set opening view" recorded which frame it painted. Undefined when
	 * nothing was recorded, and then a changed frame decides.
	 */
	pendingCaptureIsCurrent?: boolean
	/**
	 * The thumbnail asset the server says this save may relink, from
	 * `existingAssets`. Undefined on a save into another project, where every
	 * asset has to be uploaded into the new project's storage.
	 */
	reusableThumbnailAssetId: string | undefined
}

export interface ThumbnailSavePlan {
	/**
	 * An image captured in this session, still inline, to upload as it is.
	 * Null when the waiting capture does not paint the current frame: the save
	 * takes a fresh one.
	 */
	capturedThumbnail: null | string
	/**
	 * The capture waiting in memory, whether or not it is still current: what
	 * to upload if the fresh capture fails, since it is closer to the opening
	 * view than the last stored thumbnail or none at all.
	 */
	pendingCapture: null | string
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
	frameChanged,
	pendingCaptureIsCurrent,
	reusableThumbnailAssetId
}: ThumbnailSavePlanInput): ThumbnailSavePlan => {
	const pendingCapture = isLocallyCapturedThumbnail(sceneMetaState.thumbnailUrl)
		? sceneMetaState.thumbnailUrl
		: null
	// A capture still waiting in memory may predate a stage, background or
	// camera change. Its record says whether it still paints the current frame,
	// even when that frame equals the last save's; without one, a changed frame
	// means the save captures again from the opening camera.
	const capturedThumbnail =
		(pendingCaptureIsCurrent ?? !frameChanged) ? pendingCapture : null

	const candidateUrl = pendingCapture
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
		pendingCapture,
		needsCapture:
			capturedThumbnail === null && (!storedThumbnailUrl || frameChanged),
		fallbackThumbnailUrl: storedThumbnailUrl
	}
}
