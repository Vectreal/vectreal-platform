import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { isHotspotArtworkAsset } from './hotspot-artwork'

/**
 * What a `scene_assets` link is for.
 *
 * Every link used to be written as `'gltf-asset'` and nothing read the column,
 * so every reader took every linked asset to be part of the model on screen.
 * A scene can now also keep the original its model was optimized from, which
 * must never be downloaded, rendered or served as the model, so the readers ask
 * a link's role instead of assuming it.
 *
 * Client-safe: the save sends the original under its file name.
 */
export const SCENE_ASSET_ROLE = {
	/** Part of the model on screen: its document, buffers, textures, bake, thumbnail. */
	model: 'gltf-asset',
	/** The original the model was optimized from, kept so it can be re-derived. */
	source: 'source-glb',
	/**
	 * The model as publishing would ship it with its studio finish baked in,
	 * saved with the draft so its surfaces show the finish. Never part of the
	 * model, and never served to an embed.
	 */
	finish: 'studio-finish'
} as const

export type SceneAssetRole =
	(typeof SCENE_ASSET_ROLE)[keyof typeof SCENE_ASSET_ROLE]

/**
 * The name the original is stored under. One fixed name, so a re-save finds
 * the stored original by name and reuses it when its hash matches.
 */
export const SOURCE_MODEL_FILENAME = 'source.glb'

/** The name the studio finish is stored under, so a re-save of the same bytes reuses it. */
export const STUDIO_FINISH_FILENAME = 'studio-finish.glb'

/**
 * What a link is for. A link without a role is part of the model, as every
 * reader takes it. The studio finish is known by its name too: a release that
 * predates its role relinks it as part of the model, and it must not stay so.
 */
export function sceneAssetRole(
	usageType: string | null,
	name: string
): SceneAssetRole {
	if (usageType === SCENE_ASSET_ROLE.source) return SCENE_ASSET_ROLE.source
	if (
		usageType === SCENE_ASSET_ROLE.finish ||
		name === STUDIO_FINISH_FILENAME
	) {
		return SCENE_ASSET_ROLE.finish
	}
	return SCENE_ASSET_ROLE.model
}

/**
 * A linked asset that is drawn from its own URL and is never part of the
 * model: the scene thumbnail, and a marker's uploaded artwork.
 *
 * Linked so the GC keeps it, but every reader that turns linked assets into
 * the model, its texture list or its publish signature has to leave these out,
 * and they used to decide that one by one, each naming only the thumbnail.
 */
export function isUrlServedSceneAsset(asset: {
	name: string
	mimeType: string | null
}): boolean {
	return asset.name === SCENE_THUMBNAIL_FILENAME || isHotspotArtworkAsset(asset)
}
