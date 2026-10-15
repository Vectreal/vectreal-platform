import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { optimizationsMatch } from './client/optimization-inference'
import { shouldCompressTexturesForGpu } from './scene-presentation'
import { originalPreset } from '../../../constants/optimizations'

import type { Optimizations, ScenePresentationSettings } from '@vctrl/core'

/**
 * Describes what a publish of a saved scene is made from, so the server can
 * tell whether the file it published is still the one publishing would ship.
 *
 * Publishing freezes only the GLB. An embed reads the scene's settings live,
 * so a settings save is already on every embed and is deliberately left out
 * here: counting it would report changes as unpublished that visitors already
 * see. What the GLB depends on is the model document (its glTF JSON, buffers
 * and textures) and what publish encodes it with: Draco, and GPU texture
 * compression, which is a presentation setting but changes the file.
 *
 * Asset ids stand in for the document because uploads are content-addressed:
 * a save reuses a stored asset only when its name and hash match, so the same
 * ids mean the same bytes. The glTF JSON's id alone would not do: a texture
 * edited under its old name leaves the JSON byte-identical.
 *
 * The thumbnail and shadow bake are linked with the model but live outside the
 * GLB, and the kept original is never part of it; `getSceneSettingsWithAssetsRow`
 * already reads that one apart.
 */
export function describePublishSource({
	assets,
	optimizationSettings,
	presentation
}: {
	/** The scene's linked assets, without its kept original. */
	assets: readonly { id: string; name: string }[]
	/** As saved; a scene saved as the original upload stores none. */
	optimizationSettings: Optimizations | null | undefined
	presentation: ScenePresentationSettings | null | undefined
}): string {
	const modelAssetIds = assets
		.filter(
			(asset) =>
				asset.name !== SCENE_THUMBNAIL_FILENAME &&
				asset.name !== PERSISTED_BAKE_FILENAME
		)
		.map((asset) => asset.id)
		.sort()
	// The same default the publisher hydrates a scene without settings to.
	const optimizations = optimizationSettings ?? originalPreset
	const { enabled: dracoEnabled = false, ...dracoOptions } =
		optimizations.draco ?? {}

	return JSON.stringify({
		model: modelAssetIds,
		draco: dracoEnabled ? canonicalDracoOptions(dracoOptions) : null,
		gpuTextures: shouldCompressTexturesForGpu(presentation, {
			isOriginalPreset: optimizationsMatch(optimizations, originalPreset)
		})
	})
}

/**
 * Key order is whatever the settings were written in, and rows saved before
 * `name` left the type still carry it (see `optimization-inference`). Neither
 * changes what publish encodes, so neither may change the description.
 */
function canonicalDracoOptions(
	options: Record<string, unknown>
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(options)
			.filter(([key]) => key !== 'name')
			.sort(([a], [b]) => a.localeCompare(b))
	)
}
