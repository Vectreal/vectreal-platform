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
 * Set by Cloudflare on the proxied path. Cloudflare rejects a request that
 * arrives already carrying this header (documented as error 1000, reverse-proxy
 * loop detection), so on that path the value is not caller-influenced.
 */
const CLOUDFLARE_CLIENT_IP = 'cf-connecting-ip'

/** What an unidentifiable caller is counted as. */
export const UNKNOWN_CLIENT = 'unknown'

/** Longest possible IPv6 text form, IPv4-mapped included. Bounds the key. */
const MAX_IP_LENGTH = 45

/** Digits, hex letters, dots and colons. Enough to bound and sanity-check. */
const IP_SHAPED = /^[0-9a-fA-F.:]+$/

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
 * `fly-client-ip` is not consulted either, and used to be. It reads as the
 * obvious fallback for a request that reached Fly directly, but Fly documents it
 * as the address Fly Proxy accepted the connection from, which behind another
 * proxy is that proxy. Every hostname in `terraform/cloudflare.tf` pointing at
 * the Fly app sets `proxied = true`, staging included, so in both deployments
 * the value is a Cloudflare edge address rather than the visitor. The rung could
 * only ever fire when `cf-connecting-ip` was missing, and it would then collapse
 * every visitor onto the handful of edge IPs serving the zone - `embed-auth`
 * keys on address alone, so a few failing embeds would lock out everyone sharing
 * that edge. Answering `unknown` is worse for attribution and better for
 * everyone it would otherwise punish.
 *
 * Residual, and not fixable here: this is only as good as the guarantee that
 * traffic reaches the app through Cloudflare. `<app>.fly.dev` stays publicly
 * reachable - the deploy workflow health-checks it directly - and Fly documents
 * no way to keep a public address while restricting who may connect, so the
 * control has to be an origin-side check against Cloudflare's published ranges.
 * Filed separately.
 */
export function resolveClientIp(headers: Headers): string {
	const header = headers.get(CLOUDFLARE_CLIENT_IP)
	if (!header) {
		return UNKNOWN_CLIENT
	}

	/*
	  Node joins repeated headers with ", " before this ever sees them, and the
	  WHATWG `Headers.get` does the same for appended values. Cloudflare documents
	  this header as carrying exactly one address, so a comma means something
	  upstream of that guarantee: take the first entry rather than keying on the
	  whole joined string, which a caller controlling either half could steer.
	*/
	const first = header.split(',')[0]?.trim()

	// Shape and length are checked so the value cannot become arbitrary key
	// material. Anything unrecognizable is counted as unidentifiable, not
	// forwarded as-is.
	if (!first || first.length > MAX_IP_LENGTH || !IP_SHAPED.test(first)) {
		return UNKNOWN_CLIENT
	}

	return first
}
