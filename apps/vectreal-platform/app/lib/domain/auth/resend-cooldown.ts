/**
 * How long the resend button stays locked, per response.
 *
 * Pure, and separate from the route, because the route module cannot be
 * imported by a test - `getDbClient()` throws at module scope. Left inline it
 * was unpinned: the spec hand-copied an identical policy, so deleting the
 * rate-limit branch from the route kept every test green, including the one
 * whose name says it closes that hole.
 */

export const RESEND_COOLDOWN_SECONDS = 60

export interface ResendResult {
	sent?: boolean
	rateLimited?: boolean
	retryAfterSeconds?: number
}

/** Seconds to hold the button, or null to leave it alone. */
export function resendCooldownFor(result: ResendResult): number | null {
	if (result.sent) return RESEND_COOLDOWN_SECONDS
	/*
	  A rate limit locks the button too, for as long as the server said. Without
	  this the fourth press in a window answered "Too many requests" and then
	  re-enabled as soon as a fresh captcha token landed - the same rapid-retry
	  hole the cooldown exists to close, on the other branch.
	*/
	if (result.rateLimited)
		return result.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS
	return null
}
