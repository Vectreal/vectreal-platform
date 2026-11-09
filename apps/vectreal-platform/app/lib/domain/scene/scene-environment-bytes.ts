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
 * What a visitor downloads for a scene: its model and its environment map.
 * The figure every surface shows a visitor's cost by; plan limits and storage
 * count the model alone.
 */
export function sceneDownloadBytes(
	modelBytes: null | number | undefined,
	environmentBytes: null | number
): null | number {
	return typeof modelBytes === 'number'
		? modelBytes + (environmentBytes ?? 0)
		: null
}
