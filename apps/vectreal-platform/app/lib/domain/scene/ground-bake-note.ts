import {
	isGroundBakeMissing,
	PERSISTED_BAKE_FILENAME,
	type SceneAssetRefMap,
	type SceneSettings
} from '@vctrl/core'

/**
 * Whether the scene page should ask the author to publish again: the
 * published scene draws a ground shadow it has no valid stored bake for, so a
 * phone or a scene over the live-bake budget shows a contact shadow in its
 * place until a publish stores one.
 *
 * Asked of the manifest a visitor receives, not the saved row: the embed
 * drops a bake pointer whose image it does not serve, and the viewer drops a
 * bake it has no image ref for (`resolveBakedShadowSource`), so a valid
 * signature with no served image is no stored bake at all. A draft is never
 * asked, since publishing is what stores the bake; nor is a manifest whose
 * settings could not be read, about which nothing is known.
 */
export function isPublishedShadowNotStored({
	isPublished,
	manifest
}: {
	isPublished: boolean
	manifest: {
		settings: SceneSettings | null
		assetRefs: SceneAssetRefMap | null
	} | null
}): boolean {
	const settings = manifest?.settings
	if (!isPublished || !settings) return false
	const served = Object.values(manifest.assetRefs ?? {}).some(
		(ref) => ref.fileName === PERSISTED_BAKE_FILENAME
	)
	return isGroundBakeMissing(
		served
			? settings
			: { ...settings, shadows: { ...settings.shadows, baked: undefined } }
	)
}
