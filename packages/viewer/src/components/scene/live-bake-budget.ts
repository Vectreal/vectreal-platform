/**
 * Whether a viewer may bake the ground shadow live, where it has no valid
 * stored bake to show.
 *
 * A live bake renders the whole model into eight shadow maps and the light
 * map on every one of its 48 frames. The published Porsche, 1,664 meshes,
 * peaked at 24,975 draw calls in one frame doing it, and iOS Safari dropped
 * the WebGL context under that load. A surface that only shows scenes -
 * the dashboard, `/preview`, an embed - draws the contact shadow instead
 * whenever that would happen.
 */

/** Who may bake live: anyone, or only a device and scene within the budget. */
export type LiveShadowBake = 'always' | 'within-budget'

export type LiveBakeSkipReason = 'touch_device' | 'over_budget'

/**
 * The most draw calls one bake frame may issue on a desktop. Above the
 * Porsche's 21,632 (its published lighting, one light) and 24,960 (the
 * publisher's two-light default), measured at 24,975: a desktop bakes it in a
 * couple of seconds, so a scene that heavy still bakes there.
 */
export const LIVE_BAKE_DRAW_BUDGET = 30_000

/**
 * Whether the device's primary pointer is coarse: a phone or a tablet.
 *
 * A touch laptop whose primary pointer is a trackpad or mouse reports `fine`
 * and counts as a desktop on purpose: it has a desktop GPU's memory, and the
 * limit this guards is the phone's.
 */
export const hasCoarsePrimaryPointer = (): boolean =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(pointer: coarse)').matches

/**
 * Draw calls one live bake frame issues, from what it renders:
 *
 * - each of the bake's shadow lights renders the model into its shadow map;
 * - the light-map pass renders the model once, and each scene light, which
 *   casts its own shadow, renders it into that light's map first;
 * - the frame itself renders the model once, with the scene lights' shadow
 *   maps again, and once more into the transmission target when a material
 *   transmits.
 *
 * Checked against the Porsche in WebKit: 1,664 meshes, two scene lights and
 * transmission give 1,664 × 15 = 24,960, against 24,975 measured; the rest
 * is the plane and the composer.
 */
export const estimateLiveBakeDraws = ({
	meshCount,
	bakeShadowLights,
	sceneLights,
	transmissive
}: {
	meshCount: number
	bakeShadowLights: number
	sceneLights: number
	transmissive: boolean
}): number => {
	const lightMapPass = 1 + sceneLights
	const framePass = 1 + sceneLights + (transmissive ? 1 : 0)
	return meshCount * (bakeShadowLights + lightMapPass + framePass)
}

/** Why a live bake should not run here, or null when it may. */
export const liveBakeSkipReason = ({
	mode,
	coarsePointer,
	estimatedDraws
}: {
	mode: LiveShadowBake
	coarsePointer: boolean
	estimatedDraws: number
}): LiveBakeSkipReason | null => {
	if (mode === 'always') return null
	if (coarsePointer) return 'touch_device'
	if (estimatedDraws > LIVE_BAKE_DRAW_BUDGET) return 'over_budget'
	return null
}
