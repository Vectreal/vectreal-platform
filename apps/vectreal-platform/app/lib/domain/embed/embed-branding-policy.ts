import type { EntitlementDecision } from '../billing/entitlement-service.server'

/**
 * Whether an embedded scene carries the Vectreal mark.
 *
 * The entitlement is named for what a customer buys - `embed_branding_removal`,
 * granted means the mark is gone - and the viewer prop is named for what is
 * drawn. Those are opposites, and an inverted boolean between them fails in the
 * direction nobody notices: a paid customer keeps the mark, or every free embed
 * quietly loses it. Naming the inversion once, here, is the whole point of this
 * module.
 *
 * Typed on the decision rather than a bare boolean so a caller cannot pass
 * `granted` from some unrelated entitlement by accident.
 */
export function shouldShowVectrealBranding(
	decision: Pick<EntitlementDecision, 'granted'>
): boolean {
	return !decision.granted
}

/**
 * The mark's setting for a rendered embed document, given whatever the layout
 * loader left behind.
 *
 * Absent means shown. Every refusal in the embed loader returns a response
 * rather than throwing, and React Router treats a returned response as data:
 * the layout mounts anyway, over a body with no decision in it. A rate-limited
 * or not-found load that the visitor retries would otherwise paint the scene
 * with no mark, because the plan was never consulted - so filling the failure
 * bucket would be a way to drop it.
 *
 * Only `/embed` passes through here. `/preview` is internal, renders no mark
 * at all, and defaults the other way in `SceneEmbedPage`.
 */
export function resolveEmbedBranding(
	loaderData: { showsVectrealBranding?: boolean } | undefined
): boolean {
	return loaderData?.showsVectrealBranding ?? true
}
