import { bakedLightsSignature, litLights, resolveLighting } from '@vctrl/core'

import type {
	PublishExportOutcome,
	PublishExportRequest,
	StudioFinishPlan
} from '../../../workers/publish-export.worker.types'
import type { LightingSettings } from '@vctrl/core'

/**
 * What a draft records about the studio finish it saved: the publish
 * fingerprint it was made for, so it is shown only while the scene would
 * still publish the same file, and what each bake did, which decides whether
 * there is anything to show.
 */
export interface SavedStudioFinish {
	source: string
	reports: Pick<PublishExportOutcome, 'occlusion' | 'lights'>
}

/** The studio finish a save sends: its file and what each bake did. */
export interface StudioFinishToSave {
	bytes: ArrayBuffer
	reports: SavedStudioFinish['reports']
}

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
 * The bakes asked for, less any the plan says no material can take: a bake
 * with nothing to draw is never run, by the preview or by publishing. Without
 * a plan, as while it is still being made, every bake asked for runs.
 */
export function eligibleBakes(
	bakes: Pick<PublishExportRequest, 'occlusion' | 'lights'>,
	plan: StudioFinishPlan | null
): Pick<PublishExportRequest, 'occlusion' | 'lights'> {
	if (!plan) return bakes
	return {
		occlusion: bakes.occlusion && plan.occlusion.baked.length > 0,
		lights: plan.lights.baked.length > 0 ? bakes.lights : false
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
