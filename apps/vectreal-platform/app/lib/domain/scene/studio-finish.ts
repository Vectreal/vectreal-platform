import { bakedLightsSignature, litLights, resolveLighting } from '@vctrl/core'

import type {
	PublishExportOutcome,
	PublishExportRequest,
	StudioFinishPlan
} from '../../../workers/publish-export.worker.types'
import type { LightingSettings } from '@vctrl/core'

/**
 * What a draft records about the studio finish it saved: what it was made
 * from, so it is shown only while the scene still is that, and what each bake
 * did, which decides whether there is anything to show.
 *
 * Every finish is current while its model and bakes are, as
 * `describeFinishSource` and `storedFinishSource` read them, so a codec
 * switch leaves it in place. One saved now is the model with its bakes drawn
 * in and no codec applied (`unencoded`), which publish encodes with the
 * codecs asked for then. One saved before is a whole published file, Draco
 * and KTX2 included: still the right bake to show, but publish bakes again
 * rather than encode a file that is already encoded.
 */
export interface SavedStudioFinish {
	source: string
	reports: Pick<PublishExportOutcome, 'occlusion' | 'lights'>
	unencoded?: true
}

/** The studio finish a save sends: its file, before any codec, and what each bake did. */
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
