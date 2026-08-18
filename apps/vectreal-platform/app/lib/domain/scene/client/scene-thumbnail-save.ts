import { isLocallyCapturedThumbnail } from './scene-change-detection'

import type { SceneMetaState } from '../../../../types/publisher-config'

interface ThumbnailSavePlanInput {
	sceneMetaState: SceneMetaState
	lastSavedSceneMeta: SceneMetaState | null
	/** True when the frame the scene opens on has moved since the last save. */
	defaultCameraChanged: boolean
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
	defaultCameraChanged
}: ThumbnailSavePlanInput): ThumbnailSavePlan => {
	const capturedThumbnail = isLocallyCapturedThumbnail(
		sceneMetaState.thumbnailUrl
	)
		? sceneMetaState.thumbnailUrl
		: null

	const storedThumbnailUrl = capturedThumbnail
		? (lastSavedSceneMeta?.thumbnailUrl ?? '')
		: sceneMetaState.thumbnailUrl

	return {
		capturedThumbnail,
		needsCapture:
			capturedThumbnail === null &&
			(!storedThumbnailUrl || defaultCameraChanged),
		fallbackThumbnailUrl: isLocallyCapturedThumbnail(storedThumbnailUrl)
			? ''
			: storedThumbnailUrl
	}
}
