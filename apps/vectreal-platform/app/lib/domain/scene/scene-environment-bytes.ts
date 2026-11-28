import { environmentMapBytes, resolveLighting } from '@vctrl/core'

import type { SceneSettings } from '@vctrl/core'

/**
 * What a visitor downloads for a scene's environment map at the quality it
 * loads, or null for a map whose size is not known (a scene's own `files`).
 */
export function sceneEnvironmentBytes(
	settings: Pick<SceneSettings, 'lighting' | 'environment' | 'shadows'>
): number | null {
	const { environment } = resolveLighting(settings)
	return environmentMapBytes({
		preset: environment.map,
		environmentResolution: environment.resolution,
		environmentQuality: environment.quality,
		files: settings.environment?.files
	})
}

/**
 * What a visitor downloads besides the model: the environment map at the
 * quality it loads, null when its size is not known, and the files an embed
 * fetches beside the GLB (`sideAssetBytes`: shadow bake, loading thumbnail,
 * marker artwork).
 */
export interface DownloadExtras {
	environmentBytes: null | number
	sideAssetBytes: number
}

/** Nothing known besides the model. */
export const NO_DOWNLOAD_EXTRAS: DownloadExtras = {
	environmentBytes: null,
	sideAssetBytes: 0
}

/**
 * What a visitor downloads for a scene: its model, the files served beside it
 * and its environment map. The figure every surface shows a visitor's cost
 * by; plan limits and storage count the model alone. The Draco and KTX2
 * decoders are left out: they are shared by every scene and cached.
 */
export function sceneDownloadBytes(
	modelBytes: null | number | undefined,
	extras: DownloadExtras
): null | number {
	return typeof modelBytes === 'number'
		? modelBytes + extras.sideAssetBytes + (extras.environmentBytes ?? 0)
		: null
}
