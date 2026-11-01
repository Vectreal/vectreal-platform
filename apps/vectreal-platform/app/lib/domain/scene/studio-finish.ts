import { bakedLightsSignature, litLights, resolveLighting } from '@vctrl/core'

import type { PublishExportRequest } from '../../../workers/publish-export.worker.types'
import type { LightingSettings } from '@vctrl/core'

/**
 * What publishing bakes for `lighting`: occlusion when it is set to baked, and
 * the studio lights when they are set to bake and any is on. The Lighting
 * tool's preview asks for the same, so it shows what will ship.
 */
export function publishBakes(
	lighting: LightingSettings | undefined
): Pick<PublishExportRequest, 'occlusion' | 'lights'> {
	const resolved = resolveLighting({ lighting })
	return {
		occlusion: resolved.occlusion.mode === 'baked',
		lights:
			resolved.bake.lights && litLights(resolved).length > 0
				? { lights: resolved.lights, environment: resolved.environment }
				: false
	}
}

/**
 * What publishing would bake for `lighting`, as a key: a light map down to
 * the lights it holds, so moving one changes the key. Null when it bakes
 * nothing.
 */
export function bakesKey(
	lighting: LightingSettings | undefined
): string | null {
	const { occlusion, lights } = publishBakes(lighting)
	if (!occlusion && !lights) return null
	return JSON.stringify({
		occlusion,
		lights: lights && bakedLightsSignature(lights)
	})
}
