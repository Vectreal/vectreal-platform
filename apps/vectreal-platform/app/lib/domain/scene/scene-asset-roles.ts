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
	source: 'source-glb'
} as const

export type SceneAssetRole =
	(typeof SCENE_ASSET_ROLE)[keyof typeof SCENE_ASSET_ROLE]

/**
 * The name the original is stored under. One fixed name, so a re-save finds
 * the stored original by name and reuses it when its hash matches.
 */
export const SOURCE_MODEL_FILENAME = 'source.glb'
