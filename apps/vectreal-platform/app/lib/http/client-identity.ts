/**
 * Who a request came from, for the purpose of rate limiting it.
 *
 * Four copies of this answered the question before, and they disagreed. Three
 * checked `cf-connecting-ip` first and were roughly right; the fourth, guarding
 * embed authentication, went straight to `x-forwarded-for` - a header the caller
 * writes. Sending one fabricated value per request gave every request a fresh
 * identity, so the limiter it fed counted to one and never fired.
 *
 * Pure, so the spoofing cases are testable directly rather than through a route.
 */

/**
 * Set by Cloudflare, overwriting whatever the caller sent. The trustworthy one,
 * as long as traffic actually arrives through Cloudflare.
 */
const CLOUDFLARE_CLIENT_IP = 'cf-connecting-ip'

/** Set by Fly's proxy. The fallback for a request that reached Fly directly. */
const FLY_CLIENT_IP = 'fly-client-ip'

/** What an unidentifiable caller is counted as. */
export const UNKNOWN_CLIENT = 'unknown'

/**
 * The caller's address, or `unknown`.
 *
 * `x-forwarded-for` is deliberately not consulted, at all. With Cloudflare in
 * front of Fly its first entry is whatever the caller wrote and its last is
 * Cloudflare, so neither hop is the caller - reading either one is a guess that
 * happens to be safe only while a trustworthy header is also present. Leaving it
 * out means the fallback is honest: an unidentifiable request is counted as
 * `unknown` rather than as an attacker-chosen string.
 *
 * Residual, and not fixable here: `cf-connecting-ip` is only as good as the
 * guarantee that traffic reaches the app through Cloudflare. The Fly app is also
 * reachable directly at its `.fly.dev` host, where a caller can set that header
 * themselves. Restricting ingress to Cloudflare is infrastructure work and is
 * filed separately.
 */
export function resolveClientIp(headers: Headers): string {
	const cloudflare = headers.get(CLOUDFLARE_CLIENT_IP)?.trim()
	if (cloudflare) {
		return cloudflare
	}

	const fly = headers.get(FLY_CLIENT_IP)?.trim()
	if (fly) {
		return fly
	}

	return UNKNOWN_CLIENT
}
